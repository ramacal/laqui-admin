import Link from "next/link";
import { notFound } from "next/navigation";
import { agencyRole, canViewStaff, requireAccess } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { dateValue } from "@/lib/schedule";
import { agencySettlements, ticketLink } from "@/lib/settlement";
import { money } from "@/components/products/price-parts";
import { SettlementForm } from "@/components/finance/finance-forms";
import { createSettlementAction, voidSettlementAction } from "@/app/panel/finanzas/actions";

export const metadata = { title: "Liquidaciones de Lotería · Laqui" };

const fmt = (d: Date | string) =>
  (typeof d === "string" ? dateValue(d) : d).toLocaleDateString("es-AR", {
    timeZone: "UTC",
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });

// Daily Lotería settlement tickets of an agency (owners and agency admins only).
export default async function SettlementsPage({ params }: { params: Promise<{ agencyId: string }> }) {
  const { agencyId } = await params;
  const access = await requireAccess();
  if (!canViewStaff(agencyRole(access, agencyId))) notFound();

  const agency = await prisma.agency.findUnique({
    where: { id: agencyId },
    select: { name: true, funds: { where: { settlesAgencyId: agencyId }, select: { accountNumber: true } } },
  });
  if (!agency) notFound();

  const { today, rows, missing, upcoming } = await agencySettlements(agencyId);
  const tomorrow = new Date(dateValue(today).getTime() + 86_400_000).toISOString().slice(0, 10);
  const links = new Map(
    await Promise.all(
      rows.filter((r) => r.ticketKey).map(async (r) => [r.id, await ticketLink(r.ticketKey!)] as const),
    ),
  );

  return (
    <main className="screen">
      <Link href={`/panel/agencias/${agencyId}`} className="back">
        ← {agency.name}
      </Link>
      <div className="stack-xs">
        <h1>Liquidaciones de Lotería</h1>
        <p className="muted small">
          El ticket diario de la terminal: queda registrado en la cuenta del legajo con fecha de vencimiento.
        </p>
      </div>

      {upcoming.length > 0 && (
        <section className="card stack-xs status is-open">
          <strong>Próximos movimientos en la cuenta</strong>
          {upcoming.map((u) => (
            <span key={u.id} className="small">
              {u.direction === "DEBIT" ? "Débito" : "Crédito"} de {money(u.amount.toString())} el {fmt(u.dueDate)}
            </span>
          ))}
        </section>
      )}

      {missing.length > 0 && (
        <section className="card stack-xs">
          <strong className="warn">Días sin ticket cargado (últimas 2 semanas)</strong>
          <span className="small muted">{missing.map((d) => fmt(d)).join(" · ")}</span>
        </section>
      )}

      <section className="card stack-sm">
        <h2>Cargar ticket</h2>
        <SettlementForm
          action={createSettlementAction.bind(null, agencyId)}
          today={today}
          tomorrow={tomorrow}
          accountNumber={agency.funds[0]?.accountNumber ?? null}
        />
      </section>

      <section className="card stack-sm">
        <h2>Tickets cargados</h2>
        {rows.length === 0 ? (
          <p className="muted small">Todavía no hay tickets cargados.</p>
        ) : (
          <ul className="list plain">
            {rows.map((r) => (
              <li key={r.id} className={`row exception-row ${r.voidedAt ? "voided" : ""}`}>
                <div className="stack-xs">
                  <strong className="small">
                    Ticket del {fmt(r.issueDate)} · VTO {fmt(r.dueDate)}
                    {r.voidedAt ? " · ANULADO" : ""}
                  </strong>
                  <span className="small muted">
                    {r.accountNumber ?? "sin cuenta"}
                    {r.createdBy ? ` · ${r.createdBy.name}` : ""}
                    {r.notes ? ` · ${r.notes}` : ""}
                    {links.get(r.id) ? (
                      <>
                        {" · "}
                        <a href={links.get(r.id)} target="_blank" rel="noreferrer" className="link">
                          ver foto
                        </a>
                      </>
                    ) : null}
                  </span>
                </div>
                <div className="row-actions">
                  <strong className={`small ${r.direction === "DEBIT" ? "error" : "ok-text"}`}>
                    {r.direction === "DEBIT" ? "−" : "+"}
                    {money(r.amount.toString())}
                  </strong>
                  {!r.voidedAt && (
                    <form action={voidSettlementAction.bind(null, r.id)}>
                      <button type="submit" className="btn btn-secondary btn-sm">
                        Anular
                      </button>
                    </form>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="muted small">Si un ticket se cargó mal, anulalo y cargalo de nuevo para ese día.</p>
      </section>
    </main>
  );
}
