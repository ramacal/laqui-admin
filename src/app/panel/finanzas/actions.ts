"use server";

// Server actions for agency finances (spec: agency-finances).
// Only the agency's owner and admins (and platform admins) may read or write them.
import { revalidatePath } from "next/cache";
import type { FundKind, MovementDirection, MovementKind } from "@/generated/prisma/enums";
import { agencyRole, canViewStaff, getAccess } from "@/lib/access";
import {
  FinanceValidationError,
  addMovement,
  createFund,
  transferBetweenFunds,
  updateFund,
  voidMovement,
} from "@/lib/finance";
import { prisma } from "@/lib/prisma";
import { attachTicket, createSettlement, voidSettlement } from "@/lib/settlement";

export type FormState = { ok: boolean; message: string } | null;

class Forbidden extends Error {}

/** Owner or agency admin of this agency (platform admins act as owners). */
async function requireFinanceAccess(agencyId: string) {
  const access = await getAccess();
  if (!access) throw new Forbidden("Tu sesión expiró. Volvé a ingresar.");
  if (!canViewStaff(agencyRole(access, agencyId))) throw new Forbidden("Solo el dueño o un administrador ven las finanzas.");
  return access;
}

async function agencyOfFund(fundId: string) {
  const fund = await prisma.agencyFund.findUnique({ where: { id: fundId }, select: { agencyId: true } });
  if (!fund) throw new FinanceValidationError("Medio de cobro inexistente.");
  return fund.agencyId;
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
const FUND_KINDS: FundKind[] = ["CASH", "BANK_ACCOUNT", "DIGITAL_WALLET", "CARD_TERMINAL", "OTHER"];
const MOVEMENT_KINDS: Exclude<MovementKind, "TRANSFER">[] = [
  "LOTTERY_DEBIT",
  "LOTTERY_CREDIT",
  "CUSTOMER_PAYMENT",
  "PRIZE_PAYOUT",
  "EXPENSE",
  "ADJUSTMENT",
  "OTHER",
];

const fundFields = (form: FormData) => ({
  name: str(form, "name"),
  provider: str(form, "provider"),
  holderName: str(form, "holderName"),
  cbuCvu: str(form, "cbuCvu"),
  alias: str(form, "alias"),
  merchantNumber: str(form, "merchantNumber"),
  accountNumber: str(form, "accountNumber"),
  reference: str(form, "reference"),
  showToCustomers: form.get("showToCustomers") === "on",
  openingBalance: str(form, "openingBalance"),
  openingDate: str(form, "openingDate"),
});

export async function createFundAction(agencyId: string, _prev: FormState, form: FormData) {
  return guarded(async () => {
    await requireFinanceAccess(agencyId);
    const kind = str(form, "kind") as FundKind;
    if (!FUND_KINDS.includes(kind)) throw new FinanceValidationError("Elegí el tipo de medio de cobro.");
    const fund = await createFund(agencyId, { kind, ...fundFields(form) });
    return `«${fund.name}» agregado.`;
  });
}

export async function updateFundAction(fundId: string, _prev: FormState, form: FormData) {
  return guarded(async () => {
    await requireFinanceAccess(await agencyOfFund(fundId));
    await updateFund(fundId, fundFields(form));
    return "Datos guardados.";
  });
}

export async function setFundActive(fundId: string, active: boolean) {
  await requireFinanceAccess(await agencyOfFund(fundId));
  const fund = await prisma.agencyFund.findUniqueOrThrow({ where: { id: fundId } });
  if (fund.settlesAgencyId && !active) return; // the agency always keeps its legajo account
  await prisma.agencyFund.update({ where: { id: fundId }, data: { active } });
  revalidatePath("/panel", "layout");
}

export async function addMovementAction(agencyId: string, _prev: FormState, form: FormData) {
  return guarded(async () => {
    const access = await requireFinanceAccess(agencyId);
    const fundId = str(form, "fundId");
    if ((await agencyOfFund(fundId)) !== agencyId) throw new FinanceValidationError("Elegí un medio de esta agencia.");
    const kind = str(form, "kind") as Exclude<MovementKind, "TRANSFER">;
    if (!MOVEMENT_KINDS.includes(kind)) throw new FinanceValidationError("Elegí el tipo de movimiento.");
    await addMovement({
      fundId,
      date: str(form, "date"),
      direction: (str(form, "direction") === "OUT" ? "OUT" : "IN") as MovementDirection,
      amount: str(form, "amount"),
      kind,
      description: str(form, "description"),
      reference: str(form, "reference"),
      createdById: access.user.id,
    });
    return "Movimiento cargado.";
  });
}

export async function transferAction(agencyId: string, _prev: FormState, form: FormData) {
  return guarded(async () => {
    const access = await requireFinanceAccess(agencyId);
    const fromFundId = str(form, "fromFundId");
    const toFundId = str(form, "toFundId");
    if ((await agencyOfFund(fromFundId)) !== agencyId || (await agencyOfFund(toFundId)) !== agencyId)
      throw new FinanceValidationError("Elegí medios de esta agencia.");
    await transferBetweenFunds({
      fromFundId,
      toFundId,
      date: str(form, "date"),
      amount: str(form, "amount"),
      description: str(form, "description"),
      createdById: access.user.id,
    });
    return "Transferencia registrada.";
  });
}

export async function voidMovementAction(movementId: string) {
  const m = await prisma.fundMovement.findUnique({ where: { id: movementId }, select: { fundId: true } });
  if (!m) return;
  await requireFinanceAccess(await agencyOfFund(m.fundId));
  await voidMovement(movementId);
  revalidatePath("/panel", "layout");
}

// ─── Daily Lotería settlement ticket ───────────────────────────

export async function createSettlementAction(agencyId: string, _prev: FormState, form: FormData) {
  return guarded(async () => {
    const access = await requireFinanceAccess(agencyId);
    const settlement = await createSettlement({
      agencyId,
      issueDate: str(form, "issueDate"),
      dueDate: str(form, "dueDate"),
      amount: str(form, "amount"),
      direction: str(form, "direction") === "CREDIT" ? "CREDIT" : "DEBIT",
      accountNumber: str(form, "accountNumber"),
      notes: str(form, "notes"),
      confirmAccountMismatch: form.get("confirmAccount") === "on",
      userId: access.user.id,
    });
    const photo = form.get("ticket");
    if (photo instanceof File && photo.size > 0) {
      try {
        await attachTicket(settlement.id, photo);
      } catch (err) {
        if (err instanceof FinanceValidationError) return `Ticket cargado, pero la foto no se guardó: ${err.message}`;
        throw err;
      }
    }
    return settlement.direction === "DEBIT" ? "Ticket cargado: débito registrado." : "Ticket cargado: crédito registrado.";
  });
}

export async function voidSettlementAction(settlementId: string) {
  const s = await prisma.lotterySettlement.findUnique({ where: { id: settlementId }, select: { agencyId: true } });
  if (!s) return;
  await requireFinanceAccess(s.agencyId);
  await voidSettlement(settlementId);
  revalidatePath("/panel", "layout");
}
