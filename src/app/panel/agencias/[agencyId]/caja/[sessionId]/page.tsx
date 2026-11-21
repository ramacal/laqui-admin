import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ChevronRight, RotateCcw, Undo2 } from "lucide-react";
import type { ReactNode } from "react";
import type { Prisma } from "@/generated/prisma/client";
import { agencyRole, canViewStaff, requireAccess } from "@/lib/access";
import { SHIFT_LABEL, sessionSheet } from "@/lib/cash";
import { agencyCatalog } from "@/lib/catalog";
import { MOVEMENT_KIND_LABEL } from "@/lib/finance";
import { prisma } from "@/lib/prisma";
import { todayIn } from "@/lib/schedule";
import { cn } from "@/lib/utils";
import { money } from "@/components/products/price-parts";
import { SimpleForm } from "@/components/schedule/simple-form";
import { CloseCash } from "@/components/cash/close-cash";
import { LineForm } from "@/components/cash/line-form";
import { Badge } from "@/components/ui/badge";
import { ConfirmAction } from "@/components/ui/confirm-action";
import { DashCard } from "@/components/ui/dash-card";
import { AddableList, InlineEdit } from "@/components/ui/editable-section";
import { PageHeader } from "@/components/ui/page-header";
import { Row, RowList } from "@/components/ui/row-list";
import { Missing } from "@/components/ui/settings-section";
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

/**
 * One line of the sheet: concept left, amount right. On an open caja every line keeps a slot at
 * the end (`slot`), so the amounts line up with the ones that have a pencil.
 */
function Line({
  label,
  value,
  strong,
  sub,
  slot,
}: {
  label: ReactNode;
  value: ReactNode;
  strong?: boolean; // totals
  sub?: boolean; // detail of the line above (fiados, accounts, products)
  slot?: boolean;
}) {
  return (
    <div className={cn("flex min-h-9 items-center gap-2", sub && "pl-3 text-sm text-muted-foreground", strong && "font-bold")}>
      <span className="min-w-0 flex-1">{label}</span>
      <span className="text-right whitespace-nowrap tabular-nums">{value}</span>
      {slot && <span className="w-9 shrink-0" aria-hidden="true" />}
    </div>
  );
}

const amount = (v: Prisma.Decimal) => <span className={v.isNegative() ? "text-destructive" : ""}>{$(v)}</span>;

function Column({ title, total, children }: { title: string; total: Prisma.Decimal; children: ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col rounded-xl border border-solid border-border bg-card p-4 shadow-[0_1px_2px_rgba(19,20,43,0.05)] sm:p-5">
      <h2 className="m-0 mb-1 text-base font-bold">{title}</h2>
      <div className="flex flex-1 flex-col">{children}</div>
      <div className="mt-2 flex items-center justify-between border-0 border-t border-solid border-border pt-3 font-bold">
        <span>Total</span>
        <span className="text-lg tabular-nums">{$(total)}</span>
      </div>
    </section>
  );
}

function Figure({ label, value, tone, detail }: { label: string; value: string; tone?: "ok" | "bad"; detail?: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-lg bg-muted p-3.5">
      <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{label}</span>
      <strong className={cn("text-2xl leading-tight tabular-nums", tone === "ok" && "text-success", tone === "bad" && "text-destructive")}>
        {value}
      </strong>
      {detail && <span className="text-sm text-muted-foreground">{detail}</span>}
    </div>
  );
}

// One cash session as the paper "Caja diaria": left column (entradas) and right column (salidas),
// then fiados, expected and counted cash. While open, the online sale and the physical products
// are edited on their own line, movements are added below and the caja is closed at the end.
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
    select: {
      name: true,
      timezone: true,
      funds: { where: { active: true, kind: { not: "CASH" }, settlesAgencyId: null }, select: { id: true, name: true }, orderBy: { sortOrder: "asc" } },
    },
  });
  const sessionDate = session.date.toISOString().slice(0, 10);
  const stale = isOpen && sessionDate < todayIn(agency.timezone);
  const catalog = isOpen ? await agencyCatalog(agencyId, sessionDate) : null;
  const physical = catalog
    ? [
        ...catalog.games.filter((g) => g.saleMode === "PHYSICAL").map((g) => ({ key: `g:${g.id}`, id: g.id, name: g.name, price: g.price.amount })),
        ...catalog.products.filter((p) => p.saleMode === "PHYSICAL").map((p) => ({ key: `p:${p.id}`, id: p.id, name: p.name, price: p.unitPrice.amount })),
      ]
    : [];
  const qty = (id: string) => left.items.find((i) => i.gameId === id || i.ownerProductId === id)?.quantity ?? "";
  const lines = sheet.movements.filter((m) => m.reference !== "apertura-de-caja");
  const liveLines = lines.filter((m) => !m.voidedAt).length;
  const slot = isOpen;
  const fiadosHref = `/panel/agencias/${agencyId}/fiados`;

  const who = [session.openedBy && `Abrió ${session.openedBy.name}`, session.closedBy && `cerró ${session.closedBy.name}`].filter(Boolean).join(" · ");

  const machineView = (
    <Line label="Venta online" value={session.machineSales === null ? <Missing warn>Sin cargar</Missing> : $(left.machineSales)} />
  );
  const itemsView = <Line label="Productos físicos" value={left.items.length ? $(left.itemsTotal) : <Missing />} />;

  return (
    <main className="screen">
      <PageHeader
        back={{ href: `/panel/agencias/${agencyId}/caja`, label: "Caja" }}
        title={`Caja diaria · ${SHIFT_LABEL[session.shift].toLowerCase()}`}
        subtitle={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="first-letter:uppercase">{fmt(session.date)}</span>
            {isOpen ? <Badge tone="success">Abierta</Badge> : <Badge>Cerrada</Badge>}
            {who && <span>{who}</span>}
          </span>
        }
      />

      {stale && (
        <section className="flex items-start gap-3 rounded-xl border border-l-4 border-solid border-border border-l-[#d99a1e] bg-card p-4 sm:p-5">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden="true" />
          <div className="flex flex-col gap-0.5">
            <strong>Esta caja es del {fmt(session.date)}, no de hoy</strong>
            <span className="text-sm text-muted-foreground">
              Quedó abierta. Terminá de cargarla y cerrala con el efectivo que había ese día; después abrí la de hoy.
            </span>
          </div>
        </section>
      )}

      {/* The sheet: same two columns as the paper. */}
      <div className="grid gap-4 md:grid-cols-2">
        <Column title="Entradas" total={left.total}>
          <Line label="Efectivo inicial" value={$(left.openingCash)} slot={slot} />
          {isOpen && physical.length > 0 ? (
            <InlineEdit view={itemsView} label="Editar productos físicos">
              <SimpleForm footer action={setItemsAction.bind(null, sessionId)} submitLabel="Guardar cantidades">
                <p className="m-0 text-sm font-semibold">Productos físicos vendidos</p>
                <div className="grid-2">
                  {physical.map((p) => (
                    <label key={p.key} className="field">
                      <span className="small muted">
                        {p.name} · {money(p.price.toString())} c/u
                      </span>
                      <input name={`qty:${p.key}`} className="input" inputMode="numeric" defaultValue={qty(p.id)} placeholder="0" />
                    </label>
                  ))}
                </div>
              </SimpleForm>
            </InlineEdit>
          ) : (
            left.items.length > 0 && <Line label="Productos físicos" value={$(left.itemsTotal)} slot={slot} />
          )}
          {left.items.map((i) => (
            <Line key={i.id} sub label={`${i.name} × ${i.quantity}`} value={$(i.total)} slot={slot} />
          ))}
          <Line label="Ingreso de efectivo" value={$(left.cashIn)} slot={slot} />
          {isOpen ? (
            <InlineEdit view={machineView} label="Editar venta online">
              <SimpleForm footer action={setMachineSalesAction.bind(null, sessionId)} submitLabel="Guardar venta">
                <label className="field">
                  <span className="small muted">Venta online: recaudación del turno según el reporte de la terminal ($)</span>
                  <input
                    name="machineSales"
                    className="input"
                    inputMode="decimal"
                    autoFocus
                    defaultValue={session.machineSales?.toString() ?? ""}
                    required
                  />
                </label>
              </SimpleForm>
            </InlineEdit>
          ) : (
            <Line label="Venta online" value={$(left.machineSales)} />
          )}
          {!left.creditPaymentsCash.isZero() && <Line label="Cobros de fiado en efectivo" value={$(left.creditPaymentsCash)} slot={slot} />}
          {!left.otherCashIn.isZero() && <Line label="Otros ingresos" value={$(left.otherCashIn)} slot={slot} />}
        </Column>

        <Column title="Salidas" total={right.total}>
          <Line label="Acierto raspaditas" value={$(right.prizesScratch)} />
          <Line label="Acierto quiniela" value={$(right.prizesQuiniela)} />
          {!right.prizesOther.isZero() && <Line label="Otros aciertos" value={$(right.prizesOther)} />}
          <Line label="Retiros" value={$(right.withdrawals)} />
          <Line label="Gastos" value={$(right.expenses)} />
          <Line label="Transferencias" value={$(right.transfers)} />
          {right.transfersByAccount.map((a) => (
            <Line key={a.name} sub label={a.name} value={$(a.total)} />
          ))}
          {!right.otherCashOut.isZero() && <Line label="Otras salidas" value={$(right.otherCashOut)} />}
        </Column>
      </div>

      {/* Bottom of the sheet: fiados, then the cash that should be (and is) in the drawer. */}
      <section className="flex flex-col gap-4 rounded-xl border border-solid border-border bg-card p-4 shadow-[0_1px_2px_rgba(19,20,43,0.05)] sm:p-5">
        <div className="flex flex-col">
          <Line label="Total entradas" value={$(left.total)} />
          <Line label="− Total salidas" value={$(right.total)} />
          <Line
            label={
              <span className="flex flex-wrap items-center gap-x-3">
                − Deuda de caja (fiados del turno)
                <Link href={fiadosHref} className="inline-flex items-center text-sm font-semibold text-primary hover:underline">
                  {isOpen ? "Cargar un fiado" : "Ver fiados"}
                  <ChevronRight className="size-4" aria-hidden="true" />
                </Link>
              </span>
            }
            value={$(credit.debt)}
          />
          {credit.charges.map((c) => (
            <Line key={c.id} sub label={`${c.customer.alias}${c.description ? ` (${c.description})` : ""}`} value={$(c.amount)} />
          ))}
        </div>

        <div className={cn("grid gap-3", session.countedCash ? "sm:grid-cols-3" : "sm:grid-cols-2")}>
          <Figure label="Efectivo esperado" value={$(sheet.expectedCash)} detail="Entradas − salidas − fiados" />
          {session.countedCash ? (
            <>
              <Figure label="Efectivo contado" value={$(session.countedCash)} detail="Lo que quedó en la caja" />
              <Figure
                label={sheet.difference!.isZero() ? "Diferencia" : sheet.difference!.isNegative() ? "Faltante" : "Sobrante"}
                value={sheet.difference!.isZero() ? "Sin diferencia" : $(sheet.difference!.abs())}
                tone={sheet.difference!.isZero() ? "ok" : "bad"}
              />
            </>
          ) : (
            <Figure label="Efectivo contado" value="—" detail="Se carga al cerrar la caja" />
          )}
        </div>

        {session.notes && <p className="m-0 text-sm text-muted-foreground">Nota del cierre: {session.notes}</p>}

        {isOpen && (
          <CloseCash
            expected={sheet.expectedCash.toString()}
            missing={session.machineSales === null ? "Antes de cerrar, cargá la venta online (puede ser $0)." : undefined}
            action={closeSessionAction.bind(null, sessionId)}
          />
        )}
        {!isOpen && canViewStaff(role) && (
          <div className="flex justify-end">
            <ConfirmAction
              label="Reabrir caja"
              icon={<RotateCcw />}
              question="Se anulan la venta y la diferencia del cierre, y la caja vuelve a quedar abierta para corregirla."
              confirmLabel="Sí, reabrir"
              action={reopenSessionAction.bind(null, sessionId)}
            />
          </div>
        )}
      </section>

      <DashCard title="Movimientos del turno">
        {(() => {
          const list =
            lines.length === 0 ? (
              <p className="text-sm text-muted-foreground">Todavía no hay movimientos.</p>
            ) : (
              <RowList>
                {lines.map((m) => (
                  <Row
                    key={m.id}
                    muted={Boolean(m.voidedAt)}
                    title={
                      <span className={m.voidedAt ? "line-through" : ""}>
                        {m.description && m.kind === "PRIZE_PAYOUT" ? m.description : MOVEMENT_KIND_LABEL[m.kind]}
                        {m.reference === "acierto-quiniela" ? " · quiniela" : m.reference === "acierto-raspaditas" ? " · raspaditas" : ""}
                      </span>
                    }
                    badge={m.voidedAt ? <Badge>Anulado</Badge> : undefined}
                    detail={[m.fund.name, m.description && m.kind !== "PRIZE_PAYOUT" ? m.description : null].filter(Boolean).join(" · ")}
                    trailing={
                      <div className="flex items-center gap-3">
                        <strong className={cn("tabular-nums", m.voidedAt ? "text-muted-foreground" : m.direction === "OUT" ? "text-destructive" : "text-success")}>
                          {m.direction === "OUT" ? "−" : "+"}
                          {$(m.amount)}
                        </strong>
                        {isOpen && !m.voidedAt && !m.creditEntry && (
                          <ConfirmAction
                            label="Anular"
                            icon={<Undo2 />}
                            question="Se saca este movimiento de la caja."
                            confirmLabel="Sí, anular"
                            action={voidLineAction.bind(null, m.id)}
                          />
                        )}
                      </div>
                    }
                  />
                ))}
              </RowList>
            );
          return isOpen ? (
            <AddableList
              count={`${liveLines} ${liveLines === 1 ? "movimiento" : "movimientos"}`}
              addLabel="Agregar movimiento"
              formTitle="Nuevo movimiento"
              form={<LineForm action={addLineAction.bind(null, sessionId)} accounts={agency.funds} />}
            >
              {list}
            </AddableList>
          ) : (
            list
          );
        })()}
      </DashCard>
    </main>
  );
}
