import Link from "next/link";
import { notFound } from "next/navigation";
import { agencyRole, requireAccess } from "@/lib/access";
import { SHIFT_LABEL, openSessionOf } from "@/lib/cash";
import { accountDetail } from "@/lib/credit";
import { prisma } from "@/lib/prisma";
import { money } from "@/components/products/price-parts";
import { SimpleForm } from "@/components/schedule/simple-form";
import { chargeAction, payAction, updateAccountAction, voidEntryAction } from "@/app/panel/caja/actions";

export const metadata = { title: "Cuenta de fiado · Laqui" };

const fmt = (d: Date) => d.toLocaleDateString("es-AR", { timeZone: "UTC", day: "2-digit", month: "2-digit", year: "2-digit" });

// One customer's fiado account: what they owe, charge, register a payment.
export default async function CreditAccountPage({ params }: { params: Promise<{ agencyId: string; accountId: string }> }) {
  const { agencyId, accountId } = await params;
  const access = await requireAccess();
  if (!agencyRole(access, agencyId)) notFound();
  const exists = await prisma.creditAccount.findUnique({ where: { id: accountId }, select: { agencyId: true } });
  if (!exists || exists.agencyId !== agencyId) notFound();

  const [{ account, balance }, open, funds] = await Promise.all([
    accountDetail(accountId),
    openSessionOf(agencyId),
    prisma.agencyFund.findMany({ where: { agencyId, active: true }, select: { id: true, name: true }, orderBy: { sortOrder: "asc" } }),
  ]);
  const inSession = open ? `Va a la caja abierta (${SHIFT_LABEL[open.shift].toLowerCase()}).` : "No hay caja abierta: queda solo en la cuenta.";

  return (
    <main className="screen">
      <Link href={`/panel/agencias/${agencyId}/fiados`} className="back">
        ← Fiados
      </Link>
      <div className="stack-xs">
        <h1>{account.name}</h1>
        <p className="muted small">
          {account.phone ?? "sin celular"}
          {account.customerId ? " · cliente de WhatsApp" : ""}
          {account.notes ? ` · ${account.notes}` : ""}
        </p>
      </div>

      <section className="card stack-xs">
        <span className="small muted">Debe</span>
        <strong className={`big-number ${balance.isZero() ? "" : "error"}`}>{money(balance.toString())}</strong>
      </section>

      <section className="card stack-sm">
        <h2>Fiar</h2>
        <SimpleForm action={chargeAction.bind(null, accountId)} submitLabel="Cargar fiado">
          <div className="grid-2">
            <label className="field">
              <span className="small muted">Monto ($)</span>
              <input name="amount" className="input" inputMode="decimal" required placeholder="3.000" />
            </label>
            <label className="field">
              <span className="small muted">Detalle (opcional)</span>
              <input name="description" className="input" maxLength={120} placeholder="Quiniela nocturna" />
            </label>
          </div>
          <p className="small muted">{inSession}</p>
        </SimpleForm>
      </section>

      <section className="card stack-sm">
        <h2>Registrar pago</h2>
        <SimpleForm action={payAction.bind(null, accountId)} submitLabel="Registrar pago">
          <div className="grid-2">
            <label className="field">
              <span className="small muted">Monto ($)</span>
              <input name="amount" className="input" inputMode="decimal" required defaultValue={balance.isPositive() ? balance.toString() : ""} />
            </label>
            <label className="field">
              <span className="small muted">¿Cómo pagó?</span>
              <select name="fundId" className="input">
                {funds.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="small muted">{inSession}</p>
        </SimpleForm>
      </section>

      <section className="card stack-sm">
        <h2>Movimientos</h2>
        {account.entries.length === 0 ? (
          <p className="muted small">Todavía no hay movimientos.</p>
        ) : (
          <ul className="list plain">
            {account.entries.map((e) => (
              <li key={e.id} className={`row exception-row ${e.voidedAt ? "voided" : ""}`}>
                <div className="stack-xs">
                  <strong className="small">
                    {fmt(e.date)} · {e.kind === "CHARGE" ? "Fiado" : "Pago"}
                    {e.voidedAt ? " · ANULADO" : ""}
                  </strong>
                  <span className="small muted">
                    {e.description ?? ""}
                    {e.cashSession ? `${e.description ? " · " : ""}${SHIFT_LABEL[e.cashSession.shift].toLowerCase()}` : ""}
                    {e.createdBy ? ` · ${e.createdBy.name}` : ""}
                  </span>
                </div>
                <div className="row-actions">
                  <strong className={`small ${e.kind === "CHARGE" ? "error" : "ok-text"}`}>
                    {e.kind === "CHARGE" ? "+" : "−"}
                    {money(e.amount.toString())}
                  </strong>
                  {!e.voidedAt && (!e.cashSession || e.cashSession.status === "OPEN") && (
                    <form action={voidEntryAction.bind(null, e.id)}>
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

      <details className="card">
        <summary>Editar datos</summary>
        <div className="spaced">
          <SimpleForm action={updateAccountAction.bind(null, accountId)} submitLabel="Guardar">
            <label className="field">
              <span className="small muted">Nombre</span>
              <input name="name" className="input" required maxLength={80} defaultValue={account.name} />
            </label>
            <label className="field">
              <span className="small muted">Celular</span>
              <input name="phone" className="input" inputMode="tel" defaultValue={account.phone ?? ""} />
            </label>
            <label className="field">
              <span className="small muted">Nota</span>
              <input name="notes" className="input" maxLength={200} defaultValue={account.notes ?? ""} />
            </label>
          </SimpleForm>
        </div>
      </details>
    </main>
  );
}
