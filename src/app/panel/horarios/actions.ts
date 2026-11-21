"use server";

// Server actions for agency hours (spec: agency-schedule).
// Model the user sees: one "Horario general" per owner, inherited by their agencies.
// Editing an agency's weekly hours personalizes it (copy on modify); it can go back
// to the general schedule with one action. Every action re-checks permissions.
import { revalidatePath } from "next/cache";
import type { ScheduleExceptionKind } from "@/generated/prisma/enums";
import { agencyRole, canEditAgencyExceptions, canEditAgencyHours, getAccess, ownsGroup, type Access } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import {
  ScheduleValidationError,
  agencyGroupId,
  agenciesOfGroup,
  createScheduleException,
  ensureGeneral,
  exceptionFromHoliday,
  linkUnscheduledAgencies,
  parseWeek,
  replaceWeek,
  todayIn,
  upcomingHolidays,
  type Range,
  type ScheduleScope,
} from "@/lib/schedule";

export type FormState = { ok: boolean; message: string } | null;

/** "agency": id = agencyId. "general": id = the group id (spec agency-groups). */
export type ScopeKind = "agency" | "general";
const TZ = "America/Argentina/Buenos_Aires";

class Forbidden extends Error {}

async function requireScope(kind: ScopeKind, id: string, need: "hours" | "exceptions"): Promise<Access> {
  const access = await getAccess();
  if (!access) throw new Forbidden("Tu sesión expiró. Volvé a ingresar.");
  if (kind === "general") {
    if (!ownsGroup(access, id)) throw new Forbidden("Solo los dueños del grupo modifican su horario general.");
    if ((await agenciesOfGroup(id)).length === 0) throw new Forbidden("Ese grupo no tiene agencias.");
    return access;
  }
  const role = agencyRole(access, id);
  const allowed = need === "hours" ? canEditAgencyHours(role) : canEditAgencyExceptions(role);
  if (!allowed) throw new Forbidden("No tenés permiso para modificar el horario de esta agencia.");
  return access;
}

async function resolveScope(kind: ScopeKind, id: string): Promise<ScheduleScope> {
  if (kind === "agency") return { agencyId: id };
  return { templateId: (await ensureGeneral(id)).id };
}

async function guarded(fn: () => Promise<string>): Promise<FormState> {
  try {
    const message = await fn();
    revalidatePath("/panel", "layout");
    return { ok: true, message };
  } catch (err) {
    if (err instanceof ScheduleValidationError || err instanceof Forbidden) return { ok: false, message: err.message };
    throw err;
  }
}

// ─── Weekly hours ──────────────────────────────────────────────

/** Save the group's general schedule; its agencies without hours start inheriting it. */
export async function saveGeneralWeek(groupId: string, _prev: FormState, form: FormData) {
  return guarded(async () => {
    await requireScope("general", groupId, "hours");
    const week = parseWeek(form.get("week"));
    const general = await ensureGeneral(groupId);
    await replaceWeek({ templateId: general.id }, week);
    const linked = await linkUnscheduledAgencies(groupId, general.id);
    return linked ? `Horario general guardado. ${linked} agencia(s) empezaron a usarlo.` : "Horario general guardado.";
  });
}

/** Save an agency's hours. If it inherited the general schedule, it becomes personalized. */
export async function saveAgencyWeek(agencyId: string, _prev: FormState, form: FormData) {
  return guarded(async () => {
    await requireScope("agency", agencyId, "hours");
    const week = parseWeek(form.get("week"));
    const agency = await prisma.agency.findUniqueOrThrow({ where: { id: agencyId }, select: { customHours: true } });
    await replaceWeek({ agencyId }, week);
    // Copy on modify: only the weekly hours become its own; it keeps the general exceptions.
    await prisma.agency.update({ where: { id: agencyId }, data: { customHours: true } });
    return agency.customHours ? "Horario guardado." : "Guardado. Esta agencia ahora tiene horario personalizado.";
  });
}

/** Personalized agency back to its owner's general schedule (own weekly hours are discarded). */
export async function resetAgencyToGeneral(agencyId: string, _prev: FormState, _form: FormData) {
  return guarded(async () => {
    await requireScope("agency", agencyId, "hours");
    const groupId = await agencyGroupId(agencyId);
    const general = groupId ? await prisma.scheduleTemplate.findUnique({ where: { groupId } }) : null;
    if (!general) throw new ScheduleValidationError("El grupo todavía no tiene un horario general cargado.");
    await prisma.$transaction([
      prisma.agencyScheduleRule.deleteMany({ where: { agencyId } }),
      prisma.agency.update({ where: { id: agencyId }, data: { scheduleTemplateId: general.id, customHours: false } }),
    ]);
    return "La agencia volvió a usar el horario general.";
  });
}

// ─── Exceptions ────────────────────────────────────────────────

/** "Abrir normal acá": this agency ignores one of the general schedule's exceptions. */
export async function openNormallyHere(agencyId: string, generalExceptionId: string) {
  await requireScope("agency", agencyId, "exceptions");
  const agency = await prisma.agency.findUniqueOrThrow({ where: { id: agencyId }, select: { scheduleTemplateId: true } });
  const general = await prisma.scheduleException.findUnique({ where: { id: generalExceptionId } });
  if (!general || !agency.scheduleTemplateId || general.templateId !== agency.scheduleTemplateId) return;
  await createScheduleException({
    agencyId,
    startDate: general.startDate.toISOString().slice(0, 10),
    endDate: general.endDate.toISOString().slice(0, 10),
    kind: "NORMAL_HOURS",
    reason: general.reason ? `Abre normal (general: ${general.reason})` : "Abre normal",
  });
  revalidatePath("/panel", "layout");
}

export async function addException(kind: ScopeKind, id: string, _prev: FormState, form: FormData) {
  return guarded(async () => {
    await requireScope(kind, id, "exceptions");
    const exceptionKind: ScheduleExceptionKind = String(form.get("kind")) === "SPECIAL_HOURS" ? "SPECIAL_HOURS" : "CLOSED";
    let slots: Range[] = [];
    if (exceptionKind === "SPECIAL_HOURS") {
      try {
        slots = JSON.parse(String(form.get("slots") ?? "[]"));
      } catch {
        throw new ScheduleValidationError("Horario especial inválido.");
      }
    }
    const startDate = String(form.get("startDate") ?? "");
    await createScheduleException({
      ...(await resolveScope(kind, id)),
      startDate,
      endDate: String(form.get("endDate") || startDate),
      kind: exceptionKind,
      reason: String(form.get("reason") ?? "").trim() || null,
      slots,
    });
    return "Excepción agregada.";
  });
}

export async function deleteException(exceptionId: string) {
  const e = await prisma.scheduleException.findUnique({
    where: { id: exceptionId },
    include: { template: { select: { groupId: true } } },
  });
  if (!e) return;
  if (e.agencyId) await requireScope("agency", e.agencyId, "exceptions");
  else if (e.template?.groupId) await requireScope("general", e.template.groupId, "exceptions");
  await prisma.scheduleException.delete({ where: { id: exceptionId } });
  revalidatePath("/panel", "layout");
}

export async function closeOnHoliday(kind: ScopeKind, id: string, holidayId: string) {
  await requireScope(kind, id, "exceptions");
  const scope = await resolveScope(kind, id);
  await exceptionFromHoliday(holidayId, scope as { agencyId: string } | { templateId: string });
  revalidatePath("/panel", "layout");
}

/** "Cerrar en todos": every holiday in the next 12 months not already covered in this scope. */
export async function closeOnAllHolidays(kind: ScopeKind, id: string) {
  await requireScope(kind, id, "exceptions");
  const scope = await resolveScope(kind, id);
  const pending = (await upcomingHolidays([scope], todayIn(TZ), 365)).filter((h) => !h.covered);
  for (const h of pending) await exceptionFromHoliday(h.id, scope as { agencyId: string } | { templateId: string });
  revalidatePath("/panel", "layout");
}
