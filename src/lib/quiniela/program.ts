// Monthly Quiniela program of a province (spec: province-quiniela-calendar).
// Import: the official PDF becomes a DRAFT version (parsed by position, cross-checked with the
// public web schedule). Publish: an admin reviews it and the draft is materialized day by day,
// draw by draw, with the lotteries taking part; that is what betting availability reads.
import { createHash, randomUUID } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import type { QuinielaDrawSlot } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { dateValue } from "@/lib/schedule";
import { keys, putFile } from "@/lib/storage";
import { type ProgramDraft, parseProgramPdf } from "@/lib/quiniela/program-pdf";
import type { WebSchedule } from "@/lib/quiniela/web-schedule";

export class ProgramError extends Error {}

export const SLOT_LABEL: Record<QuinielaDrawSlot, string> = {
  PREVIA: "La Previa",
  PRIMERA: "El Primero",
  MATUTINA: "Matutina",
  VESPERTINA: "Vespertina",
  NOCTURNA: "Nocturna",
};
export const SLOT_ORDER: QuinielaDrawSlot[] = ["PREVIA", "PRIMERA", "MATUTINA", "VESPERTINA", "NOCTURNA"];
export const MONTH_LABEL = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

/** Differences between the program and the public weekly schedule (holidays without draws are fine). */
export function compareWithWeb(draft: ProgramDraft, web: WebSchedule): string[] {
  const out: string[] = [];
  const label = `${MONTH_LABEL[draft.month - 1]} de ${draft.year}`;
  if (web.monthLabel && web.monthLabel.toLowerCase() !== label) out.push(`La web muestra los horarios de ${web.monthLabel}, no de ${label}: no se comparó.`);
  if (out.length) return out;
  const problems = new Map<string, string[]>();
  const add = (msg: string, date: string) => problems.set(msg, [...(problems.get(msg) ?? []), date.slice(8)]);
  for (const day of draft.days) {
    const wd = new Date(`${day.date}T12:00:00Z`).getUTCDay();
    for (const row of web.rows.filter((r) => r.weekdays.includes(wd))) {
      const draw = day.draws.find((d) => d.slot === row.slot);
      const name = `${row.montevideo ? "Montevideo " : ""}${SLOT_LABEL[row.slot]}`;
      if (!draw) {
        add(`${name}: falta en el PDF`, day.date);
        continue;
      }
      if (draw.time !== row.time) add(`${name}: el PDF dice ${draw.time} y la web ${row.time}`, day.date);
      const missing = row.lotteries.filter((l) => !draw.lotteries.some((x) => x.code === l));
      if (missing.length && !row.montevideo) add(`${name}: sin ${missing.join(", ")} en el PDF`, day.date);
    }
  }
  for (const [msg, days] of problems) out.push(`${msg} (días ${days.join(", ")}).`);
  return out;
}

/** New DRAFT version from the official PDF, unless that exact PDF was already imported. */
export async function importProgramPdf(input: {
  provinceCode: string;
  pdf: Uint8Array;
  sourceUrl?: string | null;
  web?: WebSchedule | null;
}) {
  const province = await prisma.province.findUniqueOrThrow({ where: { code: input.provinceCode } });
  const sourceHash = createHash("sha256").update(input.pdf).digest("hex");
  const known = await prisma.provinceQuinielaMonthlyProgram.findFirst({ where: { provinceId: province.id, sourceHash } });
  if (known) return { program: known, created: false as const };

  const draft = await parseProgramPdf(input.pdf);
  const warnings = [...draft.warnings, ...(input.web ? compareWithWeb(draft, input.web) : [])];
  const last = await prisma.provinceQuinielaMonthlyProgram.findFirst({
    where: { provinceId: province.id, year: draft.year, month: draft.month },
    orderBy: { version: "desc" },
  });
  const version = (last?.version ?? 0) + 1;
  const sourceFileKey = keys.quinielaProgram(province.code, draft.year, draft.month, version);
  await putFile("private", sourceFileKey, input.pdf, "application/pdf");

  const program = await prisma.$transaction(async (tx) => {
    // Only the newest draft of a month is kept for review.
    await tx.provinceQuinielaMonthlyProgram.updateMany({
      where: { provinceId: province.id, year: draft.year, month: draft.month, status: "DRAFT" },
      data: { status: "ARCHIVED" },
    });
    return tx.provinceQuinielaMonthlyProgram.create({
      data: {
        provinceId: province.id,
        year: draft.year,
        month: draft.month,
        version,
        status: "DRAFT",
        sourceFileKey,
        sourceUrl: input.sourceUrl ?? null,
        sourceHash,
        draft: draft as unknown as Prisma.InputJsonValue,
        warnings: warnings as unknown as Prisma.InputJsonValue,
      },
    });
  });
  return { program, created: true as const, draft, warnings };
}

const timeValue = (hhmm: string) => new Date(`1970-01-01T${hhmm}:00.000Z`);
const minusMinutes = (hhmm: string, minutes: number) => {
  const [h, m] = hhmm.split(":").map(Number);
  const total = h * 60 + m - minutes;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
};

/** Materialize a DRAFT: it becomes the month's PUBLISHED program (the previous one is archived). */
export async function publishProgram(programId: string) {
  const program = await prisma.provinceQuinielaMonthlyProgram.findUniqueOrThrow({ where: { id: programId } });
  if (program.status !== "DRAFT") throw new ProgramError("Solo se publica un borrador.");
  const draft = program.draft as unknown as ProgramDraft | null;
  if (!draft?.days?.length) throw new ProgramError("El borrador no tiene días.");

  const lotteries = await prisma.provinceLotteryAvailability.findMany({
    where: { provinceId: program.provinceId, enabled: true },
    include: { lottery: { select: { id: true, code: true } } },
  });
  const lotteryId = new Map(lotteries.map((l) => [l.lottery.code, l.lottery.id]));
  const unknown = [...new Set(draft.days.flatMap((d) => d.draws.flatMap((dr) => dr.lotteries.map((l) => l.code))))].filter((c) => !lotteryId.has(c));
  if (unknown.length) throw new ProgramError(`Loterías del programa que la provincia no tiene habilitadas: ${unknown.join(", ")}.`);
  const quiniela = await prisma.provinceGameAvailability.findFirst({
    where: { provinceId: program.provinceId, game: { code: "QUINIELA" } },
    select: { cutoffMinutes: true },
  });
  const cutoff = quiniela?.cutoffMinutes ?? null;

  await prisma.$transaction(
    async (tx) => {
      await tx.provinceQuinielaMonthlyProgram.updateMany({
        where: { provinceId: program.provinceId, year: program.year, month: program.month, status: "PUBLISHED" },
        data: { status: "ARCHIVED" },
      });
      // Ids made here so the whole month goes in three inserts (days, draws, lotteries).
      const days: Prisma.ProvinceQuinielaProgramDayCreateManyInput[] = [];
      const draws: Prisma.ProvinceQuinielaProgramDayDrawCreateManyInput[] = [];
      const links: Prisma.ProvinceQuinielaDrawLotteryCreateManyInput[] = [];
      for (const day of draft.days) {
        const dayId = randomUUID();
        days.push({ id: dayId, programId, date: dateValue(day.date), prizeExpiry: day.prizeExpiry ? dateValue(day.prizeExpiry) : null });
        for (const draw of day.draws) {
          const drawId = randomUUID();
          draws.push({
            id: drawId,
            dayId,
            slot: draw.slot,
            drawTime: timeValue(draw.time),
            closeTime: cutoff !== null ? timeValue(minusMinutes(draw.time, cutoff)) : null,
          });
          for (const l of draw.lotteries) links.push({ drawId, lotteryId: lotteryId.get(l.code)!, drawNumber: l.drawNumber });
        }
      }
      await tx.provinceQuinielaProgramDay.createMany({ data: days });
      await tx.provinceQuinielaProgramDayDraw.createMany({ data: draws });
      await tx.provinceQuinielaDrawLottery.createMany({ data: links });
      await tx.provinceQuinielaMonthlyProgram.update({ where: { id: programId }, data: { status: "PUBLISHED", publishedAt: new Date() } });
    },
    { timeout: 60_000 },
  );
}

/** Discard a draft (kept as ARCHIVED for the record). */
export async function discardDraft(programId: string) {
  const program = await prisma.provinceQuinielaMonthlyProgram.findUniqueOrThrow({ where: { id: programId } });
  if (program.status !== "DRAFT") throw new ProgramError("Solo se descarta un borrador.");
  await prisma.provinceQuinielaMonthlyProgram.update({ where: { id: programId }, data: { status: "ARCHIVED" } });
}

/** Published draws of a province on a date, by time, with their lotteries. Empty: no draws that day. */
export async function drawsOn(provinceId: string, date: string) {
  const day = await prisma.provinceQuinielaProgramDay.findFirst({
    where: { date: dateValue(date), enabled: true, program: { provinceId, status: "PUBLISHED" } },
    include: {
      draws: {
        where: { enabled: true },
        include: { lotteries: { include: { lottery: { select: { code: true, name: true } } } } },
        orderBy: { drawTime: "asc" },
      },
    },
  });
  return day;
}

/** Programs of a province, newest month first. */
export function provincePrograms(provinceId: string) {
  return prisma.provinceQuinielaMonthlyProgram.findMany({
    where: { provinceId },
    select: { id: true, year: true, month: true, version: true, status: true, publishedAt: true, createdAt: true, warnings: true, sourceUrl: true },
    orderBy: [{ year: "desc" }, { month: "desc" }, { version: "desc" }],
  });
}
