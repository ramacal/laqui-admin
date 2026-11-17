import Link from "next/link";
import { notFound } from "next/navigation";
import { agencyRole, canViewStaff, requireAccess } from "@/lib/access";
import { FUND_KIND_LABEL, MOVEMENT_KIND_LABEL, agencyBalances, agencyMovements } from "@/lib/finance";
import { prisma } from "@/lib/prisma";
import { todayIn } from "@/lib/schedule";
import { agencySettlements } from "@/lib/settlement";
import { money } from "@/components/products/price-parts";
import { EditFundForm, MovementForm, NewFundForm, TransferForm } from "@/components/finance/finance-forms";
import {
  addMovementAction,
  createFundAction,
  setFundActive,
  transferAction,
  updateFundAction,
  voidMovementAction,
} from "@/app/panel/finanzas/actions";

export const metadata = { title: "Finanzas de la agencia · Laqui" };

const iso = (d: Date) => d.toISOString().slice(0, 10);
const fmtDate = (d: Date) =>
  d.toLocaleDateString("es-AR", { timeZone: "UTC", day: "2-digit", month: "2-digit", year: "2-digit" });

export default async function AgencyFinancesPage({
  params,
  searchParams,
}: {
  params: Promise<{ agencyId: string }>;
  searchParams: Promise<{ medio?: string }>;
}) {
  const { agencyId } = await params;
  const { medio } = await searchParams;
  const access = await requireAccess();
  if (!canViewStaff(agencyRole(access, agencyId))) notFound(); // owners and agency admins only

  const agency = await prisma.agency.findUnique({ where: { id: agencyId }, select: { name: true, timezone: true } });
  if (!agency) notFound();
  const today = todayIn(agency.timezone);

  const { funds, total } = await agencyBalances(agencyId);
  const activeFunds = funds.filter((f) => f.fund.active).map((f) => ({ id: f.fund.id, name: f.fund.name }));
  const filterFund = funds.find((f) => f.fund.id === medio)?.fund;
  const movements = await agencyMovements(agencyId, { fundId: filterFund?.id, take: 60 });
  const { upcoming, missing } = await agencySettlements(agencyId);

  return (
    <main className="screen">
      <Link href={`/panel/agencias/${agencyId}`} className="back">
        ← {agency.name}
      </Link>
      <h1>Finanzas</h1>

      <section className="card stack-xs">
        <span className="small muted">Total en todos los medios, hoy</span>
        <strong className={`big-number ${total.isNegative() ? "error" : ""}`}>{money(total.toString())}</strong>
      </section>

      <Link href={`/panel/agencias/${agencyId}/liquidaciones`} className="card row link-card">
        <div className="stack-xs">
          <strong>Liquidaciones de Lotería</strong>
          <span className="small muted">
            {upcoming.length
              ? upcoming
                  .map((u) => `${u.direction === "DEBIT" ? "Débito" : "Crédito"} de ${money(u.amount.toString())} el ${u.dueDate.toISOString().slice(8, 10)}/${u.dueDate.toISOString().slice(5, 7)}`)
                  .join(" · ")
              : "Cargá el ticket diario de la terminal"}
            {missing.length ? ` · ${missing.length} día(s) sin ticket` : ""}
          </span>
        </div>
        <span className="chevron" aria-hidden="true">
          ›
        </span>
      </Link>

      <section className="stack-sm">
        <h2>Medios de cobro</h2>
        <ul className="list">
          {funds.map(({ fund, balance }) => (
            <li key={fund.id} className="card stack-sm">
              <div className="row">
                <div className="stack-xs">
                  <strong className={fund.active ? "" : "muted"}>{fund.name}</strong>
                  <span className="small muted">
                    {FUND_KIND_LABEL[fund.kind]}
                    {fund.provider ? ` · ${fund.provider}` : ""}
                    {fund.alias ? ` · alias ${fund.alias}` : ""}
                    {!fund.active ? " · pausado" : ""}
                  </span>
                  {fund.reference && <span className="small muted">{fund.reference}</span>}
                </div>
                <strong className={balance.isNegative() ? "error" : ""}>{money(balance.toString())}</strong>
              </div>
              <div className="tags">
                <Link href={`?medio=${fund.id}#movimientos`} className="tag" scroll={false}>
                  Ver movimientos
                </Link>
                {fund.showToCustomers && <span className="tag ok">Se muestra a clientes</span>}
              </div>
              <details>
                <summary className="small">Editar datos</summary>
                <div className="stack-sm spaced">
                  <EditFundForm
                    action={updateFundAction.bind(null, fund.id)}
                    kind={fund.kind}
                    today={today}
                    values={{
                      name: fund.name,
                      provider: fund.provider,
                      holderName: fund.holderName,
                      cbuCvu: fund.cbuCvu,
                      alias: fund.alias,
                      merchantNumber: fund.merchantNumber,
                      accountNumber: fund.accountNumber,
                      reference: fund.reference,
                      showToCustomers: fund.showToCustomers,
                      openingBalance: fund.openingBalance.toString(),
                      openingDate: iso(fund.openingDate),
                    }}
                  />
                  {fund.kind !== "BANK_ACCOUNT" && (
                    <form action={setFundActive.bind(null, fund.id, !fund.active)}>
                      <button type="submit" className="btn btn-secondary btn-sm">
                        {fund.active ? "Pausar este medio" : "Reactivar"}
                      </button>
                    </form>
                  )}
                </div>
              </details>
            </li>
          ))}
        </ul>
        <details className="card">
          <summary>Agregar medio de cobro</summary>
          <div className="spaced">
            <NewFundForm action={createFundAction.bind(null, agencyId)} today={today} />
          </div>
        </details>
      </section>

      <section className="card stack-sm">
        <h2>Cargar movimiento</h2>
        <MovementForm action={addMovementAction.bind(null, agencyId)} funds={activeFunds} today={today} />
        {activeFunds.length > 1 && (
          <details>
            <summary className="small">Transferir entre medios (ej.: depositar la caja en el banco)</summary>
            <div className="spaced">
              <TransferForm action={transferAction.bind(null, agencyId)} funds={activeFunds} today={today} />
            </div>
          </details>
        )}
      </section>

      <section className="card stack-sm" id="movimientos">
        <div className="row">
          <h2>Movimientos{filterFund ? ` · ${filterFund.name}` : ""}</h2>
          {filterFund && (
            <Link href="?#movimientos" className="link small" scroll={false}>
              Ver todos
            </Link>
          )}
        </div>
        {movements.length === 0 ? (
          <p className="muted small">Todavía no hay movimientos.</p>
        ) : (
          <ul className="list plain">
            {movements.map((m) => (
              <li key={m.id} className={`row exception-row ${m.voidedAt ? "voided" : ""}`}>
                <div className="stack-xs">
                  <strong className="small">
                    {fmtDate(m.date)} · {MOVEMENT_KIND_LABEL[m.kind]}
                    {m.voidedAt ? " · ANULADO" : ""}
                  </strong>
                  <span className="small muted">
                    {m.fund.name}
                    {m.description ? ` · ${m.description}` : ""}
                    {m.reference ? ` · ref. ${m.reference}` : ""}
                    {m.createdBy ? ` · ${m.createdBy.name}` : ""}
                  </span>
                </div>
                <div className="row-actions">
                  <strong className={`small ${m.direction === "OUT" ? "error" : "ok-text"}`}>
                    {m.direction === "OUT" ? "−" : "+"}
                    {money(m.amount.toString())}
                  </strong>
                  {!m.voidedAt && (
                    <form action={voidMovementAction.bind(null, m.id)}>
                      <button type="submit" className="btn btn-secondary btn-sm" aria-label="Anular movimiento">
                        Anular
                      </button>
                    </form>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
