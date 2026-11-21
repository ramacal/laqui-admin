// Agency finances (spec: agency-finances).
// Payment methods ("medios de cobro") belong to one agency; each agency has exactly one
// bank account. Balance = opening balance + money in − money out of non-voided movements
// dated from the opening date up to the given date. Never stored.
import { randomBytes } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import type { FundKind, MovementDirection, MovementKind } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { dateValue, todayIn } from "@/lib/schedule";

export class FinanceValidationError extends Error {}

const TZ = "America/Argentina/Buenos_Aires";
const ZERO = new Prisma.Decimal(0);

export const FUND_KIND_LABEL: Record<FundKind, string> = {
  CASH: "Efectivo",
  BANK_ACCOUNT: "Cuenta bancaria",
  DIGITAL_WALLET: "Billetera virtual",
  CARD_TERMINAL: "Posnet / tarjetas",
  OTHER: "Otro",
};

export const MOVEMENT_KIND_LABEL: Record<MovementKind, string> = {
  LOTTERY_DEBIT: "Lotería debita",
  LOTTERY_CREDIT: "Lotería acredita",
  SALE: "Venta del turno",
  CASH_IN: "Ingreso de efectivo",
  WITHDRAWAL: "Retiro",
  CUSTOMER_PAYMENT: "Cobro a cliente",
  PRIZE_PAYOUT: "Pago de premio",
  EXPENSE: "Gasto",
  TRANSFER: "Transferencia entre medios",
  ADJUSTMENT: "Ajuste",
  OTHER: "Otro",
};

/** Usual direction of each kind (the form preselects it; it can be changed). */
export const MOVEMENT_KIND_DIRECTION: Record<Exclude<MovementKind, "TRANSFER">, MovementDirection> = {
  LOTTERY_DEBIT: "OUT",
  LOTTERY_CREDIT: "IN",
  SALE: "IN",
  CASH_IN: "IN",
  WITHDRAWAL: "OUT",
  CUSTOMER_PAYMENT: "IN",
  PRIZE_PAYOUT: "OUT",
  EXPENSE: "OUT",
  ADJUSTMENT: "IN",
  OTHER: "IN",
};

/** Accepts "1.500,50", "1500,50", "1500.50" or "1500". Unreadable input gives a NaN Decimal. */
export function parseMoney(raw: string | number) {
  let s = String(raw).replace(/[\s$]/g, "");
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", "."); // AR: dots = thousands, comma = decimals
  else if (!/^-?\d+(\.\d{1,2})?$/.test(s)) s = s.replace(/\./g, ""); // "1.500" / "1.500.000" = thousands
  return new Prisma.Decimal(/^-?\d+(\.\d+)?$/.test(s) ? s : "NaN");
}

function parseAmount(raw: string | number) {
  const value = parseMoney(raw);
  if (value.isNaN() || value.lte(0)) throw new FinanceValidationError("El monto tiene que ser mayor a cero.");
  if (value.decimalPlaces() > 2) throw new FinanceValidationError("El monto admite hasta 2 decimales.");
  return value;
}
function parseDate(iso: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) throw new FinanceValidationError("Fecha inválida.");
  return dateValue(iso);
}

// ─── Payment methods ───────────────────────────────────────────

/** Every agency has "Efectivo" and the legajo's account. Idempotent. */
export async function ensureDefaultFunds(agencyId: string) {
  const funds = await prisma.agencyFund.findMany({ where: { agencyId }, select: { kind: true, settlesAgencyId: true } });
  const today = dateValue(todayIn(TZ));
  if (!funds.some((f) => f.kind === "CASH"))
    await prisma.agencyFund.create({ data: { agencyId, kind: "CASH", name: "Efectivo", openingDate: today, sortOrder: 0 } });
  if (!funds.some((f) => f.settlesAgencyId)) {
    // The legajo's account: where the provincial lottery settles (e.g. Banco Provincia for B).
    const agency = await prisma.agency.findUnique({
      where: { id: agencyId },
      select: { province: { select: { settlementBank: true } } },
    });
    const bank = agency?.province.settlementBank ?? null;
    await prisma.agencyFund.create({
      data: {
        agencyId,
        kind: "BANK_ACCOUNT",
        name: bank === "Banco de la Provincia de Buenos Aires" ? "Cuenta Banco Provincia" : bank ? `Cuenta ${bank}` : "Cuenta bancaria",
        provider: bank,
        settlesAgencyId: agencyId,
        openingDate: today,
        sortOrder: 1,
      },
    });
  }
}

export type FundInput = {
  kind: FundKind;
  name: string;
  provider?: string | null;
  holderName?: string | null;
  cbuCvu?: string | null;
  alias?: string | null;
  merchantNumber?: string | null;
  accountNumber?: string | null;
  reference?: string | null;
  showToCustomers?: boolean;
  openingBalance?: string | number;
  openingDate?: string;
};

function cleanFund(input: FundInput) {
  const name = input.name.trim();
  if (name.length < 2) throw new FinanceValidationError("Poné un nombre al medio de cobro.");
  const cbuCvu = input.cbuCvu?.replace(/\D/g, "") || null;
  if (cbuCvu && cbuCvu.length !== 22) throw new FinanceValidationError("El CBU/CVU tiene 22 dígitos.");
  const alias = input.alias?.trim().toLowerCase() || null;
  if (alias && !/^[a-z0-9.-]{6,20}$/.test(alias))
    throw new FinanceValidationError("El alias tiene de 6 a 20 caracteres: letras, números, punto o guion.");
  const opt = (v?: string | null) => v?.trim() || null;
  const bankLike = input.kind === "BANK_ACCOUNT" || input.kind === "DIGITAL_WALLET";
  return {
    kind: input.kind,
    name,
    provider: opt(input.provider),
    holderName: bankLike ? opt(input.holderName) : null,
    cbuCvu: bankLike ? cbuCvu : null,
    alias: bankLike ? alias : null,
    merchantNumber: input.kind === "CARD_TERMINAL" ? opt(input.merchantNumber) : null,
    accountNumber: input.kind === "BANK_ACCOUNT" ? opt(input.accountNumber) : null,
    reference: opt(input.reference),
    showToCustomers: input.kind === "CASH" ? false : Boolean(input.showToCustomers),
  };
}

export async function createFund(agencyId: string, input: FundInput) {
  const data = cleanFund(input); // never the legajo's account: that one is created by ensureDefaultFunds
  const openingBalance =
    input.openingBalance === undefined || String(input.openingBalance).trim() === ""
      ? ZERO
      : parseMoney(input.openingBalance);
  if (openingBalance.isNaN()) throw new FinanceValidationError("Saldo inicial inválido.");
  const last = await prisma.agencyFund.aggregate({ where: { agencyId }, _max: { sortOrder: true } });
  return prisma.agencyFund.create({
    data: {
      agencyId,
      ...data,
      openingBalance,
      openingDate: parseDate(input.openingDate || todayIn(TZ)),
      sortOrder: (last._max.sortOrder ?? 0) + 1,
    },
  });
}

/** Edit details (kind cannot change; opening balance/date can be corrected). */
export async function updateFund(fundId: string, input: Omit<FundInput, "kind">) {
  const fund = await prisma.agencyFund.findUniqueOrThrow({ where: { id: fundId } });
  const data = cleanFund({ ...input, kind: fund.kind });
  if (fund.settlesAgencyId) data.showToCustomers = false; // the legajo's account is not for customers
  const openingBalance =
    input.openingBalance === undefined || String(input.openingBalance).trim() === ""
      ? fund.openingBalance
      : parseMoney(input.openingBalance);
  if (openingBalance.isNaN()) throw new FinanceValidationError("Saldo inicial inválido.");
  return prisma.agencyFund.update({
    where: { id: fundId },
    data: { ...data, openingBalance, openingDate: input.openingDate ? parseDate(input.openingDate) : fund.openingDate },
  });
}

// ─── Balances ──────────────────────────────────────────────────

async function fundBalance(fund: { id: string; openingBalance: Prisma.Decimal; openingDate: Date }, upTo: Date) {
  const sums = await prisma.fundMovement.groupBy({
    by: ["direction"],
    where: { fundId: fund.id, voidedAt: null, date: { gte: fund.openingDate, lte: upTo } },
    _sum: { amount: true },
  });
  const sum = (d: MovementDirection) => sums.find((s) => s.direction === d)?._sum.amount ?? ZERO;
  return fund.openingBalance.add(sum("IN")).sub(sum("OUT"));
}

/** Payment methods of an agency with their balance on `date` (default: today), plus the total. */
export async function agencyBalances(agencyId: string, date?: string) {
  await ensureDefaultFunds(agencyId);
  const upTo = dateValue(date ?? todayIn(TZ));
  const funds = await prisma.agencyFund.findMany({ where: { agencyId }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
  const rows = await Promise.all(funds.map(async (f) => ({ fund: f, balance: await fundBalance(f, upTo) })));
  const total = rows.reduce((acc, r) => acc.add(r.balance), ZERO);
  return { date: upTo.toISOString().slice(0, 10), funds: rows, total };
}

/** Group view: total per agency of the group (all payment methods). */
export async function groupFinanceTotals(groupId: string, date?: string) {
  const agencies = await prisma.agency.findMany({
    where: { active: true, groupId },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  const rows = await Promise.all(agencies.map(async (a) => ({ agency: a, total: (await agencyBalances(a.id, date)).total })));
  return { agencies: rows, total: rows.reduce((acc, r) => acc.add(r.total), ZERO) };
}

// ─── Movements ─────────────────────────────────────────────────

export type MovementInput = {
  fundId: string;
  date: string;
  direction: MovementDirection;
  amount: string | number;
  kind: Exclude<MovementKind, "TRANSFER">;
  description?: string | null;
  reference?: string | null;
  createdById?: string | null;
  cashSessionId?: string | null; // recorded in a cash session
  source?: "MANUAL" | "CASH_CLOSING" | "LOTTERY_TICKET";
};

async function assertDateOnOrAfterOpening(fundId: string, date: Date) {
  const fund = await prisma.agencyFund.findUniqueOrThrow({ where: { id: fundId } });
  if (date < fund.openingDate)
    throw new FinanceValidationError(
      `«${fund.name}» arranca el ${fund.openingDate.toISOString().slice(0, 10)}: corregí su saldo inicial para cargar movimientos anteriores.`,
    );
  if (!fund.active) throw new FinanceValidationError(`«${fund.name}» está pausado.`);
  return fund;
}

export async function addMovement(input: MovementInput) {
  const date = parseDate(input.date);
  await assertDateOnOrAfterOpening(input.fundId, date);
  return prisma.fundMovement.create({
    data: {
      fundId: input.fundId,
      date,
      direction: input.direction === "OUT" ? "OUT" : "IN",
      amount: parseAmount(input.amount),
      kind: input.kind,
      description: input.description?.trim() || null,
      reference: input.reference?.trim() || null,
      createdById: input.createdById ?? null,
      cashSessionId: input.cashSessionId ?? null,
      source: input.source ?? "MANUAL",
    },
  });
}

/** Move money between two payment methods of the same agency (two linked movements). */
export async function transferBetweenFunds(input: {
  fromFundId: string;
  toFundId: string;
  date: string;
  amount: string | number;
  description?: string | null;
  createdById?: string | null;
}) {
  if (input.fromFundId === input.toFundId) throw new FinanceValidationError("Elegí dos medios distintos.");
  const date = parseDate(input.date);
  const from = await assertDateOnOrAfterOpening(input.fromFundId, date);
  const to = await assertDateOnOrAfterOpening(input.toFundId, date);
  if (from.agencyId !== to.agencyId) throw new FinanceValidationError("Solo se transfiere entre medios de la misma agencia.");
  const amount = parseAmount(input.amount);
  const transferId = `tr_${randomBytes(12).toString("hex")}`;
  const common = {
    date,
    amount,
    kind: "TRANSFER" as const,
    description: input.description?.trim() || `${from.name} → ${to.name}`,
    transferId,
    createdById: input.createdById ?? null,
  };
  await prisma.$transaction([
    prisma.fundMovement.create({ data: { ...common, fundId: from.id, direction: "OUT" } }),
    prisma.fundMovement.create({ data: { ...common, fundId: to.id, direction: "IN" } }),
  ]);
  return transferId;
}

/** Void a movement (both legs when it is a transfer). Never deletes. */
export async function voidMovement(movementId: string, reason?: string | null) {
  const m = await prisma.fundMovement.findUniqueOrThrow({ where: { id: movementId } });
  if (m.voidedAt) return;
  await prisma.fundMovement.updateMany({
    where: m.transferId ? { transferId: m.transferId } : { id: m.id },
    data: { voidedAt: new Date(), voidReason: reason?.trim() || null },
  });
}

/** Latest movements of an agency (optionally one payment method), newest first. */
export function agencyMovements(agencyId: string, opts: { fundId?: string; take?: number } = {}) {
  return prisma.fundMovement.findMany({
    where: { fund: { agencyId }, ...(opts.fundId ? { fundId: opts.fundId } : {}) },
    include: { fund: { select: { name: true } }, createdBy: { select: { name: true } } },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: opts.take ?? 50,
  });
}
