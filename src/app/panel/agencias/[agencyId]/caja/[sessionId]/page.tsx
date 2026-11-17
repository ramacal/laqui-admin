import Link from "next/link";
import { notFound } from "next/navigation";
import type { Prisma } from "@/generated/prisma/client";
import { agencyRole, canViewStaff, requireAccess } from "@/lib/access";
import { SHIFT_LABEL, sessionSheet } from "@/lib/cash";
import { agencyCatalog } from "@/lib/catalog";
import { MOVEMENT_KIND_LABEL } from "@/lib/finance";
import { prisma } from "@/lib/prisma";
import { money } from "@/components/products/price-parts";
import { SimpleForm } from "@/components/schedule/simple-form";
import { LineForm } from "@/components/cash/line-form";
import {
  addLineAction,
  closeSessionAction,
  reopenSessionAction,
  setItemsAction,
  setMachineSalesAction,
  voidLineAction,
} from "@/app/panel/caja/actions";

export const metadata = { title: "Caja diaria · Laqui" };

const fmt = (d: Date) => d.toLocaleDateString("es-AR", { timeZone: "UTC", weekday: "long", day: "2-digit", month: "2-digit" });
const $ = (d: Prisma.Decimal | number) => money(d.toString());

function Line({ label, value, strong, muted }: { label: string; value: Prisma.Decimal; strong?: boolean; muted?: boolean }) {
  const Tag = strong ? "strong" : "span";
  return (
    <div className={`row small ${muted ? "muted" : ""}`}>
      <Tag>{label}</Tag>
      <Tag className={value.isNegative() ? "error" : ""}>{$(value)}</Tag>
    </div>
  );
}

// One cash session as the paper "Caja diaria": left column, right column, fiados and close.
export default async function CashSheetPage({ params }: { params: Promise<{ agencyId: string; sessionId: string }> }) {
  const { agencyId, sessionId } = await params;
  const access = await requireAccess();
  const role = agencyRole(access, agencyId);
  if (!role) notFound();
  const found = await prisma.cashSession.findUnique({ where: { id: sessionId }, select: { agencyId: true } });
  if (!found || found.agencyId !== agencyId) notFound();

  const sheet = await sessionSheet(sessionId);
  const { session, left, right, credit } = sheet;
  const isOpen = session.status === "OPEN";
  const agency = await prisma.agency.findUniqueOrThrow({
    where: { id: agencyId },
    select: { name: true, funds: { where: { active: true, kind: { not: "CASH" } }, select: { id: true, name: true }, orderBy: { sortOrder: "asc" } } },
  });
  const catalog = isOpen ? await agencyCatalog(agencyId, session.date.toISOString().slice(0, 10)) : null;
  const physical = catalog
    ? [
        ...catalog.games.filter((g) => g.saleMode === "PHYSICAL").map((g) => ({ key: `g:${g.id}`, id: g.id, name: g.name, price: g.price.amount })),
        ...catalog.products.filter((p) => p.saleMode === "PHYSICAL").map((p) => ({ key: `p:${p.id}`, id: p.id, name: p.name, price: p.unitPrice.amount })),
      ]
    : [];
  const qty = (id: string) => left.items.find((i) => i.gameId === id || i.ownerProductId === id)?.quantity ?? "";
  const lines = sheet.movements.filter((m) => m.reference !== "apertura-de-caja");

  return (
    <main className="screen">
      <Link href={`/panel/agencias/${agencyId}/caja`} className="back">
        ← Caja de {agency.name}
      </Link>
      <div className="stack-xs">
        <h1>Caja diaria</h1>
        <p className="muted small">
          {SHIFT_LABEL[session.shift]} · {fmt(session.date)} · {isOpen ? "abierta" : "cerrada"}
          {session.openedBy ? ` · abrió ${session.openedBy.name}` : ""}
          {session.closedBy ? ` · cerró ${session.closedBy.name}` : ""}
        </p>
      </div>

      <section className="card stack-xs">
        <h2>Entradas</h2>
        <Line label="Cambio inicial" value={left.openingCash} />
        {left.items.map((i) => (
          <Line key={i.id} label={`${i.name} × ${i.quantity}`} value={i.total} />
        ))}
        <Line label="Ingreso de efectivo" value={left.cashIn} />
        <Line label="Venta (reporte de la máquina)" value={left.machineSales} />
        {!left.creditPaymentsCash.isZero() && <Line label="Cobros de fiado en efectivo" value={left.creditPaymentsCash} />}
        {!left.otherCashIn.isZero() && <Line label="Otros ingresos" value={left.otherCashIn} />}
        <Line label="Total" value={left.total} strong />
      </section>

      <section className="card stack-xs">
        <h2>Salidas</h2>
        <Line label="Acierto raspaditas" value={right.prizesScratch} />
        <Line label="Acierto quiniela" value={right.prizesQuiniela} />
        {!right.prizesOther.isZero() && <Line label="Otros aciertos" value={right.prizesOther} />}
        <Line label="Retiros" value={right.withdrawals} />
        <Line label="Gastos" value={right.expenses} />
        <Line label="Transferencias" value={right.transfers} />
        {right.transfersByAccount.map((a) => (
          <Line key={a.name} label={`· ${a.name}`} value={a.total} muted />
        ))}
        {!right.otherCashOut.isZero() && <Line label="Otras salidas" value={right.otherCashOut} />}
        <Line label="Total" value={right.total} strong />
      </section>

      <section className="card stack-xs">
        <Line label="Deuda de caja (fiados del turno)" value={credit.debt} />
        {credit.charges.map((c) => (
          <Line key={c.id} label={`· ${c.customer.alias}${c.description ? ` (${c.description})` : ""}`} value={c.amount} muted />
        ))}
        <Line label="Efectivo esperado" value={sheet.expectedCash} strong />
        {session.countedCash && (
          <>
            <Line label="Efectivo contado" value={session.countedCash} strong />
            <Line label={sheet.difference!.isZero() ? "Diferencia" : sheet.difference!.isNegative() ? "Faltante" : "Sobrante"} value={sheet.difference!.abs()} />
          </>
        )}
        <Link href={`/panel/agencias/${agencyId}/fiados`} className="link small">
          Cargar un fiado o un pago de fiado →
        </Link>
      </section>

      {isOpen && (
        <>
          <section className="card stack-sm">
            <h2>Cargar en la caja</h2>
            <LineForm action={addLineAction.bind(null, sessionId)} accounts={agency.funds} />
          </section>

          {physical.length > 0 && (
            <section className="card stack-sm">
              <h2>Productos físicos vendidos</h2>
              <SimpleForm action={setItemsAction.bind(null, sessionId)} submitLabel="Guardar cantidades">
                {physical.map((p) => (
                  <label key={p.key} className="field">
                    <span className="small muted">
                      {p.name} · {money(p.price.toString())} c/u
                    </span>
                    <input name={`qty:${p.key}`} className="input" inputMode="numeric" defaultValue={qty(p.id)} placeholder="0" />
                  </label>
                ))}
              </SimpleForm>
            </section>
          )}

          <section className="card stack-sm">
            <h2>Venta de la máquina</h2>
            <SimpleForm action={setMachineSalesAction.bind(null, sessionId)} submitLabel="Guardar venta">
              <label className="field">
                <span className="small muted">Recaudación del turno según el reporte de la terminal ($)</span>
                <input name="machineSales" className="input" inputMode="decimal" defaultValue={session.machineSales?.toString() ?? ""} required />
              </label>
            </SimpleForm>
          </section>

          <section className="card stack-sm">
            <h2>Cerrar caja</h2>
            <SimpleForm action={closeSessionAction.bind(null, sessionId)} submitLabel="Cerrar caja">
              <label className="field">
                <span className="small muted">Efectivo: lo que queda en la caja al cerrar ($)</span>
                <input name="countedCash" className="input" inputMode="decimal" required />
              </label>
              <label className="field">
                <span className="small muted">Nota (opcional)</span>
                <input name="notes" className="input" maxLength={200} />
              </label>
            </SimpleForm>
          </section>
        </>
      )}

      {!isOpen && canViewStaff(role) && (
        <form action={reopenSessionAction.bind(null, sessionId)}>
          <button type="submit" className="btn btn-secondary btn-sm">
            Reabrir caja
          </button>
        </form>
      )}

      <section className="card stack-sm">
        <h2>Movimientos del turno</h2>
        {lines.length === 0 ? (
          <p className="muted small">Todavía no hay movimientos.</p>
        ) : (
          <ul className="list plain">
            {lines.map((m) => (
              <li key={m.id} className={`row exception-row ${m.voidedAt ? "voided" : ""}`}>
                <div className="stack-xs">
                  <strong className="small">
                    {m.description && m.kind === "PRIZE_PAYOUT" ? m.description : MOVEMENT_KIND_LABEL[m.kind]}
                    {m.reference === "acierto-quiniela" ? " · quiniela" : m.reference === "acierto-raspaditas" ? " · raspaditas" : ""}
                    {m.voidedAt ? " · ANULADO" : ""}
                  </strong>
                  <span className="small muted">
                    {m.fund.name}
                                        {m.description && m.kind !== "PRIZE_PAYOUT" ? ` · ${m.description}` : ""}
                  </span>
                </div>
                <div className="row-actions">
                  <strong className={`small ${m.direction === "OUT" ? "error" : "ok-text"}`}>
                    {m.direction === "OUT" ? "−" : "+"}
                    {$(m.amount)}
                  </strong>
                  {isOpen && !m.voidedAt && !m.creditEntry && (
                    <form action={voidLineAction.bind(null, m.id)}>
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
      </section>
    </main>
  );
}
