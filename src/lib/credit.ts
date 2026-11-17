// Fiados: what customers owe an agency (spec: agency-finances).
// An account belongs to one agency. A charge made while a cash session is open is part of
// that shift's "Deuda de caja"; a payment brings money into a payment method (cash or the
// account the customer transferred to), also in the open session if there is one.
// Balance = charges − payments, never stored; entries are voided, never deleted.
import { Prisma } from "@/generated/prisma/client";
import { openSessionOf } from "@/lib/cash";
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

export async function createAccount(input: { agencyId: string; name: string; phone?: string | null; notes?: string | null }) {
  const name = input.name.trim();
  if (name.length < 2) throw new FinanceValidationError("Poné el nombre del cliente.");
  const phone = input.phone?.replace(/\D/g, "") || null;
  // Link to the WhatsApp customer when the agency already knows that cellphone.
  const customer = phone
    ? await prisma.customer.findFirst({ where: { cellphoneNumber: { endsWith: phone.slice(-10) }, agencies: { some: { agencyId: input.agencyId } } } })
    : null;
  return prisma.creditAccount.create({
    data: { agencyId: input.agencyId, name, phone, notes: input.notes?.trim() || null, customerId: customer?.id ?? null },
  });
}

export async function updateAccount(accountId: string, input: { name: string; phone?: string | null; notes?: string | null; active?: boolean }) {
  const name = input.name.trim();
  if (name.length < 2) throw new FinanceValidationError("Poné el nombre del cliente.");
  return prisma.creditAccount.update({
    where: { id: accountId },
    data: { name, phone: input.phone?.replace(/\D/g, "") || null, notes: input.notes?.trim() || null, active: input.active },
  });
}

async function agencyToday(agencyId: string) {
  const agency = await prisma.agency.findUniqueOrThrow({ where: { id: agencyId }, select: { timezone: true } });
  return todayIn(agency.timezone);
}

/** Se le fió: in the open cash session, if any (its "Deuda de caja"). */
export async function chargeAccount(input: { accountId: string; amount: string | number; description?: string | null; userId?: string | null }) {
  const account = await prisma.creditAccount.findUniqueOrThrow({ where: { id: input.accountId } });
  if (!account.active) throw new FinanceValidationError("La cuenta está pausada.");
  const session = await openSessionOf(account.agencyId);
  const date = session ? session.date : dateValue(await agencyToday(account.agencyId));
  return prisma.creditEntry.create({
    data: {
      accountId: account.id,
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
export async function payAccount(input: { accountId: string; amount: string | number; fundId: string; userId?: string | null }) {
  const account = await prisma.creditAccount.findUniqueOrThrow({ where: { id: input.accountId } });
  const fund = await prisma.agencyFund.findUnique({ where: { id: input.fundId } });
  if (!fund || fund.agencyId !== account.agencyId || !fund.active) throw new FinanceValidationError("Elegí dónde entró la plata.");
  const amount = parseAmount(input.amount);
  const session = await openSessionOf(account.agencyId);
  const date = session ? session.date.toISOString().slice(0, 10) : await agencyToday(account.agencyId);
  const movement = await addMovement({
    fundId: fund.id,
    date,
    direction: "IN",
    amount: amount.toString(),
    kind: "CUSTOMER_PAYMENT",
    description: `Pago de fiado · ${account.name}`,
    createdById: input.userId,
    cashSessionId: session?.id ?? null,
    source: session ? "CASH_CLOSING" : "MANUAL",
  });
  return prisma.creditEntry.create({
    data: {
      accountId: account.id,
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

/** Accounts of an agency with what each owes, biggest debt first; plus the total. */
export async function agencyCredit(agencyId: string) {
  const accounts = await prisma.creditAccount.findMany({
    where: { agencyId },
    include: { entries: { select: { kind: true, amount: true, voidedAt: true, date: true } } },
    orderBy: { name: "asc" },
  });
  const rows = accounts
    .map((a) => {
      const live = a.entries.filter((e) => !e.voidedAt);
      const last = live.reduce<Date | null>((d, e) => (!d || e.date > d ? e.date : d), null);
      return { account: a, balance: balanceOf(a.entries), lastDate: last };
    })
    .sort((x, y) => y.balance.comparedTo(x.balance) || x.account.name.localeCompare(y.account.name));
  return { rows, total: rows.reduce((a, r) => a.add(r.balance), ZERO) };
}

/** One account with its entries, newest first. */
export async function accountDetail(accountId: string) {
  const account = await prisma.creditAccount.findUniqueOrThrow({
    where: { id: accountId },
    include: {
      entries: {
        include: { createdBy: { select: { name: true } }, cashSession: { select: { shift: true, status: true } } },
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      },
    },
  });
  return { account, balance: balanceOf(account.entries) };
}

/** What the owner's customers owe, across agencies. */
export async function ownerCreditTotal(agencyIds: string[]) {
  const entries = await prisma.creditEntry.findMany({
    where: { voidedAt: null, account: { agencyId: { in: agencyIds } } },
    select: { kind: true, amount: true, voidedAt: true },
  });
  return balanceOf(entries);
}
