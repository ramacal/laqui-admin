import Link from "next/link";
import { notFound } from "next/navigation";
import { agencyRole, requireAccess } from "@/lib/access";
import { SHIFT_LABEL, agencySessions, openSessionOf, suggestShift, suggestedOpeningCash } from "@/lib/cash";
import { prisma } from "@/lib/prisma";
import { todayIn } from "@/lib/schedule";
import { money } from "@/components/products/price-parts";
import { SimpleForm } from "@/components/schedule/simple-form";
import { openSessionAction } from "@/app/panel/caja/actions";

export const metadata = { title: "Caja · Laqui" };

const fmt = (d: Date) => d.toLocaleDateString("es-AR", { timeZone: "UTC", weekday: "short", day: "2-digit", month: "2-digit" });

// Cash sessions of an agency: open the shift, or see past ones.
export default async function CashPage({ params }: { params: Promise<{ agencyId: string }> }) {
  const { agencyId } = await params;
  const access = await requireAccess();
  if (!agencyRole(access, agencyId)) notFound();
  const agency = await prisma.agency.findUnique({ where: { id: agencyId }, select: { name: true, timezone: true, cashSessionsPerDay: true } });
  if (!agency) notFound();

  const today = todayIn(agency.timezone);
  const from = new Date(Date.parse(`${today}T00:00:00Z`) - 30 * 86_400_000).toISOString().slice(0, 10);
  const [open, shift, opening, sessions] = await Promise.all([
    openSessionOf(agencyId),
    suggestShift(agencyId, today),
    suggestedOpeningCash(agencyId),
    agencySessions(agencyId, from),
  ]);

  return (
    <main className="screen">
      <Link href={`/panel/agencias/${agencyId}`} className="back">
        ← {agency.name}
      </Link>
      <div className="stack-xs">
        <h1>Caja</h1>
        <p className="muted small">
          {agency.cashSessionsPerDay === 2 ? "Dos cajas por día: turno mañana y turno tarde." : "Una caja por día."}
        </p>
      </div>

      {open ? (
        <Link href={`/panel/agencias/${agencyId}/caja/${open.id}`} className="card row link-card status is-open">
          <div className="stack-xs">
            <strong>
              Caja abierta · {SHIFT_LABEL[open.shift]} del {fmt(open.date)}
            </strong>
            <span className="small">Cambio inicial {money(open.openingCash.toString())} · cargá movimientos y cerrala</span>
          </div>
          <span className="chevron" aria-hidden="true">
            ›
          </span>
        </Link>
      ) : (
        <section className="card stack-sm">
          <h2>Abrir caja</h2>
          <SimpleForm action={openSessionAction.bind(null, agencyId)} submitLabel="Abrir caja">
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
            <label className="field">
              <span className="small muted">Cambio inicial ($): el efectivo con el que arranca la caja</span>
              <input name="openingCash" className="input" inputMode="decimal" defaultValue={opening.toString()} required />
            </label>
          </SimpleForm>
        </section>
      )}

      <Link href={`/panel/agencias/${agencyId}/fiados`} className="card row link-card">
        <div className="stack-xs">
          <strong>Fiados</strong>
          <span className="small muted">Clientes que deben, cargar fiados y pagos</span>
        </div>
        <span className="chevron" aria-hidden="true">
          ›
        </span>
      </Link>

      <section className="card stack-sm">
        <h2>Últimos 30 días</h2>
        {sessions.length === 0 ? (
          <p className="muted small">Todavía no hay cajas.</p>
        ) : (
          <ul className="list plain">
            {sessions.map((s) => (
              <li key={s.id}>
                <Link href={`/panel/agencias/${agencyId}/caja/${s.id}`} className="row exception-row link">
                  <span className="small">
                    {fmt(s.date)} · {SHIFT_LABEL[s.shift]}
                  </span>
                  <span className="small muted">
                    {s.status === "OPEN" ? "abierta" : `efectivo ${money((s.countedCash ?? 0).toString())}`} ›
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
