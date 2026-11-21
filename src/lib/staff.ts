// Agency staff (AgencyEmployee): hire, edit, deactivate and reactivate from the panel.
// Former employees are never deleted (active = false + leftAt). Owners are not staff: they come
// from the agency.s group (spec agency-groups); legacy OWNER rows are hidden and removed in phase 4.
import type { EmployeeRole, EmployeeShift } from "@/generated/prisma/enums";
import { canManageStaff } from "@/lib/access";
import { onStaffChanged } from "@/lib/drive/sharing";
import { PhoneError, optionalCellphone } from "@/lib/phone";
import { prisma } from "@/lib/prisma";

export class StaffValidationError extends Error {}

export const SHIFTS: EmployeeShift[] = ["MORNING", "AFTERNOON", "FULL_DAY", "ROTATING"];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type StaffInput = {
  firstName: string;
  lastName: string;
  role?: EmployeeRole; // ignored for the owner row
  email?: string | null; // ignored for the owner row
  cuil?: string | null;
  phone?: string | null;
  hiredAt?: string | null; // YYYY-MM-DD
  jobTitle?: string | null;
  shift?: string | null;
  notes?: string | null;
  socialMediaConsent?: boolean;
  publicName?: string | null;
  consentAt?: string | null; // YYYY-MM-DD
};

const opt = (s: string | null | undefined) => (s && s.trim() ? s.trim() : null);

/** "YYYY-MM-DD" → UTC midnight (the columns are @db.Date). Empty → null. */
export function parseDay(raw: string | null | undefined, label: string): Date | null {
  const s = opt(raw);
  if (!s) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new StaffValidationError(`La ${label} no es una fecha válida.`);
  const d = new Date(`${s}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) throw new StaffValidationError(`La ${label} no es una fecha válida.`);
  return d;
}

/** CUIL/CUIT: 11 digits (dashes, dots and spaces allowed when typing) with a valid check digit. */
export function optionalCuil(raw: string | null | undefined): string | null {
  const digits = (raw ?? "").replace(/[-.\s]/g, "");
  if (!digits) return null;
  if (!/^\d{11}$/.test(digits)) throw new StaffValidationError("El CUIL tiene 11 números (ej.: 20-30123456-3).");
  const weights = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const sum = weights.reduce((acc, w, i) => acc + w * Number(digits[i]), 0);
  const check = 11 - (sum % 11);
  const expected = check === 11 ? 0 : check;
  if (expected === 10 || expected !== Number(digits[10]))
    throw new StaffValidationError("El CUIL no es válido: revisá los números (el último no coincide).");
  return digits;
}

function normalize(input: StaffInput) {
  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  if (!firstName || !lastName) throw new StaffValidationError("Escribí nombre y apellido.");

  const email = opt(input.email)?.toLowerCase() ?? null;
  if (email && !EMAIL.test(email)) throw new StaffValidationError("El email no es válido.");

  const shift = opt(input.shift);
  if (shift && !SHIFTS.includes(shift as EmployeeShift)) throw new StaffValidationError("Elegí un turno de la lista.");

  let phone: string | null;
  try {
    phone = optionalCellphone(input.phone);
  } catch (err) {
    if (err instanceof PhoneError) throw new StaffValidationError(err.message);
    throw err;
  }

  const socialMediaConsent = input.socialMediaConsent ?? false;
  return {
    firstName,
    lastName,
    email,
    cuil: optionalCuil(input.cuil),
    phone,
    hiredAt: parseDay(input.hiredAt, "fecha de ingreso"),
    jobTitle: opt(input.jobTitle),
    shift: (shift as EmployeeShift | null) ?? null,
    notes: opt(input.notes),
    socialMediaConsent,
    publicName: socialMediaConsent ? opt(input.publicName) : null,
    consentAt: socialMediaConsent ? parseDay(input.consentAt, "fecha del permiso") : null,
  };
}

/** Another row of this agency already using this CUIL or email? (both are one per agency). */
async function assertUnique(agencyId: string, data: { cuil: string | null; email: string | null }, exceptId?: string) {
  const not = exceptId ? { NOT: { id: exceptId } } : {};
  if (data.cuil) {
    const other = await prisma.agencyEmployee.findFirst({ where: { agencyId, cuil: data.cuil, ...not } });
    if (other) throw new StaffValidationError(`Ese CUIL ya es de ${other.firstName} ${other.lastName} en esta agencia.`);
  }
  if (data.email) {
    const other = await prisma.agencyEmployee.findFirst({ where: { agencyId, email: data.email, ...not } });
    if (other) throw new StaffValidationError(`Ese email ya es de ${other.firstName} ${other.lastName} en esta agencia.`);
  }
}

/** The login with this email, if that person already signed in with Google. */
async function userIdFor(email: string | null) {
  if (!email) return null;
  return (await prisma.user.findUnique({ where: { email }, select: { id: true } }))?.id ?? null;
}

function assertRole(actor: EmployeeRole, role: EmployeeRole | undefined): EmployeeRole {
  const target = role ?? "EMPLOYEE";
  if (target === "OWNER") throw new StaffValidationError("El dueño es el titular del legajo: no se agrega desde acá.");
  if (!canManageStaff(actor, target)) throw new StaffValidationError("No podés dar ese rol.");
  return target;
}

export async function hireEmployee(agencyId: string, actor: EmployeeRole, input: StaffInput) {
  const role = assertRole(actor, input.role);
  const data = normalize(input);
  await assertUnique(agencyId, data);
  const employee = await prisma.agencyEmployee.create({
    data: { agencyId, role, ...data, userId: await userIdFor(data.email) },
  });
  await onStaffChanged(agencyId);
  return employee;
}

async function loadManaged(employeeId: string, actor: EmployeeRole) {
  const employee = await prisma.agencyEmployee.findUniqueOrThrow({ where: { id: employeeId } });
  if (!canManageStaff(actor, employee.role)) throw new StaffValidationError("No podés modificar a esta persona.");
  return employee;
}

export async function updateEmployee(employeeId: string, actor: EmployeeRole, input: StaffInput) {
  const current = await loadManaged(employeeId, actor);
  const isOwner = current.role === "OWNER";
  const data = normalize(isOwner ? { ...input, email: current.email } : input);
  const role = isOwner ? "OWNER" : assertRole(actor, input.role);
  await assertUnique(current.agencyId, data, current.id);

  // A changed email moves the login: the new address gets access when it signs in.
  const userId = data.email === current.email ? current.userId : await userIdFor(data.email);
  const updated = await prisma.agencyEmployee.update({
    where: { id: employeeId },
    data: { ...data, role, userId },
  });
  await onStaffChanged(current.agencyId);
  return updated;
}

export async function deactivateEmployee(employeeId: string, actor: EmployeeRole, leftAtRaw: string | null) {
  const current = await loadManaged(employeeId, actor);
  if (current.role === "OWNER") throw new StaffValidationError("El dueño no se da de baja desde acá.");
  if (!current.active) throw new StaffValidationError("Ya estaba dado de baja.");
  const leftAt = parseDay(leftAtRaw, "fecha de egreso") ?? new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`);
  if (current.hiredAt && leftAt < current.hiredAt)
    throw new StaffValidationError("La fecha de egreso no puede ser anterior a la de ingreso.");
  const updated = await prisma.agencyEmployee.update({ where: { id: employeeId }, data: { active: false, leftAt } });
  await onStaffChanged(current.agencyId);
  return updated;
}

export async function reactivateEmployee(employeeId: string, actor: EmployeeRole) {
  const current = await loadManaged(employeeId, actor);
  if (current.active) throw new StaffValidationError("Ya está activo.");
  const updated = await prisma.agencyEmployee.update({ where: { id: employeeId }, data: { active: true, leftAt: null } });
  await onStaffChanged(current.agencyId);
  return updated;
}
