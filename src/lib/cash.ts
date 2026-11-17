// Cash sessions ("cajas") per agency, date and shift (spec: agency-finances).
// A day uses either a single shift or morning + afternoon, never both. Movements recorded
// in a session go to their payment method (cash, bank transfer, Mercado Pago…), so balances
// stay up to date. Expected cash = opening + cash in − cash out; on close, a non-zero
// difference is recorded as a cash adjustment linked to the session; an opening cash that
// differs from the "Efectivo" balance is recorded as an opening adjustment, so the cash
// balance always equals the physical cash.
import { Prisma } from "@/generated/prisma/client";
import type { CashShift, MovementKind } from "@/generated/prisma/enums";
import { FinanceValidationError, addMovement, agencyBalances, parseMoney, voidMovement } from "@/lib/finance";
import { prisma } from "@/lib/prisma";
import { dateValue } from "@/lib/schedule";

const ZERO = new Prisma.Decimal(0);
const SHIFT_ORDER: Record<CashShift, number> = { MORNING: 0, SINGLE: 0, AFTERNOON: 1 };

export const SHIFT_LABEL: Record<CashShift, string> = {
  MORNING: "Turno mañana",
  AFTERNOON: "Turno tarde",
  SINGLE: "Turno único",
};

/** Kinds that can be recorded at the counter. */
export const CASH_KINDS = ["CUSTOMER_PAYMENT", "PRIZE_PAYOUT", "EXPENSE", "OTHER"] as const;
export type CashKind = (typeof CASH_KINDS)[number];
const CLOSE_ADJUSTMENT_REF = "cierre-de-caja";
const OPEN_ADJUSTMENT_REF = "apertura-de-caja";

function parseCash(raw: string | number, label: string) {
  const value = parseMoney(raw);
  if (value.isNaN() || value.isNegative()) throw new FinanceValidationError(`${label}: un monto de $0 o más.`);
  if (value.decimalPlaces() > 2) throw new FinanceValidationError(`${label}: hasta 2 decimales.`);
  return value;
}

// ─── Opening ───────────────────────────────────────────────────

/** Next shift to open that day, following the agency's sessions per day; null if the day is complete. */
export async function suggestShift(agencyId: string, date: string): Promise<CashShift | null> {
  const agency = await prisma.agency.findUniqueOrThrow({ where: { id: agencyId }, select: { cashSessionsPerDay: true } });
  const taken = new Set(
    (await prisma.cashSession.findMany({ where: { agencyId, date: dateValue(date) }, select: { shift: true } })).map((s) => s.shift),
  );
  if (taken.has("SINGLE")) return null;
  if (agency.cashSessionsPerDay === 1 && taken.size === 0) return "SINGLE";
  if (!taken.has("MORNING")) return "MORNING";
  if (!taken.has("AFTERNOON")) return "AFTERNOON";
  return null;
}

/** Suggested opening cash: what was counted when the previous session closed. */
export async function suggestedOpeningCash(agencyId: string) {
  const last = await prisma.cashSession.findMany({
    where: { agencyId, status: "CLOSED", countedCash: { not: null } },
    orderBy: [{ date: "desc" }, { closedAt: "desc" }],
    take: 1,
  });
  return last[0]?.countedCash ?? ZERO;
}

export async function openSession(input: {
  agencyId: string;
  date: string;
  shift: CashShift;
  openingCash: string | number;
  userId?: string | null;
}) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) throw new FinanceValidationError("Fecha inválida.");
  const date = dateValue(input.date);
  const sameDay = await prisma.cashSession.findMany({ where: { agencyId: input.agencyId, date }, select: { shift: true } });
  const shifts = new Set(sameDay.map((s) => s.shift));
  if (shifts.has(input.shift)) throw new FinanceValidationError(`Ya hay una caja de ${SHIFT_LABEL[input.shift].toLowerCase()} ese día.`);
  if (input.shift === "SINGLE" && shifts.size > 0)
    throw new FinanceValidationError("Ese día ya se trabaja con turnos mañana/tarde: no se puede abrir turno único.");
  if (input.shift !== "SINGLE" && shifts.has("SINGLE"))
    throw new FinanceValidationError("Ese día ya tiene una caja de turno único.");
  const open = await prisma.cashSession.findFirst({ where: { agencyId: input.agencyId, status: "OPEN" } });
  if (open) throw new FinanceValidationError("Hay una caja abierta: cerrala antes de abrir otra.");
  const openingCash = parseCash(input.openingCash, "Efectivo inicial");
  const session = await prisma.cashSession.create({
    data: { agencyId: input.agencyId, date, shift: input.shift, openingCash, openedById: input.userId ?? null },
  });

  // Keep the cash balance equal to the physical cash: if the opening cash differs from
  // the "Efectivo" balance, record the gap as an opening adjustment of this session.
  const cashFund = await prisma.agencyFund.findFirst({
    where: { agencyId: input.agencyId, kind: "CASH", active: true },
    orderBy: { sortOrder: "asc" },
  });
  if (cashFund) {
    const { funds } = await agencyBalances(input.agencyId, input.date);
    const balance = funds.find((f) => f.fund.id === cashFund.id)?.balance ?? ZERO;
    const gap = openingCash.sub(balance);
    if (!gap.isZero() && date >= cashFund.openingDate)
      await prisma.fundMovement.create({
        data: {
          fundId: cashFund.id,
          date,
          direction: gap.isNegative() ? "OUT" : "IN",
          amount: gap.abs(),
          kind: "ADJUSTMENT",
          description: `Ajuste de apertura de caja (${SHIFT_LABEL[input.shift].toLowerCase()})`,
          reference: OPEN_ADJUSTMENT_REF,
          source: "CASH_CLOSING",
          cashSessionId: session.id,
          createdById: input.userId ?? null,
        },
      });
  }
  return session;
}

// ─── Movements and summary ─────────────────────────────────────

async function openSessionOrFail(sessionId: string) {
  const session = await prisma.cashSession.findUniqueOrThrow({ where: { id: sessionId } });
  if (session.status !== "OPEN") throw new FinanceValidationError("La caja está cerrada.");
  return session;
}

const DIRECTION: Record<CashKind, "IN" | "OUT"> = {
  CUSTOMER_PAYMENT: "IN",
  PRIZE_PAYOUT: "OUT",
  EXPENSE: "OUT",
  OTHER: "IN",
};

export async function addSessionMovement(input: {
  sessionId: string;
  fundId: string;
  kind: CashKind;
  amount: string | number;
  direction?: "IN" | "OUT"; // only for OTHER
  description?: string | null;
  userId?: string | null;
}) {
  const session = await openSessionOrFail(input.sessionId);
  const fund = await prisma.agencyFund.findUnique({ where: { id: input.fundId } });
  if (!fund || fund.agencyId !== session.agencyId) throw new FinanceValidationError("Elegí un medio de esta agencia.");
  if (!CASH_KINDS.includes(input.kind)) throw new FinanceValidationError("Tipo de movimiento inválido para la caja.");
  return addMovement({
    fundId: fund.id,
    date: session.date.toISOString().slice(0, 10),
    direction: input.kind === "OTHER" ? (input.direction ?? "IN") : DIRECTION[input.kind],
    amount: input.amount,
    kind: input.kind as Exclude<MovementKind, "TRANSFER">,
    description: input.description,
    createdById: input.userId,
    cashSessionId: session.id,
    source: "CASH_CLOSING",
  });
}

export async function voidSessionMovement(movementId: string) {
  const m = await prisma.fundMovement.findUniqueOrThrow({ where: { id: movementId } });
  if (!m.cashSessionId) throw new FinanceValidationError("Ese movimiento no es de una caja.");
  await openSessionOrFail(m.cashSessionId);
  await voidMovement(movementId, "Anulado en la caja");
}

const isCloseAdjustment = (m: { kind: MovementKind; reference: string | null }) =>
  m.kind === "ADJUSTMENT" && m.reference === CLOSE_ADJUSTMENT_REF;
/** Opening/closing adjustments align the cash balance; they are not part of the shift's activity. */
const isSessionAdjustment = (m: { kind: MovementKind; reference: string | null }) =>
  m.kind === "ADJUSTMENT" && (m.reference === CLOSE_ADJUSTMENT_REF || m.reference === OPEN_ADJUSTMENT_REF);

/** Totals of a session: per payment method, prizes, expenses, expected cash and difference. */
export async function sessionSummary(sessionId: string) {
  const session = await prisma.cashSession.findUniqueOrThrow({
    where: { id: sessionId },
    include: {
      movements: { include: { fund: { select: { id: true, name: true, kind: true } } }, orderBy: { createdAt: "asc" } },
      openedBy: { select: { name: true } },
      closedBy: { select: { name: true } },
    },
  });
  const live = session.movements.filter((m) => !m.voidedAt && !isSessionAdjustment(m));
  const signed = (m: (typeof live)[number]) => (m.direction === "IN" ? m.amount : m.amount.neg());

  const byFund = new Map<string, { name: string; kind: string; collected: Prisma.Decimal; net: Prisma.Decimal }>();
  for (const m of live) {
    const row = byFund.get(m.fund.id) ?? { name: m.fund.name, kind: m.fund.kind, collected: ZERO, net: ZERO };
    if (m.kind === "CUSTOMER_PAYMENT") row.collected = row.collected.add(m.amount);
    row.net = row.net.add(signed(m));
    byFund.set(m.fund.id, row);
  }
  const sumKind = (k: MovementKind) => live.filter((m) => m.kind === k).reduce((a, m) => a.add(m.amount), ZERO);
  const cashNet = live.filter((m) => m.fund.kind === "CASH").reduce((a, m) => a.add(signed(m)), ZERO);
  const expectedCash = session.openingCash.add(cashNet);
  const difference = session.countedCash ? session.countedCash.sub(expectedCash) : null;

  return {
    session,
    movements: session.movements,
    byFund: [...byFund.values()],
    collected: sumKind("CUSTOMER_PAYMENT"),
    prizes: sumKind("PRIZE_PAYOUT"),
    expenses: sumKind("EXPENSE"),
    expectedCash,
    difference,
  };
}

// ─── Closing / reopening ───────────────────────────────────────

export async function closeSession(input: { sessionId: string; countedCash: string | number; userId?: string | null; notes?: string | null }) {
  const session = await openSessionOrFail(input.sessionId);
  const counted = parseCash(input.countedCash, "Efectivo contado");
  const { expectedCash } = await sessionSummary(session.id);
  const difference = counted.sub(expectedCash);

  if (!difference.isZero()) {
    const cashFund = await prisma.agencyFund.findFirst({
      where: { agencyId: session.agencyId, kind: "CASH", active: true },
      orderBy: { sortOrder: "asc" },
    });
    if (!cashFund) throw new FinanceValidationError("La agencia no tiene un medio de efectivo activo.");
    await prisma.fundMovement.create({
      data: {
        fundId: cashFund.id,
        date: session.date,
        direction: difference.isNegative() ? "OUT" : "IN",
        amount: difference.abs(),
        kind: "ADJUSTMENT",
        description: `Diferencia de caja (${SHIFT_LABEL[session.shift].toLowerCase()})`,
        reference: CLOSE_ADJUSTMENT_REF,
        source: "CASH_CLOSING",
        cashSessionId: session.id,
        createdById: input.userId ?? null,
      },
    });
  }
  await prisma.cashSession.update({
    where: { id: session.id },
    data: {
      status: "CLOSED",
      countedCash: counted,
      closedById: input.userId ?? null,
      closedAt: new Date(),
      notes: input.notes?.trim() || null,
    },
  });
  return { expectedCash, counted, difference };
}

/** Owners/admins: reopen a closed session; its close adjustment is voided. */
export async function reopenSession(sessionId: string) {
  const session = await prisma.cashSession.findUniqueOrThrow({ where: { id: sessionId }, include: { movements: true } });
  if (session.status === "OPEN") return;
  const open = await prisma.cashSession.findFirst({ where: { agencyId: session.agencyId, status: "OPEN" } });
  if (open) throw new FinanceValidationError("Hay otra caja abierta: cerrala antes de reabrir esta.");
  for (const m of session.movements.filter((m) => !m.voidedAt && isCloseAdjustment(m))) await voidMovement(m.id, "Caja reabierta");
  await prisma.cashSession.update({
    where: { id: sessionId },
    data: { status: "OPEN", countedCash: null, closedById: null, closedAt: null },
  });
}

/** Sessions of an agency from a date, newest first. */
export function agencySessions(agencyId: string, fromDate: string) {
  return prisma.cashSession.findMany({
    where: { agencyId, date: { gte: dateValue(fromDate) } },
    orderBy: [{ date: "desc" }, { openedAt: "desc" }],
  });
}

export const sortByShift = <T extends { shift: CashShift }>(rows: T[]) =>
  [...rows].sort((a, b) => SHIFT_ORDER[a.shift] - SHIFT_ORDER[b.shift]);
