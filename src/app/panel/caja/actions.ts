"use server";

// Server actions for cash sessions and fiados (spec: agency-finances).
// Any member of the agency works the counter (open, load lines, close, fiados);
// reopening a closed session is for owners and agency admins.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { CashShift } from "@/generated/prisma/enums";
import { agencyRole, canViewStaff, getAccess } from "@/lib/access";
import {
  addSheetLine,
  closeSession,
  isSheetLine,
  openSession,
  reopenSession,
  setMachineSales,
  setSessionItems,
  voidSessionMovement,
} from "@/lib/cash";
import { chargeCustomer, payCustomer, voidEntry } from "@/lib/credit";
import { addAgencyCustomer, updateAgencyCustomer } from "@/lib/customers";
import { FinanceValidationError } from "@/lib/finance";
import { money } from "@/components/products/price-parts";
import { prisma } from "@/lib/prisma";

export type FormState = { ok: boolean; message: string } | null;

class Forbidden extends Error {}

async function requireMember(agencyId: string, managers = false) {
  const access = await getAccess();
  if (!access) throw new Forbidden("Tu sesión expiró. Volvé a ingresar.");
  const role = agencyRole(access, agencyId);
  if (!role) throw new Forbidden("No trabajás en esta agencia.");
  if (managers && !canViewStaff(role)) throw new Forbidden("Solo el dueño o un administrador pueden hacerlo.");
  return access;
}

async function guarded(fn: () => Promise<string>): Promise<FormState> {
  try {
    const message = await fn();
    revalidatePath("/panel", "layout");
    return { ok: true, message };
  } catch (err) {
    if (err instanceof FinanceValidationError || err instanceof Forbidden) return { ok: false, message: err.message };
    throw err;
  }
}

const str = (form: FormData, key: string) => String(form.get(key) ?? "").trim();
const agencyOfSession = async (sessionId: string) =>
  (await prisma.cashSession.findUniqueOrThrow({ where: { id: sessionId }, select: { agencyId: true } })).agencyId;
const agencyOfCustomer = async (customerId: string) =>
  (await prisma.agencyCustomer.findUniqueOrThrow({ where: { id: customerId }, select: { agencyId: true } })).agencyId;

// ─── Cash sessions ─────────────────────────────────────────────

export async function openSessionAction(agencyId: string, _prev: FormState, form: FormData) {
  let sessionId: string | null = null;
  const result = await guarded(async () => {
    const access = await requireMember(agencyId);
    const shift = str(form, "shift") as CashShift;
    if (!["MORNING", "AFTERNOON", "SINGLE"].includes(shift)) throw new FinanceValidationError("Elegí el turno.");
    const session = await openSession({ agencyId, date: str(form, "date"), shift, openingCash: str(form, "openingCash"), userId: access.user.id });
    sessionId = session.id;
    return "Caja abierta.";
  });
  if (sessionId) redirect(`/panel/agencias/${agencyId}/caja/${sessionId}`);
  return result;
}

export async function addLineAction(sessionId: string, _prev: FormState, form: FormData) {
  return guarded(async () => {
    const access = await requireMember(await agencyOfSession(sessionId));
    const line = str(form, "line");
    if (!isSheetLine(line)) throw new FinanceValidationError("Elegí qué cargar.");
    const m = await addSheetLine({
      sessionId,
      line,
      amount: str(form, "amount"),
      fundId: str(form, "fundId") || null,
      description: str(form, "description"),
      userId: access.user.id,
    });
    return `Cargado: ${money(m.amount.toString())}.`;
  });
}

export async function voidLineAction(movementId: string) {
  const m = await prisma.fundMovement.findUniqueOrThrow({ where: { id: movementId }, select: { cashSessionId: true } });
  if (!m.cashSessionId) return;
  await requireMember(await agencyOfSession(m.cashSessionId));
  await voidSessionMovement(movementId);
  revalidatePath("/panel", "layout");
}

export async function setItemsAction(sessionId: string, _prev: FormState, form: FormData) {
  return guarded(async () => {
    await requireMember(await agencyOfSession(sessionId));
    const quantities: Record<string, number> = {};
    for (const [key, value] of form.entries())
      if (key.startsWith("qty:")) quantities[key.slice(4)] = value === "" ? 0 : Number(value);
    await setSessionItems(sessionId, quantities);
    return "Cantidades guardadas.";
  });
}

export async function setMachineSalesAction(sessionId: string, _prev: FormState, form: FormData) {
  return guarded(async () => {
    await requireMember(await agencyOfSession(sessionId));
    await setMachineSales(sessionId, str(form, "machineSales"));
    return "Venta de la máquina guardada.";
  });
}

export async function closeSessionAction(sessionId: string, _prev: FormState, form: FormData) {
  return guarded(async () => {
    const access = await requireMember(await agencyOfSession(sessionId));
    const r = await closeSession({ sessionId, countedCash: str(form, "countedCash"), notes: str(form, "notes"), userId: access.user.id });
    return r.difference.isZero()
      ? "Caja cerrada sin diferencias."
      : `Caja cerrada con ${r.difference.isNegative() ? "faltante" : "sobrante"} de ${money(r.difference.abs().toString())}.`;
  });
}

export async function reopenSessionAction(sessionId: string) {
  await requireMember(await agencyOfSession(sessionId), true);
  await reopenSession(sessionId);
  revalidatePath("/panel", "layout");
}

// ─── Customers and fiados ──────────────────────────────────────

const customerFields = (form: FormData) => ({
  firstName: str(form, "firstName"),
  lastName: str(form, "lastName"),
  alias: str(form, "alias"),
  phone: str(form, "phone"),
  dni: str(form, "dni"),
  notes: str(form, "notes"),
});

export async function addCustomerAction(agencyId: string, _prev: FormState, form: FormData) {
  return guarded(async () => {
    await requireMember(agencyId);
    const c = await addAgencyCustomer(agencyId, customerFields(form));
    return `«${c.alias}» agregado como cliente.`;
  });
}

export async function updateCustomerAction(customerId: string, _prev: FormState, form: FormData) {
  return guarded(async () => {
    await requireMember(await agencyOfCustomer(customerId));
    await updateAgencyCustomer(customerId, customerFields(form));
    return "Datos guardados.";
  });
}

export async function chargeAction(customerId: string, _prev: FormState, form: FormData) {
  return guarded(async () => {
    const access = await requireMember(await agencyOfCustomer(customerId));
    const e = await chargeCustomer({ customerId, amount: str(form, "amount"), description: str(form, "description"), userId: access.user.id });
    return `Fiado de ${money(e.amount.toString())} cargado${e.cashSessionId ? " en la caja abierta" : ""}.`;
  });
}

export async function payAction(customerId: string, _prev: FormState, form: FormData) {
  return guarded(async () => {
    const access = await requireMember(await agencyOfCustomer(customerId));
    const e = await payCustomer({ customerId, amount: str(form, "amount"), fundId: str(form, "fundId"), userId: access.user.id });
    return `Pago de ${money(e.amount.toString())} registrado${e.cashSessionId ? " en la caja abierta" : ""}.`;
  });
}

export async function voidEntryAction(entryId: string) {
  const entry = await prisma.creditEntry.findUniqueOrThrow({ where: { id: entryId }, select: { customerId: true } });
  await requireMember(await agencyOfCustomer(entry.customerId));
  await voidEntry(entryId, "Anulado");
  revalidatePath("/panel", "layout");
}
