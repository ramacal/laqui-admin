"use server";

// Server actions for agency hours (spec: agency-schedule). Every action re-checks
// permissions on the server; the UI only hides what the user cannot do.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ScheduleExceptionKind } from "@/generated/prisma/enums";
import {
  agencyRole,
  canEditAgencyExceptions,
  canEditAgencyHours,
  getAccess,
  getEditableTemplate,
  ownedAgencies,
  type Access,
} from "@/lib/access";
import { prisma } from "@/lib/prisma";
import {
  ScheduleValidationError,
  createScheduleException,
  exceptionFromHoliday,
  getWeek,
  parseWeek,
  replaceWeek,
  todayIn,
  upcomingHolidays,
  type Range,
  type ScheduleScope,
} from "@/lib/schedule";

export type FormState = { ok: boolean; message: string } | null;

type ScopeKind = "agency" | "template";
const toScope = (kind: ScopeKind, id: string): ScheduleScope => (kind === "agency" ? { agencyId: id } : { templateId: id });
const TZ = "America/Argentina/Buenos_Aires";

class Forbidden extends Error {}

async function requireScope(kind: ScopeKind, id: string, need: "hours" | "exceptions"): Promise<Access> {
  const access = await getAccess();
  if (!access) throw new Forbidden("Tu sesión expiró. Volvé a ingresar.");
  if (kind === "template") {
    if (!(await getEditableTemplate(access, id))) throw new Forbidden("No podés modificar esta plantilla.");
    return access;
  }
  const role = agencyRole(access, id);
  const allowed = need === "hours" ? canEditAgencyHours(role) : canEditAgencyExceptions(role);
  if (!allowed) throw new Forbidden("No tenés permiso para modificar el horario de esta agencia.");
  return access;
}

/** Run an action body and turn known errors into a form message. */
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

/** Keep an agency's hours when it stops following a template. */
async function copyTemplateWeekToAgency(templateId: string, agencyId: string) {
  await replaceWeek({ agencyId }, await getWeek({ templateId }));
}

// ─── Templates ─────────────────────────────────────────────────

export async function createTemplate(_prev: FormState, form: FormData): Promise<FormState> {
  const access = await getAccess();
  if (!access) return { ok: false, message: "Tu sesión expiró. Volvé a ingresar." };
  const name = String(form.get("name") ?? "").trim();
  if (name.length < 2) return { ok: false, message: "Poné un nombre a la plantilla." };
  if ((await ownedAgencies(access)).length === 0)
    return { ok: false, message: "Solo los dueños de agencias pueden crear plantillas." };
  const template = await prisma.scheduleTemplate.create({ data: { name, ownerUserId: access.user.id } });
  redirect(`/panel/horarios/${template.id}`);
}

export async function renameTemplate(templateId: string, _prev: FormState, form: FormData) {
  return guarded(async () => {
    await requireScope("template", templateId, "hours");
    const name = String(form.get("name") ?? "").trim();
    if (name.length < 2) throw new ScheduleValidationError("Poné un nombre a la plantilla.");
    await prisma.scheduleTemplate.update({ where: { id: templateId }, data: { name } });
    return "Nombre guardado.";
  });
}

/** Which agencies follow this template. Agencies removed from it keep its hours as their own. */
export async function setTemplateAgencies(templateId: string, _prev: FormState, form: FormData) {
  return guarded(async () => {
    const access = await requireScope("template", templateId, "hours");
    const selected = new Set(form.getAll("agencyId").map(String));
    const agencies = await ownedAgencies(access);
    let added = 0;
    let removed = 0;
    for (const a of agencies) {
      if (selected.has(a.id) && a.scheduleTemplateId !== templateId) {
        await prisma.agency.update({ where: { id: a.id }, data: { scheduleTemplateId: templateId } });
        added++;
      } else if (!selected.has(a.id) && a.scheduleTemplateId === templateId) {
        await copyTemplateWeekToAgency(templateId, a.id);
        await prisma.agency.update({ where: { id: a.id }, data: { scheduleTemplateId: null } });
        removed++;
      }
    }
    if (!added && !removed) return "Sin cambios.";
    return `Listo: ${added} agencia(s) agregada(s), ${removed} quitada(s).`;
  });
}

export async function deleteTemplate(templateId: string) {
  await requireScope("template", templateId, "hours");
  // Agencies using it keep the same hours as their own before it disappears.
  const users = await prisma.agency.findMany({ where: { scheduleTemplateId: templateId }, select: { id: true } });
  for (const a of users) await copyTemplateWeekToAgency(templateId, a.id);
  await prisma.scheduleTemplate.delete({ where: { id: templateId } });
  revalidatePath("/panel", "layout");
  redirect("/panel/horarios");
}

// ─── Weekly hours ──────────────────────────────────────────────

export async function saveWeek(kind: ScopeKind, id: string, _prev: FormState, form: FormData) {
  return guarded(async () => {
    await requireScope(kind, id, "hours");
    if (kind === "agency") {
      const agency = await prisma.agency.findUniqueOrThrow({ where: { id }, select: { scheduleTemplateId: true } });
      if (agency.scheduleTemplateId)
        throw new ScheduleValidationError("Esta agencia usa una plantilla: personalizá su horario primero.");
    }
    await replaceWeek(toScope(kind, id), parseWeek(form.get("week")));
    return "Horario guardado.";
  });
}

/** Agency mode: follow a template, or use its own hours (starting from the template's). */
export async function setAgencyMode(agencyId: string, _prev: FormState, form: FormData) {
  return guarded(async () => {
    const access = await requireScope("agency", agencyId, "hours");
    const mode = String(form.get("mode") ?? "");
    const agency = await prisma.agency.findUniqueOrThrow({ where: { id: agencyId }, select: { scheduleTemplateId: true } });

    if (mode === "custom") {
      if (!agency.scheduleTemplateId) return "La agencia ya tiene horario propio.";
      await copyTemplateWeekToAgency(agency.scheduleTemplateId, agencyId);
      await prisma.agency.update({ where: { id: agencyId }, data: { scheduleTemplateId: null } });
      return "Ahora la agencia tiene horario propio (copiado de la plantilla).";
    }
    const templateId = mode.replace(/^template:/, "");
    if (!(await getEditableTemplate(access, templateId))) throw new Forbidden("No podés usar esa plantilla.");
    await prisma.agency.update({ where: { id: agencyId }, data: { scheduleTemplateId: templateId } });
    return "La agencia ahora sigue la plantilla.";
  });
}

// ─── Exceptions ────────────────────────────────────────────────

export async function addException(kind: ScopeKind, id: string, _prev: FormState, form: FormData) {
  return guarded(async () => {
    await requireScope(kind, id, "exceptions");
    const exceptionKind = String(form.get("kind")) === "SPECIAL_HOURS" ? "SPECIAL_HOURS" : "CLOSED";
    let slots: Range[] = [];
    if (exceptionKind === "SPECIAL_HOURS") {
      try {
        slots = JSON.parse(String(form.get("slots") ?? "[]"));
      } catch {
        throw new ScheduleValidationError("Horario especial inválido.");
      }
    }
    const startDate = String(form.get("startDate") ?? "");
    const endDate = String(form.get("endDate") || startDate);
    await createScheduleException({
      ...toScope(kind, id),
      startDate,
      endDate,
      kind: exceptionKind as ScheduleExceptionKind,
      reason: String(form.get("reason") ?? "").trim() || null,
      slots,
    });
    return "Excepción agregada.";
  });
}

export async function deleteException(exceptionId: string) {
  const e = await prisma.scheduleException.findUnique({ where: { id: exceptionId } });
  if (!e) return;
  if (e.agencyId) await requireScope("agency", e.agencyId, "exceptions");
  else if (e.templateId) await requireScope("template", e.templateId, "exceptions");
  await prisma.scheduleException.delete({ where: { id: exceptionId } });
  revalidatePath("/panel", "layout");
}

export async function closeOnHoliday(kind: ScopeKind, id: string, holidayId: string) {
  await requireScope(kind, id, "exceptions");
  await exceptionFromHoliday(holidayId, kind === "agency" ? { agencyId: id } : { templateId: id });
  revalidatePath("/panel", "layout");
}

/** "Cerrar todos": every holiday in the next 12 months not already covered in this scope. */
export async function closeOnAllHolidays(kind: ScopeKind, id: string) {
  await requireScope(kind, id, "exceptions");
  const scope = toScope(kind, id);
  const pending = (await upcomingHolidays([scope], todayIn(TZ), 365)).filter((h) => !h.covered);
  for (const h of pending) await exceptionFromHoliday(h.id, kind === "agency" ? { agencyId: id } : { templateId: id });
  revalidatePath("/panel", "layout");
}
