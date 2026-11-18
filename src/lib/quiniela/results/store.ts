// Quiniela results (spec: quiniela-results): readings per source and the consolidated result.
//   Confirmed — every reading agrees and there are two or more of them, or one is official.
//   Pending   — a single, non-official reading.
//   Conflict  — readings disagree on any prize: an admin chooses (and that choice stays).
import type { QuinielaDrawSlot, QuinielaResultStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { dateValue } from "@/lib/schedule";
import { isoDate, loadCalendar } from "@/lib/quiniela/calendar";
import { jugandoOnline } from "@/lib/quiniela/results/sources/jugandoonline";
import { loteriaGba } from "@/lib/quiniela/results/sources/loteria-gba";
import { loteriaSantaFe } from "@/lib/quiniela/results/sources/loteria-santafe";
import { notitimba } from "@/lib/quiniela/results/sources/notitimba";
import type { Reading, ResultSource } from "@/lib/quiniela/results/types";

export const RESULT_SOURCES: Record<string, ResultSource> = {
  [loteriaGba.key]: loteriaGba,
  [loteriaSantaFe.key]: loteriaSantaFe,
  [jugandoOnline.key]: jugandoOnline,
  [notitimba.key]: notitimba,
};
export const sourceLabel = (key: string) => RESULT_SOURCES[key]?.label ?? key;

type Evidence = { source: string; numbers: string; letters: string | null; official: boolean };

/** The consolidated state of one draw from its readings (pure). */
export function consolidate(readings: Evidence[]): { status: QuinielaResultStatus; numbers: string[] | null; letters: string | null; sources: number } | null {
  if (!readings.length) return null;
  const groups = new Map<string, Evidence[]>();
  for (const r of readings) groups.set(r.numbers, [...(groups.get(r.numbers) ?? []), r]);
  if (groups.size > 1) return { status: "CONFLICT", numbers: null, letters: null, sources: 0 };
  const [numbers, group] = [...groups.entries()][0];
  return {
    status: group.length >= 2 || group.some((r) => r.official) ? "CONFIRMED" : "PENDING",
    numbers: numbers.split(","),
    letters: group.find((r) => r.letters)?.letters ?? null,
    sources: group.length,
  };
}

async function writeNumbers(resultId: string, numbers: string[] | null) {
  await prisma.quinielaResultNumber.deleteMany({ where: { resultId } });
  if (numbers) await prisma.quinielaResultNumber.createMany({ data: numbers.map((number, i) => ({ resultId, position: i + 1, number })) });
}

/** Recomputes one draw's result from its readings (a result an admin resolved keeps its numbers). */
export async function reconcile(date: string, slot: QuinielaDrawSlot, lotteryId: string) {
  const key = { date: dateValue(date), slot, lotteryId };
  const [readings, existing] = await Promise.all([
    prisma.quinielaResultReading.findMany({ where: key }),
    prisma.quinielaResult.findUnique({ where: { date_slot_lotteryId: key } }),
  ]);
  if (existing?.resolvedById) return existing;
  const c = consolidate(readings);
  if (!c) return existing;
  const data = {
    status: c.status,
    letters: c.letters,
    sources: c.sources,
    confirmedAt: c.status === "CONFIRMED" ? (existing?.confirmedAt ?? new Date()) : null,
  };
  const result = existing
    ? await prisma.quinielaResult.update({ where: { id: existing.id }, data })
    : await prisma.quinielaResult.create({ data: { ...key, ...data } });
  await writeNumbers(result.id, c.numbers);
  return result;
}

/** Stores a source's readings (replacing that source's previous ones) and reconciles those draws. */
export async function saveReadings(source: ResultSource, readings: Reading[], jobRunId?: string | null) {
  const lotteries = await prisma.lottery.findMany({ select: { id: true, code: true } });
  const lotteryId = new Map(lotteries.map((l) => [l.code, l.id]));
  let changed = 0;
  const touched: { date: string; slot: QuinielaDrawSlot; lotteryId: string }[] = [];
  for (const r of readings) {
    const id = lotteryId.get(r.lottery);
    if (!id) continue;
    const key = { source: source.key, date: dateValue(r.date), slot: r.slot, lotteryId: id };
    const numbers = r.numbers.join(",");
    const prev = await prisma.quinielaResultReading.findUnique({ where: { source_date_slot_lotteryId: key } });
    const now = new Date();
    if (!prev) {
      await prisma.quinielaResultReading.create({
        data: { ...key, numbers, letters: r.letters ?? null, official: source.officialFor.includes(r.lottery), jobRunId: jobRunId ?? null },
      });
      changed++;
    } else if (prev.numbers !== numbers || (r.letters && prev.letters !== r.letters)) {
      await prisma.quinielaResultReading.update({
        where: { id: prev.id },
        data: { numbers, letters: r.letters ?? prev.letters, readAt: now, changedAt: now, jobRunId: jobRunId ?? null },
      });
      changed++;
    } else await prisma.quinielaResultReading.update({ where: { id: prev.id }, data: { readAt: now } });
    touched.push({ date: r.date, slot: r.slot, lotteryId: id });
  }
  const results: Awaited<ReturnType<typeof reconcile>>[] = [];
  for (const t of touched) results.push(await reconcile(t.date, t.slot, t.lotteryId));
  const count = (s: QuinielaResultStatus) => results.filter((r) => r?.status === s).length;
  return { read: readings.length, changed, confirmed: count("CONFIRMED"), pending: count("PENDING"), conflicts: count("CONFLICT") };
}

/** An admin chooses the right version of a draw in conflict (the numbers of one reading). */
export async function resolveResult(resultId: string, readingId: string, userId: string) {
  const [result, reading] = await Promise.all([
    prisma.quinielaResult.findUniqueOrThrow({ where: { id: resultId } }),
    prisma.quinielaResultReading.findUniqueOrThrow({ where: { id: readingId } }),
  ]);
  if (reading.date.getTime() !== result.date.getTime() || reading.slot !== result.slot || reading.lotteryId !== result.lotteryId)
    throw new Error("Esa lectura es de otro sorteo.");
  const agree = await prisma.quinielaResultReading.count({
    where: { date: result.date, slot: result.slot, lotteryId: result.lotteryId, numbers: reading.numbers },
  });
  await prisma.quinielaResult.update({
    where: { id: resultId },
    data: { status: "CONFIRMED", letters: reading.letters, sources: agree, confirmedAt: new Date(), resolvedById: userId, resolvedAt: new Date() },
  });
  await writeNumbers(resultId, reading.numbers.split(","));
}

/** Undo an admin's choice: back to what the sources say. */
export async function unresolveResult(resultId: string) {
  const result = await prisma.quinielaResult.update({ where: { id: resultId }, data: { resolvedById: null, resolvedAt: null } });
  await reconcile(isoDate(result.date), result.slot, result.lotteryId);
}

/** Results of a date with their numbers (for the results grid). */
export function resultsOn(date: string) {
  return prisma.quinielaResult.findMany({
    where: { date: dateValue(date) },
    include: { lottery: { select: { code: true, name: true } }, numbers: { orderBy: { position: "asc" } } },
  });
}

/** Latest date with any result, not after `upTo`. */
export async function lastResultDate(upTo: string) {
  const r = await prisma.quinielaResult.findFirst({ where: { date: { lte: dateValue(upTo) } }, orderBy: { date: "desc" }, select: { date: true } });
  return r ? isoDate(r.date) : null;
}

/** One result with every source's reading (for the detail screen). */
export function resultDetail(resultId: string) {
  return prisma.quinielaResult.findUnique({
    where: { id: resultId },
    include: {
      lottery: { select: { code: true, name: true } },
      numbers: { orderBy: { position: "asc" } },
      resolvedBy: { select: { name: true } },
    },
  });
}

export function readingsOf(r: { date: Date; slot: QuinielaDrawSlot; lotteryId: string }) {
  return prisma.quinielaResultReading.findMany({ where: { date: r.date, slot: r.slot, lotteryId: r.lotteryId }, orderBy: [{ official: "desc" }, { readAt: "asc" }] });
}

/** Draws held on a date (in any province with a usual week) that are not confirmed yet. */
export async function unconfirmedDraws(date: string) {
  const provinces = await prisma.provinceQuinielaDrawRule.findMany({ distinct: ["provinceId"], select: { provinceId: true } });
  const held = new Map<string, { slot: QuinielaDrawSlot; lottery: string }>();
  for (const { provinceId } of provinces) {
    const cal = await loadCalendar(provinceId, date, date);
    for (const d of cal.heldOn(date)) for (const lottery of d.lotteries) held.set(`${d.slot}|${lottery}`, { slot: d.slot, lottery });
  }
  const confirmed = await prisma.quinielaResult.findMany({
    where: { date: dateValue(date), status: "CONFIRMED" },
    select: { slot: true, lottery: { select: { code: true } } },
  });
  for (const c of confirmed) held.delete(`${c.slot}|${c.lottery.code}`);
  return [...held.values()];
}
