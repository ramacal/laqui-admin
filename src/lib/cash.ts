// Cash sessions ("cajas") per agency, date and shift, mirroring the paper "Caja diaria"
// (spec: agency-finances). A day uses either a single shift or morning + afternoon.
//
//   Left column (what the drawer should hold)    Right column (what left the drawer)
//   cambio inicial                               aciertos raspaditas / quiniela / otros
//   physical products (quantity × price)         retiros
//   ingreso de efectivo                          gastos
//   venta (machine report)                       transferencias (sales paid to an account)
//   cobros de fiado en efectivo
//
//   Efectivo esperado = left − right − deuda de caja (fiados of the shift).
//
// Lines are movements on the agency's payment methods, so balances stay current: cash lines
// go to "Efectivo", transfers to the account they landed in. Sales are only known at close:
// closing records the shift's cash sales as one SALE movement, and the difference between
// the counted cash ("Efectivo") and the expected one as an adjustment. An opening cash that
// differs from the "Efectivo" balance is recorded as an opening adjustment.
import { Prisma } from "@/generated/prisma/client";
import type { CashShift, MovementKind } from "@/generated/prisma/enums";
import { agencyCatalog } from "@/lib/catalog";
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

const REF = {
  open: "apertura-de-caja",
  close: "cierre-de-caja",
  sale: "venta-del-turno",
  prizeScratch: "acierto-raspaditas",
  prizeQuiniela: "acierto-quiniela",
} as const;

/** Lines that can be loaded during the shift, as on the sheet. */
export const SHEET_LINES = {
  CASH_IN: { label: "Ingreso de efectivo", kind: "CASH_IN", direction: "IN", reference: null },
  PRIZE_SCRATCH: { label: "Acierto raspaditas", kind: "PRIZE_PAYOUT", direction: "OUT", reference: REF.prizeScratch },
  PRIZE_QUINIELA: { label: "Acierto quiniela", kind: "PRIZE_PAYOUT", direction: "OUT", reference: REF.prizeQuiniela },
  PRIZE_OTHER: { label: "Otros aciertos", kind: "PRIZE_PAYOUT", direction: "OUT", reference: null },
  WITHDRAWAL: { label: "Retiro", kind: "WITHDRAWAL", direction: "OUT", reference: null },
  EXPENSE: { label: "Gasto", kind: "EXPENSE", direction: "OUT", reference: null },
  TRANSFER: { label: "Transferencia", kind: "CUSTOMER_PAYMENT", direction: "IN", reference: null },
} as const satisfies Record<string, { label: string; kind: MovementKind; direction: "IN" | "OUT"; reference: string | null }>;
export type SheetLine = keyof typeof SHEET_LINES;
export const isSheetLine = (v: string): v is SheetLine => v in SHEET_LINES;

function parseCash(raw: string | number, label: string) {
  const value = parseMoney(raw);
  if (value.isNaN() || value.isNegative()) throw new FinanceValidationError(`${label}: un monto de $0 o más.`);
  if (value.decimalPlaces() > 2) throw new FinanceValidationError(`${label}: hasta 2 decimales.`);
  return value;
}

async function cashFundOf(agencyId: string) {
  return prisma.agencyFund.findFirst({ where: { agencyId, kind: "CASH", active: true }, orderBy: { sortOrder: "asc" } });
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

/** Suggested opening cash ("cambio inicial"): the cash counted when the previous session closed. */
export async function suggestedOpeningCash(agencyId: string) {
  const last = await prisma.cashSession.findMany({
    where: { agencyId, status: "CLOSED", countedCash: { not: null } },
    orderBy: [{ date: "desc" }, { closedAt: "desc" }],
    take: 1,
  });
  return last[0]?.countedCash ?? ZERO;
}

/** The agency's open session, if any (only one at a time). */
export function openSessionOf(agencyId: string) {
  return prisma.cashSession.findFirst({ where: { agencyId, status: "OPEN" } });
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
  if (await openSessionOf(input.agencyId)) throw new FinanceValidationError("Hay una caja abierta: cerrala antes de abrir otra.");
  const openingCash = parseCash(input.openingCash, "Cambio inicial");
  const session = await prisma.cashSession.create({
    data: { agencyId: input.agencyId, date, shift: input.shift, openingCash, openedById: input.userId ?? null },
  });

  // Keep the cash balance equal to the physical cash.
  const cashFund = await cashFundOf(input.agencyId);
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
          reference: REF.open,
          source: "CASH_CLOSING",
          cashSessionId: session.id,
          createdById: input.userId ?? null,
        },
      });
  }
  return session;
}

// ─── Lines during the shift ────────────────────────────────────

export async function openSessionOrFail(sessionId: string) {
  const session = await prisma.cashSession.findUniqueOrThrow({ where: { id: sessionId } });
  if (session.status !== "OPEN") throw new FinanceValidationError("La caja está cerrada.");
  return session;
}

/** A line of the sheet. Cash lines go to "Efectivo"; a transfer goes to the account it landed in. */
export async function addSheetLine(input: {
  sessionId: string;
  line: SheetLine;
  amount: string | number;
  fundId?: string | null; // transfers only
  description?: string | null;
  userId?: string | null;
}) {
  const session = await openSessionOrFail(input.sessionId);
  const def = SHEET_LINES[input.line];
  if (!def) throw new FinanceValidationError("Tipo de línea inválido.");
  let fundId: string;
  if (input.line === "TRANSFER") {
    const fund = input.fundId ? await prisma.agencyFund.findUnique({ where: { id: input.fundId } }) : null;
    if (!fund || fund.agencyId !== session.agencyId || fund.kind === "CASH" || !fund.active)
      throw new FinanceValidationError("Elegí la cuenta donde entró la transferencia.");
    fundId = fund.id;
  } else {
    const cash = await cashFundOf(session.agencyId);
    if (!cash) throw new FinanceValidationError("La agencia no tiene un medio de efectivo activo.");
    fundId = cash.id;
  }
  return addMovement({
    fundId,
    date: session.date.toISOString().slice(0, 10),
    direction: def.direction,
    amount: input.amount,
    kind: def.kind,
    description: input.description,
    reference: def.reference,
    createdById: input.userId,
    cashSessionId: session.id,
    source: "CASH_CLOSING",
  });
}

export async function voidSessionMovement(movementId: string) {
  const m = await prisma.fundMovement.findUniqueOrThrow({ where: { id: movementId }, include: { creditEntry: true } });
  if (!m.cashSessionId) throw new FinanceValidationError("Ese movimiento no es de una caja.");
  if (m.creditEntry) throw new FinanceValidationError("Es un pago de fiado: anulalo desde la cuenta del cliente.");
  await openSessionOrFail(m.cashSessionId);
  await voidMovement(movementId, "Anulado en la caja");
}

/** Physical products counted in the shift (quantity 0 removes the line). Price is today's. */
export async function setSessionItems(sessionId: string, quantities: Record<string, number>) {
  const session = await openSessionOrFail(sessionId);
  const { games, products } = await agencyCatalog(session.agencyId, session.date.toISOString().slice(0, 10));
  const physical = [
    ...games.filter((g) => g.saleMode === "PHYSICAL").map((g) => ({ key: `g:${g.id}`, gameId: g.id, ownerProductId: null, name: g.name, price: g.price.amount })),
    ...products
      .filter((p) => p.saleMode === "PHYSICAL")
      .map((p) => ({ key: `p:${p.id}`, gameId: null, ownerProductId: p.id, name: p.name, price: p.unitPrice.amount })),
  ];
  for (const [key, raw] of Object.entries(quantities)) {
    const item = physical.find((p) => p.key === key);
    if (!item) throw new FinanceValidationError("Ese producto no se vende por unidad en esta agencia.");
    if (!Number.isInteger(raw) || raw < 0 || raw > 100_000) throw new FinanceValidationError(`${item.name}: una cantidad entera.`);
  }
  await prisma.$transaction(async (tx) => {
    for (const item of physical) {
      if (!(item.key in quantities)) continue;
      const quantity = quantities[item.key];
      const where = item.gameId
        ? { sessionId_gameId: { sessionId, gameId: item.gameId } }
        : { sessionId_ownerProductId: { sessionId, ownerProductId: item.ownerProductId! } };
      if (quantity === 0) {
        await tx.cashSessionItem.deleteMany({ where: { sessionId, gameId: item.gameId, ownerProductId: item.ownerProductId } });
        continue;
      }
      await tx.cashSessionItem.upsert({
        where,
        create: { sessionId, gameId: item.gameId, ownerProductId: item.ownerProductId, name: item.name, quantity, unitPrice: item.price },
        update: { quantity, name: item.name, unitPrice: item.price },
      });
    }
  });
  return physical;
}

/** "Venta": what the terminal report says was sold in the shift (machine products). */
export async function setMachineSales(sessionId: string, amount: string | number) {
  await openSessionOrFail(sessionId);
  await prisma.cashSession.update({ where: { id: sessionId }, data: { machineSales: parseCash(amount, "Venta de la máquina") } });
}

// ─── The sheet ─────────────────────────────────────────────────

const isSessionAdjustment = (m: { kind: MovementKind; reference: string | null }) =>
  m.kind === "ADJUSTMENT" && (m.reference === REF.close || m.reference === REF.open);
const sum = <T>(rows: T[], f: (r: T) => Prisma.Decimal) => rows.reduce((a, r) => a.add(f(r)), ZERO);

/** The session as the paper sheet: left column, right column, fiados and expected cash. */
export async function sessionSheet(sessionId: string) {
  const session = await prisma.cashSession.findUniqueOrThrow({
    where: { id: sessionId },
    include: {
      movements: {
        include: { fund: { select: { id: true, name: true, kind: true } }, creditEntry: { include: { customer: { select: { alias: true } } } } },
        orderBy: { createdAt: "asc" },
      },
      items: { orderBy: { name: "asc" } },
      creditEntries: { where: { kind: "CHARGE" }, include: { customer: { select: { id: true, alias: true } } }, orderBy: { createdAt: "asc" } },
      openedBy: { select: { name: true } },
      closedBy: { select: { name: true } },
    },
  });
  // Activity of the shift: no voided lines, no balance adjustments, no sale (computed below).
  const live = session.movements.filter((m) => !m.voidedAt && !isSessionAdjustment(m) && m.kind !== "SALE");
  const cash = live.filter((m) => m.fund.kind === "CASH");
  const ofLine = (line: SheetLine) => {
    const def = SHEET_LINES[line];
    return live.filter(
      (m) => m.kind === def.kind && !m.creditEntry && (line === "TRANSFER" ? m.fund.kind !== "CASH" : m.fund.kind === "CASH") &&
        (def.reference ? m.reference === def.reference : line !== "PRIZE_OTHER" || (m.reference !== REF.prizeScratch && m.reference !== REF.prizeQuiniela)),
    );
  };
  const total = (rows: { amount: Prisma.Decimal }[]) => sum(rows, (r) => r.amount);

  const items = session.items.map((i) => ({ ...i, total: i.unitPrice.mul(i.quantity) }));
  const itemsTotal = sum(items, (i) => i.total);
  const machineSales = session.machineSales ?? ZERO;
  const cashIn = total(ofLine("CASH_IN"));
  const creditPaymentsCash = total(cash.filter((m) => m.creditEntry));
  const otherCashIn = total(cash.filter((m) => m.direction === "IN" && m.kind === "OTHER"));

  const prizesScratch = total(ofLine("PRIZE_SCRATCH"));
  const prizesQuiniela = total(ofLine("PRIZE_QUINIELA"));
  const prizesOther = total(ofLine("PRIZE_OTHER"));
  const withdrawals = total(ofLine("WITHDRAWAL"));
  const expenses = total(ofLine("EXPENSE"));
  const transfersRows = ofLine("TRANSFER");
  const transfers = total(transfersRows);
  const otherCashOut = total(cash.filter((m) => m.direction === "OUT" && m.kind === "OTHER"));
  const byAccount = new Map<string, { name: string; total: Prisma.Decimal }>();
  for (const m of transfersRows) {
    const row = byAccount.get(m.fund.id) ?? { name: m.fund.name, total: ZERO };
    row.total = row.total.add(m.amount);
    byAccount.set(m.fund.id, row);
  }
  const creditCharges = session.creditEntries.filter((e) => !e.voidedAt);
  const debt = total(creditCharges);

  const sales = itemsTotal.add(machineSales);
  // What the shift's sales left in cash: the rest was paid by transfer or fiado.
  const cashSales = sales.sub(transfers).sub(debt);
  const leftTotal = session.openingCash.add(itemsTotal).add(cashIn).add(machineSales).add(creditPaymentsCash).add(otherCashIn);
  const rightTotal = prizesScratch.add(prizesQuiniela).add(prizesOther).add(withdrawals).add(expenses).add(transfers).add(otherCashOut);
  const expectedCash = leftTotal.sub(rightTotal).sub(debt);
  const difference = session.countedCash ? session.countedCash.sub(expectedCash) : null;

  return {
    session,
    movements: session.movements,
    left: { openingCash: session.openingCash, items, itemsTotal, cashIn, machineSales, creditPaymentsCash, otherCashIn, total: leftTotal },
    right: {
      prizesScratch,
      prizesQuiniela,
      prizesOther,
      withdrawals,
      expenses,
      transfers,
      transfersByAccount: [...byAccount.values()],
      otherCashOut,
      total: rightTotal,
    },
    credit: { charges: creditCharges, debt },
    sales,
    cashSales,
    expectedCash,
    difference,
  };
}

// ─── Closing / reopening ───────────────────────────────────────

export async function closeSession(input: { sessionId: string; countedCash: string | number; userId?: string | null; notes?: string | null }) {
  const session = await openSessionOrFail(input.sessionId);
  if (session.machineSales === null)
    throw new FinanceValidationError("Cargá la venta del reporte de la máquina antes de cerrar (puede ser $0).");
  const counted = parseCash(input.countedCash, "Efectivo");
  const { expectedCash, cashSales } = await sessionSheet(session.id);
  const difference = counted.sub(expectedCash);
  const cashFund = await cashFundOf(session.agencyId);
  if (!cashFund) throw new FinanceValidationError("La agencia no tiene un medio de efectivo activo.");
  const common = { fundId: cashFund.id, date: session.date, source: "CASH_CLOSING" as const, cashSessionId: session.id, createdById: input.userId ?? null };
  const label = SHIFT_LABEL[session.shift].toLowerCase();

  await prisma.$transaction(async (tx) => {
    if (!cashSales.isZero())
      await tx.fundMovement.create({
        data: {
          ...common,
          direction: cashSales.isNegative() ? "OUT" : "IN",
          amount: cashSales.abs(),
          kind: "SALE",
          description: `Venta en efectivo (${label})`,
          reference: REF.sale,
        },
      });
    if (!difference.isZero())
      await tx.fundMovement.create({
        data: {
          ...common,
          direction: difference.isNegative() ? "OUT" : "IN",
          amount: difference.abs(),
          kind: "ADJUSTMENT",
          description: `Diferencia de caja (${label})`,
          reference: REF.close,
        },
      });
    await tx.cashSession.update({
      where: { id: session.id },
      data: { status: "CLOSED", countedCash: counted, closedById: input.userId ?? null, closedAt: new Date(), notes: input.notes?.trim() || null },
    });
  });
  return { expectedCash, counted, difference };
}

/** Owners/admins: reopen a closed session; its sale and close adjustment are voided. */
export async function reopenSession(sessionId: string) {
  const session = await prisma.cashSession.findUniqueOrThrow({ where: { id: sessionId }, include: { movements: true } });
  if (session.status === "OPEN") return;
  if (await openSessionOf(session.agencyId)) throw new FinanceValidationError("Hay otra caja abierta: cerrala antes de reabrir esta.");
  const generated = session.movements.filter(
    (m) => !m.voidedAt && ((m.kind === "ADJUSTMENT" && m.reference === REF.close) || (m.kind === "SALE" && m.reference === REF.sale)),
  );
  for (const m of generated) await voidMovement(m.id, "Caja reabierta");
  await prisma.cashSession.update({ where: { id: sessionId }, data: { status: "OPEN", countedCash: null, closedById: null, closedAt: null } });
}

/** Sessions of an agency from a date, newest first. */
export function agencySessions(agencyId: string, fromDate: string) {
  return prisma.cashSession.findMany({
    where: { agencyId, date: { gte: dateValue(fromDate) } },
    orderBy: [{ date: "desc" }, { openedAt: "desc" }],
  });
}

export const sortByShift = <T extends { shift: CashShift }>(rows: T[]) => [...rows].sort((a, b) => SHIFT_ORDER[a.shift] - SHIFT_ORDER[b.shift]);
