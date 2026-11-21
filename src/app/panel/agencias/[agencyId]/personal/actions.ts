"use server";

// Staff of one agency (spec agency-administration): owners manage everyone, agency admins
// everyone but the owner, plain employees no one. Platform admins act as owners.
import { revalidatePath } from "next/cache";
import { agencyRole, canViewStaff, getAccess } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import {
  type StaffInput,
  StaffValidationError,
  deactivateEmployee,
  hireEmployee,
  reactivateEmployee,
  updateEmployee,
} from "@/lib/staff";
import type { EmployeeRole } from "@/generated/prisma/enums";

export type FormState = { ok: boolean; message: string } | null;

async function requireManager(agencyId: string): Promise<EmployeeRole> {
  const access = await getAccess();
  if (!access) throw new StaffValidationError("Tu sesión expiró. Volvé a ingresar.");
  const role = agencyRole(access, agencyId);
  if (!canViewStaff(role)) throw new StaffValidationError("Solo el dueño o un administrador manejan el personal.");
  return role!;
}

async function guarded(fn: () => Promise<string>): Promise<FormState> {
  try {
    const message = await fn();
    revalidatePath("/panel", "layout");
    return { ok: true, message };
  } catch (err) {
    if (err instanceof StaffValidationError) return { ok: false, message: err.message };
    throw err;
  }
}

const str = (form: FormData, key: string) => String(form.get(key) ?? "").trim();
const agencyOf = async (employeeId: string) =>
  (await prisma.agencyEmployee.findUniqueOrThrow({ where: { id: employeeId }, select: { agencyId: true } })).agencyId;

const fields = (form: FormData): StaffInput => ({
  firstName: str(form, "firstName"),
  lastName: str(form, "lastName"),
  role: (str(form, "role") || "EMPLOYEE") as EmployeeRole,
  email: str(form, "email"),
  cuil: str(form, "cuil"),
  phone: str(form, "phone"),
  hiredAt: str(form, "hiredAt"),
  jobTitle: str(form, "jobTitle"),
  shift: str(form, "shift"),
  notes: str(form, "notes"),
  socialMediaConsent: form.get("socialMediaConsent") === "on",
  publicName: str(form, "publicName"),
  consentAt: str(form, "consentAt"),
});

export async function hireAction(agencyId: string, _prev: FormState, form: FormData) {
  return guarded(async () => {
    const actor = await requireManager(agencyId);
    const e = await hireEmployee(agencyId, actor, fields(form));
    return `${e.firstName} ${e.lastName} agregado al personal${e.email && !e.userId ? `: cuando ingrese con Google (${e.email}) va a ver la agencia` : ""}.`;
  });
}

export async function updateAction(employeeId: string, _prev: FormState, form: FormData) {
  return guarded(async () => {
    const actor = await requireManager(await agencyOf(employeeId));
    await updateEmployee(employeeId, actor, fields(form));
    return "Datos guardados.";
  });
}

export async function deactivateAction(employeeId: string, _prev: FormState, form: FormData) {
  return guarded(async () => {
    const actor = await requireManager(await agencyOf(employeeId));
    const e = await deactivateEmployee(employeeId, actor, str(form, "leftAt"));
    return `${e.firstName} ${e.lastName} dado de baja: ya no entra a la agencia.`;
  });
}

export async function reactivateAction(employeeId: string, _prev: FormState, _form: FormData) {
  return guarded(async () => {
    const actor = await requireManager(await agencyOf(employeeId));
    const e = await reactivateEmployee(employeeId, actor);
    return `${e.firstName} ${e.lastName} volvió al personal.`;
  });
}
