import Link from "next/link";
import { notFound } from "next/navigation";
import { agencyRole, canViewStaff, requireAccess } from "@/lib/access";
import { MOVEMENT_KIND_LABEL, agencyBalances, agencyMovements } from "@/lib/finance";
import { prisma } from "@/lib/prisma";
import { todayIn } from "@/lib/schedule";
import { money } from "@/components/products/price-parts";
import { MovementForm, TransferForm } from "@/components/finance/finance-forms";
import { addMovementAction, transferAction, voidMovementAction } from "@/app/panel/finanzas/actions";

export const metadata = { title: "Movimientos · Laqui" };

const fmtDate = (d: Date) =>
  d.toLocaleDateString("es-AR", { timeZone: "UTC", day: "2-digit", month: "2-digit", year: "2-digit" });

// Operatoria: money in and out of each payment method. The methods themselves are configured
// in /medios.
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

  return (
    <main className="screen">
      <Link href={`/panel/agencias/${agencyId}`} className="back">
        ← {agency.name}
      </Link>
      <h1>Movimientos</h1>

      <section className="card stack-sm">
        <div className="stack-xs">
          <span className="small muted">Total en todos los medios, hoy</span>
          <strong className={`big-number ${total.isNegative() ? "error" : ""}`}>{money(total.toString())}</strong>
        </div>
        <ul className="list plain">
          {funds
            .filter(({ fund }) => fund.active)
            .map(({ fund, balance }) => (
              <li key={fund.id}>
                <Link href={`?medio=${fund.id}#movimientos`} className="row exception-row link" scroll={false}>
                  <span className="small">
                    {fund.name}
                    {fund.settlesAgencyId ? <span className="muted"> · cuenta del legajo</span> : null}
                  </span>
                  <strong className={`small ${balance.isNegative() ? "error" : ""}`}>{money(balance.toString())}</strong>
                </Link>
              </li>
            ))}
        </ul>
        <Link href={`/panel/agencias/${agencyId}/medios`} className="link small">
          Configurar medios de cobro
        </Link>
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
