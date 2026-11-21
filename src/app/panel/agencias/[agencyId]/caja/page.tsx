import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ChevronRight, Lock, Wallet } from "lucide-react";
import { agencyRole, requireAccess } from "@/lib/access";
import { SHIFT_LABEL, agencySessions, closingDifferences, openSessionOf, openingCashFor, suggestShift } from "@/lib/cash";
import { prisma } from "@/lib/prisma";
import { todayIn } from "@/lib/schedule";
import { cn } from "@/lib/utils";
import { money } from "@/components/products/price-parts";
import { SimpleForm } from "@/components/schedule/simple-form";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { DashCard } from "@/components/ui/dash-card";
import { PageHeader } from "@/components/ui/page-header";
import { openSessionAction } from "@/app/panel/caja/actions";

export const metadata = { title: "Caja · Laqui" };

const fmt = (d: Date) => d.toLocaleDateString("es-AR", { timeZone: "UTC", weekday: "short", day: "2-digit", month: "2-digit" });
const fmtLong = (d: Date) => d.toLocaleDateString("es-AR", { timeZone: "UTC", weekday: "long", day: "2-digit", month: "2-digit" });

// Cash sessions of an agency: the open one (or the form to open one) on top, then the last 30 days.
export default async function CashPage({ params }: { params: Promise<{ agencyId: string }> }) {
  const { agencyId } = await params;
  const access = await requireAccess();
  if (!agencyRole(access, agencyId)) notFound();
  const agency = await prisma.agency.findUnique({ where: { id: agencyId }, select: { name: true, timezone: true, cashSessionsPerDay: true } });
  if (!agency) notFound();

  const today = todayIn(agency.timezone);
  const from = new Date(Date.parse(`${today}T00:00:00Z`) - 30 * 86_400_000).toISOString().slice(0, 10);
  const [open, shift, sessions] = await Promise.all([
    openSessionOf(agencyId),
    suggestShift(agencyId, today),
    agencySessions(agencyId, from),
  ]);
  const [opening, differences] = await Promise.all([
    openingCashFor(agencyId, today, shift ?? "MORNING"),
    closingDifferences(sessions.filter((s) => s.status === "CLOSED").map((s) => s.id)),
  ]);
  const base = `/panel/agencias/${agencyId}`;
  const stale = Boolean(open && open.date.toISOString().slice(0, 10) < today);

  return (
    <main className="screen">
      <PageHeader
        back={{ href: base, label: agency.name }}
        title="Caja diaria"
        subtitle={agency.cashSessionsPerDay === 2 ? "Dos cajas por día: turno mañana y turno tarde." : "Una caja por día."}
        actions={
          <Link href={`${base}/fiados`} className={buttonVariants({ variant: "outline", size: "sm" })}>
            Clientes y fiados
          </Link>
        }
      />

      {open ? (
        <section
          className={cn(
            "flex flex-wrap items-center justify-between gap-4 rounded-xl border border-l-4 border-solid border-border bg-card p-4 shadow-[0_1px_2px_rgba(19,20,43,0.05)] sm:p-5",
            stale ? "border-l-[#d99a1e]" : "border-l-success",
          )}
        >
          <div className="flex min-w-0 items-start gap-3">
            {stale ? (
              <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden="true" />
            ) : (
              <Wallet className="mt-0.5 size-5 shrink-0 text-success" aria-hidden="true" />
            )}
            <div className="flex min-w-0 flex-col gap-1">
              <span className="flex flex-wrap items-center gap-2">
                <strong>
                  {SHIFT_LABEL[open.shift]} · <span className="capitalize">{fmtLong(open.date)}</span>
                </strong>
                <Badge tone="success">Abierta</Badge>
              </span>
              <span className="text-sm text-muted-foreground">
                {stale
                  ? "Esta caja es de otro día y sigue abierta. Cerrala con lo que había ese día antes de abrir la de hoy."
                  : `Efectivo inicial ${money(open.openingCash.toString())}. Cargá los movimientos del turno y cerrala al terminar.`}
              </span>
            </div>
          </div>
          <Link href={`${base}/caja/${open.id}`} className={buttonVariants()}>
            {stale ? <Lock /> : <Wallet />} {stale ? "Ir a cerrarla" : "Ir a la caja"}
          </Link>
        </section>
      ) : (
        <DashCard title="Abrir caja">
          {shift === null && (
            <p className="text-sm text-muted-foreground">Hoy ya se abrieron todas las cajas. Si hace falta, elegí otra fecha.</p>
          )}
          <SimpleForm footer action={openSessionAction.bind(null, agencyId)} submitLabel="Abrir caja">
            <div className="grid-2">
              <label className="field">
                <span className="small muted">Fecha</span>
                <input type="date" name="date" className="input" defaultValue={today} required />
              </label>
              <label className="field">
                <span className="small muted">Turno</span>
                <select name="shift" className="input" defaultValue={shift ?? "MORNING"}>
                  <option value="MORNING">{SHIFT_LABEL.MORNING}</option>
                  <option value="AFTERNOON">{SHIFT_LABEL.AFTERNOON}</option>
                  <option value="SINGLE">{SHIFT_LABEL.SINGLE}</option>
                </select>
              </label>
            </div>
            {opening.locked ? (
              // From the second caja on, it is what the previous one closed with (lib/cash openingCashFor).
              <div className="flex flex-col gap-0.5 rounded-lg bg-muted p-3.5">
                <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Efectivo inicial</span>
                <strong className="text-2xl leading-tight tabular-nums">{money(opening.amount.toString())}</strong>
                <span className="text-sm text-muted-foreground">
                  Lo contado al cerrar la caja de {SHIFT_LABEL[opening.previous.shift].toLowerCase()} del {fmt(opening.previous.date)}. Si
                  sacaron o pusieron plata entre turnos, cargalo como movimiento.
                </span>
              </div>
            ) : (
              <label className="field">
                <span className="small muted">Efectivo inicial ($): el cambio con el que arranca la caja</span>
                <input name="openingCash" className="input" inputMode="decimal" defaultValue="0" required />
                <span className="small muted">
                  Es la primera caja de la agencia: contá el efectivo del cajón. Desde la próxima, sale de lo contado al cerrar la
                  anterior.
                </span>
              </label>
            )}
          </SimpleForm>
        </DashCard>
      )}

      <DashCard title="Últimos 30 días">
        {sessions.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todavía no hay cajas.</p>
        ) : (
          <ul className="-my-1 m-0 flex list-none flex-col p-0 [&>li+li]:border-0 [&>li+li]:border-t [&>li+li]:border-solid [&>li+li]:border-border">
            {sessions.map((s) => {
              const diff = differences.get(s.id);
              return (
                <li key={s.id}>
                  <Link
                    href={`${base}/caja/${s.id}`}
                    className="-mx-2 flex items-center justify-between gap-3 rounded-lg px-2 py-3 text-foreground no-underline hover:bg-muted"
                  >
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="flex flex-wrap items-center gap-2 font-semibold">
                        <span className="capitalize">{fmt(s.date)}</span>
                        <span className="font-normal text-muted-foreground">{SHIFT_LABEL[s.shift]}</span>
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {s.status === "OPEN" ? `Efectivo inicial ${money(s.openingCash.toString())}` : `Contado ${money((s.countedCash ?? 0).toString())}`}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      {s.status === "OPEN" ? (
                        <Badge tone="success">Abierta</Badge>
                      ) : diff && !diff.isZero() ? (
                        <Badge tone="danger">
                          {diff.isNegative() ? "Faltante" : "Sobrante"} {money(diff.abs().toString())}
                        </Badge>
                      ) : (
                        <Badge>Cerrada</Badge>
                      )}
                      <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </DashCard>
    </main>
  );
}
