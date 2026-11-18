// Quiniela schedule of a province, resolved on demand (spec: province-quiniela-calendar).
// Nothing is stored day by day: a date is the usual week in force that day
// (ProvinceQuinielaDrawRule, valid from/until) plus that date's exceptions; draw numbers are
// counted from the nearest anchor (+1 every date a draw is held); prize expiry is the draw date
// + the province's days, moved to the next business day. The resolution is pure (works on plain
// data), so publishing a program can preview a month before writing anything.
import type { Prisma } from "@/generated/prisma/client";
import type { QuinielaDrawSlot, QuinielaExceptionAction, QuinielaExceptionSource } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { dateValue, timeValue } from "@/lib/schedule";

export type Slot = QuinielaDrawSlot;

export const SLOT_ORDER: Slot[] = ["PREVIA", "PRIMERA", "MATUTINA", "VESPERTINA", "NOCTURNA"];
export const SLOT_LABEL: Record<Slot, string> = {
  PREVIA: "La Previa",
  PRIMERA: "El Primero",
  MATUTINA: "Matutina",
  VESPERTINA: "Vespertina",
  NOCTURNA: "Nocturna",
};
export const LOTTERY_ORDER = ["PROVINCIA", "CIUDAD", "CORDOBA", "SANTA_FE", "ENTRE_RIOS", "MONTEVIDEO"];
export const LOTTERY_SHORT: Record<string, string> = {
  PROVINCIA: "Provincia",
  CIUDAD: "Ciudad",
  CORDOBA: "Córdoba",
  SANTA_FE: "Santa Fe",
  ENTRE_RIOS: "Entre Ríos",
  MONTEVIDEO: "Montevideo",
};
export const byLottery = (a: string, b: string) => {
  const ia = LOTTERY_ORDER.indexOf(a);
  const ib = LOTTERY_ORDER.indexOf(b);
  return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b);
};

// ─── Plain data ────────────────────────────────────────────────
// Dates are "YYYY-MM-DD", times "HH:MM", lotteries by code.

export type Rule = { id?: string; slot: Slot; lottery: string; weekday: number; time: string; from: string; to: string | null };
export type Exception = {
  id?: string;
  date: string;
  action: QuinielaExceptionAction;
  slot: Slot | null;
  lottery: string | null;
  time: string | null;
  prizeExpiry: string | null;
  note?: string | null;
  source?: QuinielaExceptionSource;
};
export type Anchor = { slot: Slot; lottery: string; date: string; number: number; source?: QuinielaExceptionSource };

export type HeldDraw = { slot: Slot; time: string; lotteries: string[] };
export type Draw = { slot: Slot; time: string; closeTime: string | null; lotteries: { code: string; drawNumber: number | null }[] };
export type Day = { date: string; draws: Draw[]; prizeExpiry: string | null; confirmed: boolean; exceptions: Exception[] };

// ─── Date helpers ──────────────────────────────────────────────

export const isoDate = (d: Date) => d.toISOString().slice(0, 10);
export const hhmm = (d: Date) => d.toISOString().slice(11, 16);
export const addDays = (iso: string, days: number) => isoDate(new Date(dateValue(iso).getTime() + days * 86_400_000));
export const weekdayOf = (iso: string) => dateValue(iso).getUTCDay();
export const monthBounds = (year: number, month: number) => {
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  return { start, end: addDays(isoDate(new Date(Date.UTC(year, month, 1))), -1) };
};
export function datesBetween(from: string, to: string) {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}
const minutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const fromMinutes = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

// ─── Resolution (pure) ─────────────────────────────────────────

export const ruleActive = (r: Rule, date: string) => r.from <= date && (r.to === null || r.to >= date);

/** Draws held on a date: the usual week in force that day, then that date's exceptions. */
export function heldOn(date: string, rules: Rule[], exceptions: Exception[]): HeldDraw[] {
  const wd = weekdayOf(date);
  const slots = new Map<Slot, Map<string, string>>(); // slot → lottery → time
  for (const r of rules) {
    if (r.weekday !== wd || !ruleActive(r, date)) continue;
    if (!slots.has(r.slot)) slots.set(r.slot, new Map());
    slots.get(r.slot)!.set(r.lottery, r.time);
  }
  const today = exceptions.filter((e) => e.date === date);
  // Skips first (a whole-day skip plus adds = "only these draws that day"), then adds.
  for (const e of today.filter((x) => x.action === "SKIP")) {
    if (!e.slot) slots.clear();
    else if (!e.lottery) slots.delete(e.slot);
    else slots.get(e.slot)?.delete(e.lottery);
  }
  for (const e of today.filter((x) => x.action === "ADD" && x.slot && x.lottery && x.time)) {
    if (!slots.has(e.slot!)) slots.set(e.slot!, new Map());
    slots.get(e.slot!)!.set(e.lottery!, e.time!);
  }
  const out: HeldDraw[] = [];
  for (const slot of SLOT_ORDER) {
    const lots = slots.get(slot);
    if (!lots?.size) continue;
    const moved = today.find((e) => e.action === "TIME" && e.slot === slot && e.time);
    const time = moved?.time ?? fromMinutes(Math.min(...[...lots.values()].map(minutes)));
    out.push({ slot, time, lotteries: [...lots.keys()].sort(byLottery) });
  }
  return out;
}

/** The usual week in force on a date (no exceptions): weekday → draws. */
export function weekAt(date: string, rules: Rule[]) {
  return [0, 1, 2, 3, 4, 5, 6].map((weekday) => {
    const slots = new Map<Slot, { time: string; lotteries: string[] }>();
    for (const r of rules) {
      if (r.weekday !== weekday || !ruleActive(r, date)) continue;
      const s = slots.get(r.slot) ?? { time: r.time, lotteries: [] };
      s.lotteries.push(r.lottery);
      if (minutes(r.time) < minutes(s.time)) s.time = r.time;
      slots.set(r.slot, s);
    }
    return { weekday, slots };
  });
}

export type CalendarData = {
  rules: Rule[];
  exceptions: Exception[];
  anchors: Anchor[];
  holidays: Set<string>;
  prizeExpiryDays: number | null;
  cutoffMinutes: number | null;
  confirmedMonths: Set<string>; // "2026-11": months with a published official program
};

export class QuinielaCalendar {
  private held = new Map<string, HeldDraw[]>();
  private anchorsByKey = new Map<string, Anchor[]>();
  constructor(readonly data: CalendarData) {
    for (const a of data.anchors) {
      const k = `${a.slot}|${a.lottery}`;
      this.anchorsByKey.set(k, [...(this.anchorsByKey.get(k) ?? []), a]);
    }
    for (const list of this.anchorsByKey.values()) list.sort((a, b) => a.date.localeCompare(b.date));
  }

  heldOn(date: string) {
    let h = this.held.get(date);
    if (!h) {
      h = heldOn(date, this.data.rules, this.data.exceptions);
      this.held.set(date, h);
    }
    return h;
  }

  private isHeld(slot: Slot, lottery: string, date: string) {
    return this.heldOn(date).some((d) => d.slot === slot && d.lotteries.includes(lottery));
  }

  /** Times a lottery's draw is held in (after, until]. */
  private countHeld(slot: Slot, lottery: string, after: string, until: string) {
    let n = 0;
    for (let d = addDays(after, 1); d <= until; d = addDays(d, 1)) if (this.isHeld(slot, lottery, d)) n++;
    return n;
  }

  /** Official number of a lottery's draw on a date it is held, counted from the nearest anchor. */
  drawNumber(slot: Slot, lottery: string, date: string): number | null {
    const anchors = this.anchorsByKey.get(`${slot}|${lottery}`);
    if (!anchors?.length) return null;
    const before = anchors.filter((a) => a.date <= date).at(-1);
    if (before) return before.number + this.countHeld(slot, lottery, before.date, date);
    const after = anchors[0];
    return after.number - this.countHeld(slot, lottery, date, after.date);
  }

  /** Prize expiry of a date's draws: + N days, moved past weekends and holidays; or its exception. */
  prizeExpiry(date: string): string | null {
    const ex = this.data.exceptions.find((e) => e.date === date && e.action === "PRIZE_EXPIRY");
    if (ex?.prizeExpiry) return ex.prizeExpiry;
    if (this.data.prizeExpiryDays === null) return null;
    let d = addDays(date, this.data.prizeExpiryDays);
    while (weekdayOf(d) === 0 || weekdayOf(d) === 6 || this.data.holidays.has(d)) d = addDays(d, 1);
    return d;
  }

  day(date: string): Day {
    const cutoff = this.data.cutoffMinutes;
    const draws = this.heldOn(date).map((h) => ({
      slot: h.slot,
      time: h.time,
      closeTime: cutoff !== null ? fromMinutes(minutes(h.time) - cutoff) : null,
      lotteries: h.lotteries.map((code) => ({ code, drawNumber: this.drawNumber(h.slot, code, date) })),
    }));
    return {
      date,
      draws,
      prizeExpiry: draws.length ? this.prizeExpiry(date) : null,
      confirmed: this.data.confirmedMonths.has(date.slice(0, 7)),
      exceptions: this.data.exceptions.filter((e) => e.date === date),
    };
  }

  days(from: string, to: string) {
    return datesBetween(from, to).map((d) => this.day(d));
  }
}

// ─── Loading ───────────────────────────────────────────────────

const ruleSelect = { id: true, slot: true, weekday: true, drawTime: true, validFrom: true, validTo: true, lottery: { select: { code: true } } } as const;
type RuleRow = Prisma.ProvinceQuinielaDrawRuleGetPayload<{ select: typeof ruleSelect }>;
export const toRule = (r: RuleRow): Rule => ({
  id: r.id,
  slot: r.slot,
  lottery: r.lottery.code,
  weekday: r.weekday,
  time: hhmm(r.drawTime),
  from: isoDate(r.validFrom),
  to: r.validTo ? isoDate(r.validTo) : null,
});

export async function loadRules(provinceId: string) {
  const rows = await prisma.provinceQuinielaDrawRule.findMany({ where: { provinceId }, select: ruleSelect });
  return rows.map(toRule);
}

export async function loadExceptions(provinceId: string, from: string, to: string) {
  const rows = await prisma.provinceQuinielaException.findMany({
    where: { provinceId, date: { gte: dateValue(from), lte: dateValue(to) } },
    include: { lottery: { select: { code: true } } },
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
  });
  return rows.map(
    (e): Exception => ({
      id: e.id,
      date: isoDate(e.date),
      action: e.action,
      slot: e.slot,
      lottery: e.lottery?.code ?? null,
      time: e.drawTime ? hhmm(e.drawTime) : null,
      prizeExpiry: e.prizeExpiry ? isoDate(e.prizeExpiry) : null,
      note: e.note,
      source: e.source,
    }),
  );
}

export async function loadAnchors(provinceId: string) {
  const rows = await prisma.provinceQuinielaDrawNumber.findMany({
    where: { provinceId },
    include: { lottery: { select: { code: true } } },
    orderBy: { date: "asc" },
  });
  return rows.map((a): Anchor => ({ slot: a.slot, lottery: a.lottery.code, date: isoDate(a.date), number: a.number, source: a.source }));
}

export async function quinielaRules(provinceId: string) {
  return prisma.provinceGameAvailability.findFirst({
    where: { provinceId, game: { code: "QUINIELA" } },
    select: { cutoffMinutes: true, prizeExpiryDays: true, maxBetAmount: true },
  });
}

/**
 * Everything needed to resolve dates in [from, to] of a province, including draw numbers
 * (exceptions are loaded from the nearest anchors, so counting is exact).
 */
export async function loadCalendar(provinceId: string, from: string, to: string) {
  const [rules, anchors, game, programs] = await Promise.all([
    loadRules(provinceId),
    loadAnchors(provinceId),
    quinielaRules(provinceId),
    prisma.provinceQuinielaMonthlyProgram.findMany({ where: { provinceId, status: "PUBLISHED" }, select: { year: true, month: true } }),
  ]);
  let lo = from;
  let hi = to;
  const keys = new Set(anchors.map((a) => `${a.slot}|${a.lottery}`));
  for (const k of keys) {
    const list = anchors.filter((a) => `${a.slot}|${a.lottery}` === k);
    const before = list.filter((a) => a.date <= from).at(-1);
    if (before) lo = before.date < lo ? before.date : lo;
    else if (list[0].date > hi) hi = list[0].date;
  }
  const [exceptions, holidays] = await Promise.all([
    loadExceptions(provinceId, lo, hi),
    prisma.holiday.findMany({ where: { date: { gte: dateValue(lo), lte: dateValue(addDays(hi, 45)) } }, select: { date: true } }),
  ]);
  return new QuinielaCalendar({
    rules,
    exceptions,
    anchors,
    holidays: new Set(holidays.map((h) => isoDate(h.date))),
    prizeExpiryDays: game?.prizeExpiryDays ?? null,
    cutoffMinutes: game?.cutoffMinutes ?? null,
    confirmedMonths: new Set(programs.map((p) => `${p.year}-${String(p.month).padStart(2, "0")}`)),
  });
}

/** Draws of a province on a date (usual week + exceptions), with numbers and prize expiry. */
export async function drawsOn(provinceId: string, date: string) {
  return (await loadCalendar(provinceId, date, date)).day(date);
}

// ─── Changing the usual week ───────────────────────────────────

/**
 * A lottery's draw on one weekday, from a date: at `time`, or not held (`time` null).
 * Rows that started on/after `from` are dropped (except those after `keepAfter`, e.g. changes
 * already set for a later month), rows in force are closed the day before. Pure: returns the
 * new rule list.
 */
export function setFrom(
  rules: Rule[],
  change: { slot: Slot; lottery: string; weekday: number; from: string; time: string | null },
  keepAfter: string | null = null,
): Rule[] {
  const same = (r: Rule) => r.slot === change.slot && r.lottery === change.lottery && r.weekday === change.weekday;
  const kept = (r: Rule) => keepAfter !== null && r.from > keepAfter;
  const out: Rule[] = [];
  let nextKept: string | null = null;
  for (const r of rules) {
    if (!same(r)) {
      out.push(r);
      continue;
    }
    if (kept(r)) {
      out.push(r);
      if (nextKept === null || r.from < nextKept) nextKept = r.from;
      continue;
    }
    if (r.from >= change.from) continue; // replaced
    out.push(r.to === null || r.to >= change.from ? { ...r, to: addDays(change.from, -1) } : r);
  }
  if (change.time !== null)
    out.push({
      slot: change.slot,
      lottery: change.lottery,
      weekday: change.weekday,
      time: change.time,
      from: change.from,
      to: nextKept ? addDays(nextKept, -1) : null,
    });
  return out;
}

/** Writes the difference between two rule lists (by id: removed, closed/changed, new). */
export async function syncRules(tx: Prisma.TransactionClient, provinceId: string, before: Rule[], after: Rule[]) {
  const lotteries = await tx.lottery.findMany({ select: { id: true, code: true } });
  const lotteryId = new Map(lotteries.map((l) => [l.code, l.id]));
  const afterById = new Map(after.filter((r) => r.id).map((r) => [r.id!, r]));
  const removed = before.filter((r) => r.id && !afterById.has(r.id)).map((r) => r.id!);
  if (removed.length) await tx.provinceQuinielaDrawRule.deleteMany({ where: { id: { in: removed } } });
  for (const r of before) {
    const a = r.id ? afterById.get(r.id) : undefined;
    if (a && (a.to !== r.to || a.time !== r.time || a.from !== r.from))
      await tx.provinceQuinielaDrawRule.update({
        where: { id: r.id },
        data: { validTo: a.to ? dateValue(a.to) : null, validFrom: dateValue(a.from), drawTime: timeValue(a.time) },
      });
  }
  const created = after.filter((r) => !r.id);
  if (created.length)
    await tx.provinceQuinielaDrawRule.createMany({
      data: created.map((r) => {
        const id = lotteryId.get(r.lottery);
        if (!id) throw new Error(`Lotería desconocida: ${r.lottery}`);
        return {
          provinceId,
          slot: r.slot,
          lotteryId: id,
          weekday: r.weekday,
          drawTime: timeValue(r.time),
          validFrom: dateValue(r.from),
          validTo: r.to ? dateValue(r.to) : null,
        };
      }),
    });
}

// ─── Plain-language descriptions (admin screens) ───────────────

export const WEEKDAY_SHORT = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

/** [1,2,3,4,5] → "lun a vie"; [1,3] → "lun y mié". */
export function weekdaysText(days: number[]) {
  const s = [...new Set(days)].sort((a, b) => (a || 7) - (b || 7));
  const order = s.map((d) => d || 7);
  if (s.length > 2 && order.every((d, i) => i === 0 || d === order[i - 1] + 1)) return `${WEEKDAY_SHORT[s[0]]} a ${WEEKDAY_SHORT[s[s.length - 1]]}`;
  const names = s.map((d) => WEEKDAY_SHORT[d]);
  return names.length > 1 ? `${names.slice(0, -1).join(", ")} y ${names[names.length - 1]}` : (names[0] ?? "");
}

const lotteryName = (code: string | null) => (code ? (LOTTERY_SHORT[code] ?? code) : "");
const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

/** What an exception means, in words: "Entre Ríos no juega en la Matutina". */
export function describeException(e: Exception) {
  const slot = e.slot ? SLOT_LABEL[e.slot] : "";
  switch (e.action) {
    case "SKIP":
      if (!e.slot) return "No hay sorteos";
      if (!e.lottery) return `No se hace ${slot}`;
      return `${lotteryName(e.lottery)} no juega en ${slot}`;
    case "ADD":
      return `${lotteryName(e.lottery)} se suma a ${slot} (${e.time})`;
    case "TIME":
      return `${slot} pasa a las ${e.time}`;
    case "PRIZE_EXPIRY":
      return `Los premios caducan el ${e.prizeExpiry ? ddmm(e.prizeExpiry) : "?"}`;
  }
}

/**
 * The usual week in force on a date, per draw: its time, the days it runs and its lotteries
 * (those that do not run every one of those days carry their own days).
 */
export function usualWeek(date: string, rules: Rule[]) {
  return SLOT_ORDER.map((slot) => {
    const active = rules.filter((r) => r.slot === slot && ruleActive(r, date));
    const days = [...new Set(active.map((r) => r.weekday))];
    const times = new Map<string, number>();
    for (const r of active) times.set(r.time, (times.get(r.time) ?? 0) + 1);
    const time = [...times.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    const byLot = new Map<string, number[]>();
    for (const r of active) byLot.set(r.lottery, [...(byLot.get(r.lottery) ?? []), r.weekday]);
    const lotteries = [...byLot.entries()]
      .sort((a, b) => byLottery(a[0], b[0]))
      .map(([code, wds]) => ({ code, name: lotteryName(code), days: wds.length === days.length ? null : weekdaysText(wds) }));
    const otherTimes = active.filter((r) => r.time !== time).map((r) => `${WEEKDAY_SHORT[r.weekday]} ${r.time}`);
    return { slot, label: SLOT_LABEL[slot], time, days: weekdaysText(days), lotteries, otherTimes: [...new Set(otherTimes)] };
  }).filter((s) => s.time !== null);
}

export class CalendarError extends Error {}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Admin: a lottery takes part in a draw on these weekdays at a time from a date, or leaves it (time null). */
export async function setLotteryInDraw(input: {
  provinceId: string;
  slot: Slot;
  lottery: string;
  weekdays: number[];
  time: string | null;
  from: string;
}) {
  if (!DATE_RE.test(input.from)) throw new CalendarError("Elegí desde qué fecha.");
  if (input.time !== null && !TIME_RE.test(input.time)) throw new CalendarError("El horario va como 15:00.");
  if (!input.weekdays.length) throw new CalendarError("Elegí al menos un día de la semana.");
  const enabled = await prisma.provinceLotteryAvailability.findFirst({
    where: { provinceId: input.provinceId, enabled: true, lottery: { code: input.lottery } },
  });
  if (!enabled) throw new CalendarError("Esa lotería no está habilitada en la provincia.");
  const before = await loadRules(input.provinceId);
  let after = before;
  for (const weekday of input.weekdays) after = setFrom(after, { slot: input.slot, lottery: input.lottery, weekday, from: input.from, time: input.time });
  await prisma.$transaction((tx) => syncRules(tx, input.provinceId, before, after));
}

/** Admin: a draw moves to another time from a date (every lottery in it, on those weekdays). */
export async function setDrawTime(input: { provinceId: string; slot: Slot; weekdays: number[]; time: string; from: string }) {
  if (!DATE_RE.test(input.from)) throw new CalendarError("Elegí desde qué fecha.");
  if (!TIME_RE.test(input.time)) throw new CalendarError("El horario va como 15:00.");
  if (!input.weekdays.length) throw new CalendarError("Elegí al menos un día de la semana.");
  const before = await loadRules(input.provinceId);
  let after = before;
  let changed = 0;
  for (const weekday of input.weekdays)
    for (const r of before.filter((x) => x.slot === input.slot && x.weekday === weekday && ruleActive(x, input.from))) {
      after = setFrom(after, { slot: r.slot, lottery: r.lottery, weekday, from: input.from, time: input.time });
      changed++;
    }
  if (!changed) throw new CalendarError("Ese sorteo no se hace esos días.");
  await prisma.$transaction((tx) => syncRules(tx, input.provinceId, before, after));
}

/** Admin: one date that differs from the usual week. */
export async function addException(input: {
  provinceId: string;
  date: string;
  action: QuinielaExceptionAction;
  slot: Slot | null;
  lottery: string | null;
  time: string | null;
  prizeExpiry: string | null;
  note: string | null;
}) {
  if (!DATE_RE.test(input.date)) throw new CalendarError("Elegí la fecha.");
  const { action, slot, lottery, time } = input;
  if (action === "ADD" && (!slot || !lottery || !time)) throw new CalendarError("Para sumar una lotería elegí el sorteo, la lotería y el horario.");
  if (action === "TIME" && (!slot || !time)) throw new CalendarError("Para cambiar el horario elegí el sorteo y el horario.");
  if (action === "SKIP" && lottery && !slot) throw new CalendarError("Para sacar una lotería elegí también el sorteo.");
  if (action === "PRIZE_EXPIRY" && !input.prizeExpiry) throw new CalendarError("Elegí la fecha de caducidad.");
  if (time && !TIME_RE.test(time)) throw new CalendarError("El horario va como 15:00.");
  const lotteryRow = lottery ? await prisma.lottery.findUnique({ where: { code: lottery } }) : null;
  if (lottery && !lotteryRow) throw new CalendarError("Lotería desconocida.");
  await prisma.provinceQuinielaException.create({
    data: {
      provinceId: input.provinceId,
      date: dateValue(input.date),
      action,
      slot: action === "PRIZE_EXPIRY" ? null : slot,
      lotteryId: action === "SKIP" || action === "ADD" ? (lotteryRow?.id ?? null) : null,
      drawTime: action === "ADD" || action === "TIME" ? timeValue(time!) : null,
      prizeExpiry: action === "PRIZE_EXPIRY" ? dateValue(input.prizeExpiry!) : null,
      note: input.note?.trim() || null,
      source: "MANUAL",
    },
  });
}

export async function deleteException(id: string) {
  await prisma.provinceQuinielaException.delete({ where: { id } });
}

/** Admin: a known official draw number (other dates are counted from it). */
export async function setDrawNumber(input: { provinceId: string; slot: Slot; lottery: string; date: string; number: number }) {
  if (!DATE_RE.test(input.date)) throw new CalendarError("Elegí la fecha.");
  if (!Number.isInteger(input.number) || input.number <= 0) throw new CalendarError("El número de sorteo tiene que ser un entero positivo.");
  const lottery = await prisma.lottery.findUnique({ where: { code: input.lottery } });
  if (!lottery) throw new CalendarError("Lotería desconocida.");
  const cal = await loadCalendar(input.provinceId, input.date, input.date);
  if (!cal.day(input.date).draws.some((d) => d.slot === input.slot && d.lotteries.some((l) => l.code === input.lottery)))
    throw new CalendarError("Ese día no hay ese sorteo para esa lotería.");
  const key = { provinceId: input.provinceId, slot: input.slot, lotteryId: lottery.id, date: dateValue(input.date) };
  await prisma.provinceQuinielaDrawNumber.upsert({
    where: { provinceId_slot_lotteryId_date: key },
    create: { ...key, number: input.number, source: "MANUAL" },
    update: { number: input.number, source: "MANUAL", programId: null },
  });
}
