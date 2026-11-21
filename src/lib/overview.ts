// "Hoy en tus agencias": one row per agency with what an owner checks first thing (open now?,
// cash session, fiados, money) plus the things that need attention. Read-only; reuses the
// schedule, cash, credit and finance helpers.
import type { CashShift } from "@/generated/prisma/enums";
import { Prisma } from "@/generated/prisma/client";
import { SHIFT_LABEL } from "@/lib/cash";
import { agencyCustomers } from "@/lib/credit";
import { agencyBalances } from "@/lib/finance";
import { prisma } from "@/lib/prisma";
import { isAgencyOpen } from "@/lib/schedule";

const ZERO = new Prisma.Decimal(0);

export type CashState =
  | { kind: "open"; sessionId: string; shift: CashShift; date: string; stale: boolean }
  | { kind: "closed-today"; count: number }
  | { kind: "none-today" };

export type AttentionItem = {
  agencyId: string;
  agencyName: string;
  tone: "danger" | "warn";
  text: string;
  href: string;
};

export type AgencyOverview = {
  id: string;
  name: string;
  status: Awaited<ReturnType<typeof isAgencyOpen>>;
  cash: CashState;
  money: { fiados: Prisma.Decimal; balance: Prisma.Decimal } | null; // null: role can't see money
};

const shortDate = (iso: string) => {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
};

async function cashState(agencyId: string, today: string): Promise<CashState> {
  const open = await prisma.cashSession.findFirst({ where: { agencyId, status: "OPEN" } });
  if (open) {
    const date = open.date.toISOString().slice(0, 10);
    return { kind: "open", sessionId: open.id, shift: open.shift, date, stale: date < today };
  }
  const count = await prisma.cashSession.count({
    where: { agencyId, date: new Date(`${today}T00:00:00.000Z`) },
  });
  return count > 0 ? { kind: "closed-today", count } : { kind: "none-today" };
}

/** Overview of the given agencies. `withMoney` lists the agencies whose money the user may see. */
export async function agenciesOverview(
  agencies: { id: string; name: string; licenseNumber: string }[],
  withMoney: Set<string>,
) {
  const rows = await Promise.all(
    agencies.map(async (a): Promise<AgencyOverview & { licenseNumber: string }> => {
      const status = await isAgencyOpen(a.id);
      const today = status.date;
      const [cash, money] = await Promise.all([
        cashState(a.id, today),
        withMoney.has(a.id)
          ? Promise.all([agencyCustomers(a.id), agencyBalances(a.id, today)]).then(([c, b]) => ({
              fiados: c.total,
              balance: b.total,
            }))
          : null,
      ]);
      return { id: a.id, name: a.name, licenseNumber: a.licenseNumber, status, cash, money };
    }),
  );

  const attention: AttentionItem[] = [];
  for (const r of rows) {
    const base = `/panel/agencias/${r.id}`;
    if (r.cash.kind === "open" && r.cash.stale)
      attention.push({
        agencyId: r.id,
        agencyName: r.name,
        tone: "danger",
        text: `Caja abierta desde el ${shortDate(r.cash.date)} (${SHIFT_LABEL[r.cash.shift].toLowerCase()}): falta cerrarla`,
        href: `${base}/caja/${r.cash.sessionId}`,
      });
    if (r.status.open && r.cash.kind === "none-today")
      attention.push({
        agencyId: r.id,
        agencyName: r.name,
        tone: "warn",
        text: "Está abierta y todavía no se abrió la caja de hoy",
        href: `${base}/caja`,
      });
    if (r.status.holidayWithoutException && r.status.holiday)
      attention.push({
        agencyId: r.id,
        agencyName: r.name,
        tone: "warn",
        text: `Hoy es feriado (${r.status.holiday.name}) y abre con el horario habitual`,
        href: `${base}/horario`,
      });
    if (/^pend/i.test(r.licenseNumber))
      attention.push({
        agencyId: r.id,
        agencyName: r.name,
        tone: "warn",
        text: "Falta cargar el número de legajo",
        href: base,
      });
  }
  attention.sort((x, y) => (x.tone === y.tone ? 0 : x.tone === "danger" ? -1 : 1));

  const sum = (pick: (m: NonNullable<AgencyOverview["money"]>) => Prisma.Decimal) =>
    rows.reduce((acc, r) => (r.money ? acc.add(pick(r.money)) : acc), ZERO);
  const totals = {
    openNow: rows.filter((r) => r.status.open).length,
    cashOpen: rows.filter((r) => r.cash.kind === "open").length,
    showMoney: rows.some((r) => r.money),
    fiados: sum((m) => m.fiados),
    balance: sum((m) => m.balance),
  };

  return { rows, attention, totals };
}


