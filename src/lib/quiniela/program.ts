// Monthly Quiniela program of a province (spec: province-quiniela-calendar).
// Import: the official PDF becomes a DRAFT version (parsed by position, cross-checked with the
// public web schedule). Publish: the draft is compared with the usual week (calendar.ts) and only
// what differs is written: changes to the usual week from a date, date exceptions and the month's
// first draw numbers. Nothing is copied day by day.
import { createHash } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { dateValue, timeValue } from "@/lib/schedule";
import { keys, putFile } from "@/lib/storage";
import {
  type Anchor,
  type CalendarData,
  type Exception,
  LOTTERY_SHORT,
  QuinielaCalendar,
  type Rule,
  SLOT_LABEL,
  SLOT_ORDER,
  type Slot,
  addDays,
  datesBetween,
  heldOn,
  isoDate,
  loadAnchors,
  loadCalendar,
  loadExceptions,
  loadRules,
  monthBounds,
  quinielaRules,
  ruleActive,
  setFrom,
  syncRules,
  weekdayOf,
} from "@/lib/quiniela/calendar";
import { type ProgramDraft, parseProgramPdf } from "@/lib/quiniela/program-pdf";
import type { WebSchedule } from "@/lib/quiniela/web-schedule";

export { SLOT_LABEL, SLOT_ORDER, drawsOn } from "@/lib/quiniela/calendar";

export class ProgramError extends Error {}

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

// ─── Publishing: the official program is compared with the usual week ───

export type RuleChange = { slot: Slot; lottery: string; weekday: number; from: string; time: string | null; previous: string | null };
export type ProgramPlan = {
  start: string;
  end: string;
  rulesBefore: Rule[];
  rulesAfter: Rule[];
  ruleChanges: RuleChange[];
  exceptions: Exception[];
  anchors: Anchor[];
  notes: string[];
  mismatches: string[]; // what would still differ from the program after publishing (manual exceptions)
};

type PdfMonth = Map<string, Map<Slot, { time: string; lotteries: Map<string, number | null> }>>;
function pdfMonth(draft: ProgramDraft, start: string, end: string): PdfMonth {
  const out: PdfMonth = new Map();
  for (const day of draft.days) {
    if (day.date < start || day.date > end || !day.draws.length) continue;
    const slots = new Map<Slot, { time: string; lotteries: Map<string, number | null> }>();
    for (const d of day.draws) slots.set(d.slot, { time: d.time, lotteries: new Map(d.lotteries.map((l) => [l.code, l.drawNumber])) });
    out.set(day.date, slots);
  }
  return out;
}

const dm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const who = (slot: Slot, lottery?: string | null) => `${SLOT_LABEL[slot]}${lottery ? ` · ${LOTTERY_SHORT[lottery] ?? lottery}` : ""}`;

/** Differences between what the calendar resolves for a month and the official program. */
export function compareMonth(cal: QuinielaCalendar, draft: ProgramDraft, start: string, end: string, limit = 40): string[] {
  const pdf = pdfMonth(draft, start, end);
  const expiry = new Map(draft.days.map((d) => [d.date, d.prizeExpiry]));
  const out: string[] = [];
  for (const date of datesBetween(start, end)) {
    const p = pdf.get(date);
    const day = cal.day(date);
    if (!p) {
      if (day.draws.length) out.push(`${dm(date)}: el calendario tiene sorteos y el programa no.`);
      continue;
    }
    for (const slot of SLOT_ORDER) {
      const ps = p.get(slot);
      const d = day.draws.find((x) => x.slot === slot);
      if (!ps && !d) continue;
      if (!ps || !d) {
        out.push(`${dm(date)} ${SLOT_LABEL[slot]}: ${ps ? "está en el programa y no en el calendario" : "está en el calendario y no en el programa"}.`);
        continue;
      }
      if (ps.time !== d.time) out.push(`${dm(date)} ${SLOT_LABEL[slot]}: ${d.time} en el calendario y ${ps.time} en el programa.`);
      for (const [code, n] of ps.lotteries) {
        const l = d.lotteries.find((x) => x.code === code);
        if (!l) out.push(`${dm(date)} ${who(slot, code)}: falta en el calendario.`);
        else if (n !== null && l.drawNumber !== n) out.push(`${dm(date)} ${who(slot, code)}: n.º ${l.drawNumber ?? "?"} en el calendario y ${n} en el programa.`);
      }
      for (const l of d.lotteries) if (!ps.lotteries.has(l.code)) out.push(`${dm(date)} ${who(slot, l.code)}: sobra en el calendario.`);
    }
    const e = expiry.get(date);
    if (e && day.prizeExpiry !== e) out.push(`${dm(date)}: caduca el ${day.prizeExpiry ? dm(day.prizeExpiry) : "?"} en el calendario y el ${dm(e)} en el programa.`);
  }
  return out.length > limit ? [...out.slice(0, limit), `… y ${out.length - limit} diferencias más.`] : out;
}

/** What publishing a draft would change: usual week from a date, date exceptions, anchors. */
export async function planProgram(programId: string): Promise<ProgramPlan> {
  const program = await prisma.provinceQuinielaMonthlyProgram.findUniqueOrThrow({ where: { id: programId } });
  const draft = program.draft as unknown as ProgramDraft | null;
  if (!draft?.days?.length) throw new ProgramError("El borrador no tiene días.");
  const { provinceId } = program;
  const { start, end } = monthBounds(program.year, program.month);

  const enabled = await prisma.provinceLotteryAvailability.findMany({
    where: { provinceId, enabled: true },
    select: { lottery: { select: { code: true } } },
  });
  const codes = new Set(enabled.map((l) => l.lottery.code));
  const unknown = [...new Set(draft.days.flatMap((d) => d.draws.flatMap((dr) => dr.lotteries.map((l) => l.code))))].filter((c) => !codes.has(c));
  if (unknown.length) throw new ProgramError(`Loterías del programa que la provincia no tiene habilitadas: ${unknown.join(", ")}.`);

  const pdf = pdfMonth(draft, start, end);
  const operating = datesBetween(start, end).filter((d) => pdf.has(d));
  const rulesBefore = await loadRules(provinceId);
  const notes: string[] = [];

  // 1. Usual week: per draw, lottery and weekday, a value that holds until the end of the
  //    month (at least twice) changes the week from the first date it holds.
  const keySet = new Set<string>();
  for (const slots of pdf.values()) for (const [slot, s] of slots) for (const code of s.lotteries.keys()) keySet.add(`${slot}|${code}`);
  for (const r of rulesBefore) if (r.from <= end && (r.to === null || r.to >= start)) keySet.add(`${r.slot}|${r.lottery}`);
  let rules = rulesBefore;
  const ruleChanges: RuleChange[] = [];
  for (const key of [...keySet].sort()) {
    const [slot, code] = key.split("|") as [Slot, string];
    const pv = (d: string) => {
      const s = pdf.get(d)?.get(slot);
      return s?.lotteries.has(code) ? s.time : null;
    };
    const rv = (d: string) =>
      rulesBefore.find((r) => r.slot === slot && r.lottery === code && r.weekday === weekdayOf(d) && ruleActive(r, d))?.time ?? null;
    for (let weekday = 0; weekday < 7; weekday++) {
      const seq = operating.filter((d) => weekdayOf(d) === weekday);
      if (seq.length < 2) continue;
      const v = pv(seq[seq.length - 1]);
      let c = seq.length - 1;
      while (c > 0 && pv(seq[c - 1]) === v) c--;
      if (seq.length - c < 2) continue;
      if (seq.slice(c).every((d) => rv(d) === v)) continue;
      const from = c === 0 ? start : seq[c];
      rules = setFrom(rules, { slot, lottery: code, weekday, from, time: v }, end);
      ruleChanges.push({ slot, lottery: code, weekday, from, time: v, previous: rv(seq[seq.length - 1]) });
    }
  }

  // 2. Date exceptions: whatever the new week does not explain.
  const exceptions: Exception[] = [];
  const base = (date: string, action: Exception["action"], slot: Slot | null = null, lottery: string | null = null, time: string | null = null): Exception => ({
    date,
    action,
    slot,
    lottery,
    time,
    prizeExpiry: null,
    source: "PROGRAM",
  });
  for (const date of datesBetween(start, end)) {
    const expected = heldOn(date, rules, []);
    const p = pdf.get(date);
    if (!p) {
      if (expected.length) exceptions.push({ ...base(date, "SKIP"), note: "Sin sorteos en el programa oficial" });
      continue;
    }
    const day: Exception[] = [];
    for (const slot of SLOT_ORDER) {
      const e = expected.find((x) => x.slot === slot);
      const ps = p.get(slot);
      if (e && !ps) day.push(base(date, "SKIP", slot));
      if (!ps) continue;
      for (const code of e?.lotteries ?? []) if (!ps.lotteries.has(code)) day.push(base(date, "SKIP", slot, code));
      for (const code of ps.lotteries.keys()) if (!e?.lotteries.includes(code)) day.push(base(date, "ADD", slot, code, ps.time));
    }
    const now = heldOn(date, rules, day);
    for (const [slot, ps] of p) {
      const h = now.find((x) => x.slot === slot);
      if (h && h.time !== ps.time) day.push(base(date, "TIME", slot, null, ps.time));
    }
    exceptions.push(...day);
  }

  // 3. Draw numbers: the month's first number of each lottery and draw.
  const anchors: Anchor[] = [];
  for (const key of keySet) {
    const [slot, code] = key.split("|") as [Slot, string];
    for (const date of operating) {
      const n = pdf.get(date)?.get(slot)?.lotteries.get(code);
      if (n === undefined || n === null) continue;
      anchors.push({ slot, lottery: code, date, number: n });
      break;
    }
  }

  // Calendars before/after, with the exceptions and anchors that stay (other months, manual).
  const game = await quinielaRules(provinceId);
  const [allAnchors, nearbyExceptions, holidays] = await Promise.all([
    loadAnchors(provinceId),
    loadExceptions(provinceId, addDays(start, -400), addDays(end, 400)),
    prisma.holiday.findMany({ where: { date: { gte: dateValue(start), lte: dateValue(addDays(end, 60)) } }, select: { date: true } }),
  ]);
  const inMonth = (d: string) => d >= start && d <= end;
  const keptExceptions = nearbyExceptions.filter((e) => !(inMonth(e.date) && e.source === "PROGRAM"));
  const keptAnchors = allAnchors.filter((a) => !(inMonth(a.date) && a.source === "PROGRAM"));
  const manualInMonth = keptExceptions.filter((e) => inMonth(e.date));
  if (manualInMonth.length) notes.push(`Hay ${manualInMonth.length} excepción(es) cargada(s) a mano en el mes: se mantienen y mandan sobre el programa.`);
  const data = (anchorsList: Anchor[], exceptionsList: Exception[]): CalendarData => ({
    rules,
    exceptions: exceptionsList,
    anchors: anchorsList,
    holidays: new Set(holidays.map((h) => isoDate(h.date))),
    prizeExpiryDays: game?.prizeExpiryDays ?? null,
    cutoffMinutes: game?.cutoffMinutes ?? null,
    confirmedMonths: new Set(),
  });

  // Prize expiry: only the dates where the program says something else than the rule.
  const expiryCal = new QuinielaCalendar(data([], [...keptExceptions, ...exceptions]));
  if (game?.prizeExpiryDays == null) notes.push("La provincia no tiene configurados los días de caducidad: no se calculan ni se guardan las caducidades.");
  else
    for (const day of draft.days) {
      if (!inMonth(day.date) || !day.prizeExpiry || !pdf.has(day.date)) continue;
      const rule = expiryCal.prizeExpiry(day.date);
      if (rule !== day.prizeExpiry) exceptions.push({ ...base(day.date, "PRIZE_EXPIRY"), prizeExpiry: day.prizeExpiry, note: rule ? `Por regla sería el ${dm(rule)}` : null });
    }

  // Numbers: does the month start where counting from the last known number says?
  const previous = new QuinielaCalendar(data(keptAnchors, [...keptExceptions, ...exceptions]));
  for (const a of anchors) {
    const expected = previous.drawNumber(a.slot, a.lottery, a.date);
    if (expected !== null && expected !== a.number)
      notes.push(`${who(a.slot, a.lottery)}: el programa arranca en n.º ${a.number} y contando desde el último número conocido daba ${expected}.`);
  }

  const known = new Set(anchors.map((a) => `${a.slot}|${a.lottery}|${a.date}`));
  const afterAnchors = [...keptAnchors.filter((a) => !known.has(`${a.slot}|${a.lottery}|${a.date}`)), ...anchors];
  const mismatches = compareMonth(new QuinielaCalendar(data(afterAnchors, [...keptExceptions, ...exceptions])), draft, start, end);
  return { start, end, rulesBefore, rulesAfter: rules, ruleChanges, exceptions, anchors, notes, mismatches };
}

/** Applies a DRAFT: usual week, exceptions and anchors; the month becomes confirmed. */
export async function publishProgram(programId: string) {
  const program = await prisma.provinceQuinielaMonthlyProgram.findUniqueOrThrow({ where: { id: programId } });
  if (program.status !== "DRAFT") throw new ProgramError("Solo se publica un borrador.");
  const plan = await planProgram(programId);
  const { provinceId } = program;
  const lotteries = await prisma.lottery.findMany({ select: { id: true, code: true } });
  const lotteryId = new Map(lotteries.map((l) => [l.code, l.id]));
  const month = { gte: dateValue(plan.start), lte: dateValue(plan.end) };

  await prisma.$transaction(
    async (tx) => {
      await tx.provinceQuinielaMonthlyProgram.updateMany({
        where: { provinceId, year: program.year, month: program.month, status: "PUBLISHED" },
        data: { status: "ARCHIVED" },
      });
      await tx.provinceQuinielaException.deleteMany({ where: { provinceId, date: month, source: "PROGRAM" } });
      await tx.provinceQuinielaDrawNumber.deleteMany({ where: { provinceId, date: month, source: "PROGRAM" } });
      await syncRules(tx, provinceId, plan.rulesBefore, plan.rulesAfter);
      await tx.provinceQuinielaException.createMany({
        data: plan.exceptions.map((e) => ({
          provinceId,
          date: dateValue(e.date),
          action: e.action,
          slot: e.slot,
          lotteryId: e.lottery ? lotteryId.get(e.lottery)! : null,
          drawTime: e.time ? timeValue(e.time) : null,
          prizeExpiry: e.prizeExpiry ? dateValue(e.prizeExpiry) : null,
          note: e.note ?? null,
          source: "PROGRAM" as const,
          programId,
        })),
      });
      // A number entered by hand for the same draw and date wins.
      await tx.provinceQuinielaDrawNumber.createMany({
        data: plan.anchors.map((a) => ({
          provinceId,
          slot: a.slot,
          lotteryId: lotteryId.get(a.lottery)!,
          date: dateValue(a.date),
          number: a.number,
          source: "PROGRAM" as const,
          programId,
        })),
        skipDuplicates: true,
      });
      await tx.provinceQuinielaMonthlyProgram.update({ where: { id: programId }, data: { status: "PUBLISHED", publishedAt: new Date() } });
    },
    { timeout: 60_000 },
  );
  return plan;
}

/** A published month: what the calendar resolves vs. the official program (should be empty). */
export async function checkProgram(programId: string) {
  const program = await prisma.provinceQuinielaMonthlyProgram.findUniqueOrThrow({ where: { id: programId } });
  const draft = program.draft as unknown as ProgramDraft | null;
  if (!draft) return [];
  const { start, end } = monthBounds(program.year, program.month);
  return compareMonth(await loadCalendar(program.provinceId, start, end), draft, start, end);
}

/** Discard a draft (kept as ARCHIVED for the record). */
export async function discardDraft(programId: string) {
  const program = await prisma.provinceQuinielaMonthlyProgram.findUniqueOrThrow({ where: { id: programId } });
  if (program.status !== "DRAFT") throw new ProgramError("Solo se descarta un borrador.");
  await prisma.provinceQuinielaMonthlyProgram.update({ where: { id: programId }, data: { status: "ARCHIVED" } });
}

/** Programs of a province, newest month first. */
export function provincePrograms(provinceId: string) {
  return prisma.provinceQuinielaMonthlyProgram.findMany({
    where: { provinceId },
    select: { id: true, year: true, month: true, version: true, status: true, publishedAt: true, createdAt: true, warnings: true, sourceUrl: true },
    orderBy: [{ year: "desc" }, { month: "desc" }, { version: "desc" }],
  });
}
