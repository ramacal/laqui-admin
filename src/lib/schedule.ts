// Agency opening hours (spec: agency-schedule).
//
// Resolution order for a given local date:
//   1. the agency's own exception        (closed or special hours)
//   2. the template's exception           (if the agency uses a template)
//   3. weekly hours: the agency's own rules when it has no template, else the template's
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

  const agencyException = agency.scheduleExceptions[0];
  if (agencyException) return fromException("AGENCY_EXCEPTION", agencyException);

  const templateException = agency.scheduleTemplate?.exceptions[0];
  if (templateException) return fromException("TEMPLATE_EXCEPTION", templateException);

  const usesTemplate = Boolean(agency.scheduleTemplateId && agency.scheduleTemplate);
  const rules = usesTemplate ? agency.scheduleTemplate!.rules : agency.scheduleRules;
  const ranges = sortRanges(rules.map(toRange));
  return {
    date,
    source: usesTemplate ? "TEMPLATE_WEEKLY" : "AGENCY_WEEKLY",
    closed: ranges.length === 0,
    ranges,
    reason: null,
    holiday: holidayRow,
    holidayWithoutException: Boolean(holidayRow),
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
  if (input.kind === "CLOSED" && slots.length > 0)
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
