// Agency opening hours (spec: agency-schedule).
//
// Resolution order for a given local date:
//   1. the agency's own exception        (closed or special hours)
//   2. the template's exception           (if the agency uses a template)
//   3. weekly hours: the agency's own rules when personalized (customHours) or without a
//      general schedule, else the general schedule's
// An agency NORMAL_HOURS exception cancels the general schedule's exception for that agency.
// Holidays are reference only: reported, never applied.
//
// Times are stored as wall-clock TIME values (1970-01-01Txx:xx UTC) and dates as DATE
// (UTC midnight). "Now" is converted to the agency's time zone before comparing.
import type { ScheduleExceptionKind } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

export type Range = { opensAt: string; closesAt: string }; // "HH:MM"

export type DaySource = "AGENCY_EXCEPTION" | "TEMPLATE_EXCEPTION" | "AGENCY_WEEKLY" | "TEMPLATE_WEEKLY";

export type DaySchedule = {
  date: string; // YYYY-MM-DD (agency local date)
  source: DaySource;
  closed: boolean; // true when there are no ranges that day
  ranges: Range[];
  reason: string | null;
  holiday: { name: string; kind: string } | null; // national holiday on that date, if any
  holidayWithoutException: boolean; // a holiday that falls back to weekly hours: warn the owner
};

// ─── Time helpers ──────────────────────────────────────────────

const pad = (n: number) => String(n).padStart(2, "0");
const timeToMinutes = (t: Date) => t.getUTCHours() * 60 + t.getUTCMinutes();
const timeToHHMM = (t: Date) => `${pad(t.getUTCHours())}:${pad(t.getUTCMinutes())}`;
const hhmmToMinutes = (s: string) => {
  const [h, m] = s.split(":").map(Number);
  return h * 60 + m;
};
/** "HH:MM" -> Date for a TIME column. */
export const timeValue = (hhmm: string) => new Date(`1970-01-01T${hhmm}:00.000Z`);
/** "YYYY-MM-DD" -> Date for a DATE column. */
export const dateValue = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

/** Local calendar date, weekday (0 = Sunday) and minutes since midnight in a time zone. */
export function localParts(at: Date, timeZone: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
      weekday: "short",
    })
      .formatToParts(at)
      .map((p) => [p.type, p.value]),
  );
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.weekday);
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    weekday,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

const weekdayOf = (iso: string) => dateValue(iso).getUTCDay();
const sortRanges = (r: Range[]) => [...r].sort((a, b) => hhmmToMinutes(a.opensAt) - hhmmToMinutes(b.opensAt));

// ─── Resolution ────────────────────────────────────────────────

/** Schedule of an agency for one local date (YYYY-MM-DD). */
export async function getDaySchedule(agencyId: string, date: string): Promise<DaySchedule> {
  const day = dateValue(date);
  const weekday = weekdayOf(date);
  const covering = { startDate: { lte: day }, endDate: { gte: day } };
  const exceptionInclude = { slots: true } as const;

  const agency = await prisma.agency.findUniqueOrThrow({
    where: { id: agencyId },
    select: {
      scheduleTemplateId: true,
      customHours: true,
      scheduleRules: { where: { weekday } },
      scheduleExceptions: { where: covering, include: exceptionInclude, orderBy: { createdAt: "desc" }, take: 1 },
      scheduleTemplate: {
        select: {
          rules: { where: { weekday } },
          exceptions: { where: covering, include: exceptionInclude, orderBy: { createdAt: "desc" }, take: 1 },
        },
      },
    },
  });
  const holidayRow = await prisma.holiday.findFirst({ where: { date: day }, select: { name: true, kind: true } });

  const fromException = (
    source: DaySource,
    e: { kind: ScheduleExceptionKind; reason: string | null; slots: { opensAt: Date; closesAt: Date }[] },
  ): DaySchedule => {
    const ranges = e.kind === "CLOSED" ? [] : sortRanges(e.slots.map(toRange));
    return { date, source, closed: ranges.length === 0, ranges, reason: e.reason, holiday: holidayRow, holidayWithoutException: false };
  };

  // 1. Agency exception. NORMAL_HOURS cancels the general schedule's exception for
  //    this agency and falls through to its weekly hours.
  const agencyException = agency.scheduleExceptions[0];
  const overridesGeneral = agencyException?.kind === "NORMAL_HOURS";
  if (agencyException && !overridesGeneral) return fromException("AGENCY_EXCEPTION", agencyException);

  // 2. General schedule exception (applies to every linked agency, personalized or not).
  const templateException = overridesGeneral ? undefined : agency.scheduleTemplate?.exceptions[0];
  if (templateException) return fromException("TEMPLATE_EXCEPTION", templateException);

  // 3. Weekly hours: own when personalized (or no general schedule), else inherited.
  const inherits = Boolean(agency.scheduleTemplate) && !agency.customHours;
  const rules = inherits ? agency.scheduleTemplate!.rules : agency.scheduleRules;
  const ranges = sortRanges(rules.map(toRange));
  return {
    date,
    source: inherits ? "TEMPLATE_WEEKLY" : "AGENCY_WEEKLY",
    closed: ranges.length === 0,
    ranges,
    reason: overridesGeneral ? (agencyException.reason ?? "Horario habitual") : null,
    holiday: holidayRow,
    holidayWithoutException: Boolean(holidayRow) && !overridesGeneral,
  };
}

function toRange(r: { opensAt: Date; closesAt: Date }): Range {
  return { opensAt: timeToHHMM(r.opensAt), closesAt: timeToHHMM(r.closesAt) };
}

/** Is the agency open at a moment (default: now), in the agency's own time zone? */
export async function isAgencyOpen(agencyId: string, at: Date = new Date()) {
  const { timezone } = await prisma.agency.findUniqueOrThrow({ where: { id: agencyId }, select: { timezone: true } });
  const local = localParts(at, timezone);
  const day = await getDaySchedule(agencyId, local.date);
  const current = day.ranges.find(
    (r) => local.minutes >= hhmmToMinutes(r.opensAt) && local.minutes < hhmmToMinutes(r.closesAt),
  );
  const next = day.ranges.find((r) => hhmmToMinutes(r.opensAt) > local.minutes);
  return {
    open: Boolean(current),
    closesAt: current?.closesAt ?? null,
    opensNextAt: current ? null : (next?.opensAt ?? null), // later today, if any
    localTime: `${pad(Math.floor(local.minutes / 60))}:${pad(local.minutes % 60)}`,
    ...day,
  };
}

// ─── Writes (validated here: MySQL cannot enforce the scope rule) ──

export type ExceptionInput = {
  agencyId?: string | null;
  templateId?: string | null;
  startDate: string; // YYYY-MM-DD
  endDate?: string; // defaults to startDate
  kind: ScheduleExceptionKind;
  reason?: string | null;
  holidayId?: string | null;
  slots?: Range[];
};

export class ScheduleValidationError extends Error {}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Validates ranges: well-formed, opens < closes, no overlaps. */
export function validateRanges(ranges: Range[]) {
  for (const r of ranges) {
    if (!HHMM.test(r.opensAt) || !HHMM.test(r.closesAt)) throw new ScheduleValidationError("Horario inválido (HH:MM).");
    if (hhmmToMinutes(r.closesAt) <= hhmmToMinutes(r.opensAt))
      throw new ScheduleValidationError(`El tramo ${r.opensAt}–${r.closesAt} cierra antes de abrir.`);
  }
  const sorted = sortRanges(ranges);
  for (let i = 1; i < sorted.length; i++) {
    if (hhmmToMinutes(sorted[i].opensAt) < hhmmToMinutes(sorted[i - 1].closesAt))
      throw new ScheduleValidationError(`Los tramos ${sorted[i - 1].opensAt}–${sorted[i - 1].closesAt} y ${sorted[i].opensAt}–${sorted[i].closesAt} se superponen.`);
  }
}

export function validateException(input: ExceptionInput) {
  if (Boolean(input.agencyId) === Boolean(input.templateId))
    throw new ScheduleValidationError("La excepción debe ser de una agencia o de una plantilla (una sola).");
  const end = input.endDate ?? input.startDate;
  if (!ISO_DATE.test(input.startDate) || !ISO_DATE.test(end)) throw new ScheduleValidationError("Fecha inválida.");
  if (end < input.startDate) throw new ScheduleValidationError("La fecha de fin es anterior a la de inicio.");
  const slots = input.slots ?? [];
  if (input.kind === "NORMAL_HOURS" && !input.agencyId)
    throw new ScheduleValidationError("«Horario habitual» solo se usa en una agencia, para anular una excepción del general.");
  if (input.kind !== "SPECIAL_HOURS" && slots.length > 0)
    throw new ScheduleValidationError("Un día cerrado no lleva horarios.");
  if (input.kind === "SPECIAL_HOURS") {
    if (slots.length === 0) throw new ScheduleValidationError("El horario especial necesita al menos un tramo.");
    validateRanges(slots);
  }
}

export async function createScheduleException(input: ExceptionInput) {
  validateException(input);
  return prisma.scheduleException.create({
    data: {
      agencyId: input.agencyId ?? null,
      templateId: input.templateId ?? null,
      startDate: dateValue(input.startDate),
      endDate: dateValue(input.endDate ?? input.startDate),
      kind: input.kind,
      reason: input.reason ?? null,
      holidayId: input.holidayId ?? null,
      slots: { create: (input.slots ?? []).map((s) => ({ opensAt: timeValue(s.opensAt), closesAt: timeValue(s.closesAt) })) },
    },
  });
}

/** One-click "turn this holiday into an exception" for a template or one agency. */
export async function exceptionFromHoliday(
  holidayId: string,
  scope: { agencyId: string } | { templateId: string },
  kind: ScheduleExceptionKind = "CLOSED",
  slots: Range[] = [],
) {
  const holiday = await prisma.holiday.findUniqueOrThrow({ where: { id: holidayId } });
  const iso = holiday.date.toISOString().slice(0, 10);
  return createScheduleException({
    ...scope,
    startDate: iso,
    kind,
    slots,
    reason: `Feriado: ${holiday.name}`,
    holidayId,
  });
}

// ─── Read helpers for the panel ────────────────────────────────

export type ScheduleScope = { agencyId: string } | { templateId: string };

/** Week as 7 arrays indexed by weekday (0 = Sunday). */
export type Week = Range[][];

/** UI order for Argentina: Monday first. */
export const WEEKDAYS_UI = [
  { day: 1, label: "Lunes" },
  { day: 2, label: "Martes" },
  { day: 3, label: "Miércoles" },
  { day: 4, label: "Jueves" },
  { day: 5, label: "Viernes" },
  { day: 6, label: "Sábado" },
  { day: 0, label: "Domingo" },
] as const;

export async function getWeek(scope: ScheduleScope): Promise<Week> {
  const rules =
    "agencyId" in scope
      ? await prisma.agencyScheduleRule.findMany({ where: { agencyId: scope.agencyId } })
      : await prisma.scheduleTemplateRule.findMany({ where: { templateId: scope.templateId } });
  const week: Week = [[], [], [], [], [], [], []];
  for (const r of rules) week[r.weekday].push(toRange(r));
  return week.map(sortRanges);
}

/** Exceptions of a scope that end on or after `fromDate`, soonest first. */
export async function upcomingExceptions(scope: ScheduleScope, fromDate: string, limit = 50) {
  const rows = await prisma.scheduleException.findMany({
    where: { ...scope, endDate: { gte: dateValue(fromDate) } },
    include: { slots: true },
    orderBy: { startDate: "asc" },
    take: limit,
  });
  return rows.map((e) => ({
    id: e.id,
    startDate: e.startDate.toISOString().slice(0, 10),
    endDate: e.endDate.toISOString().slice(0, 10),
    kind: e.kind,
    reason: e.reason,
    holidayId: e.holidayId,
    slots: sortRanges(e.slots.map(toRange)),
  }));
}

/** National holidays from `fromDate` for `days` days, flagged when the scope(s) already cover them. */
export async function upcomingHolidays(scopes: ScheduleScope[], fromDate: string, days = 180) {
  const from = dateValue(fromDate);
  const to = new Date(from.getTime() + days * 86_400_000);
  const holidays = await prisma.holiday.findMany({ where: { date: { gte: from, lte: to } }, orderBy: { date: "asc" } });
  const covering = scopes.length
    ? await prisma.scheduleException.findMany({
        where: { OR: scopes, startDate: { lte: to }, endDate: { gte: from } },
        select: { startDate: true, endDate: true },
      })
    : [];
  return holidays.map((h) => ({
    id: h.id,
    date: h.date.toISOString().slice(0, 10),
    name: h.name,
    kind: h.kind,
    covered: covering.some((e) => e.startDate <= h.date && e.endDate >= h.date),
  }));
}

/** Today's date in a time zone (YYYY-MM-DD). */
export const todayIn = (timeZone: string) => localParts(new Date(), timeZone).date;

// ─── Write helpers for the panel ───────────────────────────────

/** Replace the weekly hours of an agency (own rules) or a template. */
export async function replaceWeek(scope: ScheduleScope, week: Week) {
  if (week.length !== 7) throw new ScheduleValidationError("La semana debe tener 7 días.");
  week.forEach((ranges) => validateRanges(ranges));
  const rows = week.flatMap((ranges, weekday) =>
    ranges.map((r) => ({ weekday, opensAt: timeValue(r.opensAt), closesAt: timeValue(r.closesAt) })),
  );
  if ("agencyId" in scope) {
    await prisma.$transaction([
      prisma.agencyScheduleRule.deleteMany({ where: { agencyId: scope.agencyId } }),
      prisma.agencyScheduleRule.createMany({ data: rows.map((r) => ({ ...r, agencyId: scope.agencyId })) }),
    ]);
  } else {
    await prisma.$transaction([
      prisma.scheduleTemplateRule.deleteMany({ where: { templateId: scope.templateId } }),
      prisma.scheduleTemplateRule.createMany({ data: rows.map((r) => ({ ...r, templateId: scope.templateId })) }),
    ]);
  }
}

/** Parse the JSON a weekly editor posts; throws ScheduleValidationError on bad input. */
export function parseWeek(json: unknown): Week {
  let data: unknown;
  try {
    data = typeof json === "string" ? JSON.parse(json) : json;
  } catch {
    throw new ScheduleValidationError("No se pudo leer el horario.");
  }
  if (!Array.isArray(data) || data.length !== 7) throw new ScheduleValidationError("La semana debe tener 7 días.");
  return data.map((day) => {
    if (!Array.isArray(day)) throw new ScheduleValidationError("Horario inválido.");
    return day.map((r) => ({ opensAt: String(r?.opensAt ?? ""), closesAt: String(r?.closesAt ?? "") }));
  });
}

/** Human summary of ranges: "08:00–13:00 y 16:00–20:30" or "Cerrado". */
export const formatRanges = (ranges: Range[]) =>
  ranges.length ? ranges.map((r) => `${r.opensAt}–${r.closesAt}`).join(" y ") : "Cerrado";

// ─── General schedule (one per group, spec agency-groups) ──────

/** The group's "Horario general"; created on first use. */
export async function ensureGeneral(groupId: string) {
  return prisma.scheduleTemplate.upsert({
    where: { groupId },
    create: { groupId },
    update: {},
  });
}

/** Group that owns the agency (null only before the agency-groups migration). */
export async function agencyGroupId(agencyId: string) {
  const agency = await prisma.agency.findUnique({ where: { id: agencyId }, select: { groupId: true } });
  return agency?.groupId ?? null;
}

/** Active agencies of a group. */
export function agenciesOfGroup(groupId: string) {
  return prisma.agency.findMany({
    where: { active: true, groupId },
    select: { id: true, name: true, scheduleTemplateId: true, customHours: true, _count: { select: { scheduleRules: true } } },
    orderBy: { name: "asc" },
  });
}

/** Link the group's agencies to its general schedule. Agencies that already had their own
 *  hours keep them (personalized); the rest inherit the general weekly hours. */
export async function linkUnscheduledAgencies(groupId: string, templateId: string) {
  const agencies = (await agenciesOfGroup(groupId)).filter((a) => a.scheduleTemplateId !== templateId);
  for (const a of agencies)
    await prisma.agency.update({
      where: { id: a.id },
      data: { scheduleTemplateId: templateId, customHours: a.customHours || a._count.scheduleRules > 0 },
    });
  return agencies.filter((a) => !a.customHours && a._count.scheduleRules === 0).length;
}

/** Text for an exception row. */
export const describeException = (e: { kind: ScheduleExceptionKind; slots: Range[] }) =>
  e.kind === "CLOSED" ? "Cerrado" : e.kind === "NORMAL_HOURS" ? "Abre con horario habitual" : formatRanges(e.slots);
