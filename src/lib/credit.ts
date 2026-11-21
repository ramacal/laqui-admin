// Fiados: what an agency's customers owe it (spec: agency-finances).
// Entries hang from the agency customer (src/lib/customers.ts), so a debt is per agency.
// A charge made while a cash session is open is part of that shift's "Deuda de caja"; a
// payment brings money into a payment method (cash or the account the customer transferred
// to), also in the open session if there is one.
// Balance = charges − payments, never stored; entries are voided, never deleted.
import { Prisma } from "@/generated/prisma/client";
import { openSessionOf } from "@/lib/cash";
import { fullName } from "@/lib/customers";
import { FinanceValidationError, addMovement, parseMoney, voidMovement } from "@/lib/finance";
import { prisma } from "@/lib/prisma";
import { dateValue, todayIn } from "@/lib/schedule";

const ZERO = new Prisma.Decimal(0);

function parseAmount(raw: string | number) {
  const value = parseMoney(raw);
  if (value.isNaN() || value.lte(0)) throw new FinanceValidationError("El monto tiene que ser mayor a cero.");
  if (value.decimalPlaces() > 2) throw new FinanceValidationError("El monto admite hasta 2 decimales.");
  return value;
}

async function agencyToday(agencyId: string) {
  const agency = await prisma.agency.findUniqueOrThrow({ where: { id: agencyId }, select: { timezone: true } });
  return todayIn(agency.timezone);
}

/** Se le fió: in the open cash session, if any (its "Deuda de caja"). */
export async function chargeCustomer(input: { customerId: string; amount: string | number; description?: string | null; userId?: string | null }) {
  const customer = await prisma.agencyCustomer.findUniqueOrThrow({ where: { id: input.customerId } });
  if (!customer.active) throw new FinanceValidationError("El cliente está pausado.");
  const session = await openSessionOf(customer.agencyId);
  const date = session ? session.date : dateValue(await agencyToday(customer.agencyId));
  return prisma.creditEntry.create({
    data: {
      customerId: customer.id,
      kind: "CHARGE",
      amount: parseAmount(input.amount),
      date,
      description: input.description?.trim() || null,
      cashSessionId: session?.id ?? null,
      createdById: input.userId ?? null,
    },
  });
}

/** Pagó: the money enters a payment method of the agency (cash or the account they transferred to). */
export async function payCustomer(input: { customerId: string; amount: string | number; fundId: string; userId?: string | null }) {
  const customer = await prisma.agencyCustomer.findUniqueOrThrow({ where: { id: input.customerId } });
  const fund = await prisma.agencyFund.findUnique({ where: { id: input.fundId } });
  if (!fund || fund.agencyId !== customer.agencyId || !fund.active || fund.settlesAgencyId) throw new FinanceValidationError("Elegí dónde entró la plata.");
  const amount = parseAmount(input.amount);
  const session = await openSessionOf(customer.agencyId);
  const date = session ? session.date.toISOString().slice(0, 10) : await agencyToday(customer.agencyId);
  const movement = await addMovement({
    fundId: fund.id,
    date,
    direction: "IN",
    amount: amount.toString(),
    kind: "CUSTOMER_PAYMENT",
    description: `Pago de fiado · ${customer.alias}`,
    createdById: input.userId,
    cashSessionId: session?.id ?? null,
    source: session ? "CASH_CLOSING" : "MANUAL",
  });
  return prisma.creditEntry.create({
    data: {
      customerId: customer.id,
      kind: "PAYMENT",
      amount,
      date: dateValue(date),
      description: fund.name,
      cashSessionId: session?.id ?? null,
      movementId: movement.id,
      createdById: input.userId ?? null,
    },
  });
}

/** Void an entry (and the payment's movement). Not allowed once its cash session is closed. */
export async function voidEntry(entryId: string, reason?: string | null) {
  const entry = await prisma.creditEntry.findUniqueOrThrow({ where: { id: entryId }, include: { cashSession: true } });
  if (entry.voidedAt) return;
  if (entry.cashSession && entry.cashSession.status !== "OPEN")
    throw new FinanceValidationError("Es de una caja ya cerrada: reabrila para anularlo.");
  if (entry.movementId) await voidMovement(entry.movementId, reason ?? "Pago de fiado anulado");
  await prisma.creditEntry.update({ where: { id: entryId }, data: { voidedAt: new Date(), voidReason: reason?.trim() || null } });
}

const balanceOf = (entries: { kind: "CHARGE" | "PAYMENT"; amount: Prisma.Decimal; voidedAt: Date | null }[]) =>
  entries.filter((e) => !e.voidedAt).reduce((a, e) => (e.kind === "CHARGE" ? a.add(e.amount) : a.sub(e.amount)), ZERO);

/** Customers of an agency with what each owes, biggest debt first; plus the total owed. */
export async function agencyCustomers(agencyId: string) {
  const customers = await prisma.agencyCustomer.findMany({
    where: { agencyId },
    include: { customer: true, creditEntries: { select: { kind: true, amount: true, voidedAt: true, date: true } } },
    orderBy: { alias: "asc" },
  });
  const rows = customers
    .map((c) => {
      const live = c.creditEntries.filter((e) => !e.voidedAt);
      const last = live.reduce<Date | null>((d, e) => (!d || e.date > d ? e.date : d), null);
      return { customer: c, name: fullName(c.customer), balance: balanceOf(c.creditEntries), lastDate: last };
    })
    .sort((x, y) => y.balance.comparedTo(x.balance) || x.customer.alias.localeCompare(y.customer.alias));
  return { rows, total: rows.reduce((a, r) => a.add(r.balance), ZERO) };
}

/** One agency customer with their fiado entries, newest first. */
export async function customerDetail(agencyCustomerId: string) {
  const customer = await prisma.agencyCustomer.findUniqueOrThrow({
    where: { id: agencyCustomerId },
    include: {
      customer: { include: { _count: { select: { agencies: true } } } },
      creditEntries: {
        include: { createdBy: { select: { name: true } }, cashSession: { select: { shift: true, status: true } } },
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      },
    },
  });
  return { customer, balance: balanceOf(customer.creditEntries) };
}

/** What the owner's customers owe, across agencies. */
export async function ownerCreditTotal(agencyIds: string[]) {
  const entries = await prisma.creditEntry.findMany({
    where: { voidedAt: null, customer: { agencyId: { in: agencyIds } } },
    select: { kind: true, amount: true, voidedAt: true },
  });
  return balanceOf(entries);
}
