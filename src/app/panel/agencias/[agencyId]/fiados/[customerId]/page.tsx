import Link from "next/link";
import { notFound } from "next/navigation";
import { agencyRole, requireAccess } from "@/lib/access";
import { SHIFT_LABEL, openSessionOf } from "@/lib/cash";
import { customerDetail } from "@/lib/credit";
import { fullName } from "@/lib/customers";
import { formatCellphone } from "@/lib/phone";
import { prisma } from "@/lib/prisma";
import { money } from "@/components/products/price-parts";
import { SimpleForm } from "@/components/schedule/simple-form";
import { CustomerFields } from "@/components/cash/customer-fields";
import { chargeAction, payAction, updateCustomerAction, voidEntryAction } from "@/app/panel/caja/actions";

export const metadata = { title: "Cliente · Laqui" };

const fmt = (d: Date) => d.toLocaleDateString("es-AR", { timeZone: "UTC", day: "2-digit", month: "2-digit", year: "2-digit" });

// One agency customer: who they are, what they owe, charge, register a payment.
export default async function CustomerPage({ params }: { params: Promise<{ agencyId: string; customerId: string }> }) {
  const { agencyId, customerId } = await params;
  const access = await requireAccess();
  if (!agencyRole(access, agencyId)) notFound();
  const exists = await prisma.agencyCustomer.findUnique({ where: { id: customerId }, select: { agencyId: true } });
  if (!exists || exists.agencyId !== agencyId) notFound();

  const [{ customer, balance }, open, funds] = await Promise.all([
    customerDetail(customerId),
    openSessionOf(agencyId),
    prisma.agencyFund.findMany({ where: { agencyId, active: true }, select: { id: true, name: true }, orderBy: { sortOrder: "asc" } }),
  ]);
  const person = customer.customer;
  const otherAgencies = person._count.agencies - 1;
  const inSession = open ? `Va a la caja abierta (${SHIFT_LABEL[open.shift].toLowerCase()}).` : "No hay caja abierta: queda solo en la cuenta.";

  return (
    <main className="screen">
      <Link href={`/panel/agencias/${agencyId}/fiados`} className="back">
        ← Clientes y fiados
      </Link>
      <div className="stack-xs">
        <h1>{customer.alias}</h1>
        <p className="muted small">
          {fullName(person)}
          {" · "}
          {formatCellphone(person.cellphoneNumber) ?? "sin celular"}
          {person.dni ? ` · DNI ${person.dni}` : ""}
          {otherAgencies > 0 ? ` · también cliente de ${otherAgencies} agencia(s) más` : ""}
        </p>
        {customer.notes && <p className="small">{customer.notes}</p>}
      </div>

      <section className="card stack-xs">
        <span className="small muted">Debe en esta agencia</span>
        <strong className={`big-number ${balance.isZero() ? "" : "error"}`}>{money(balance.toString())}</strong>
      </section>

      <section className="card stack-sm">
        <h2>Fiar</h2>
        <SimpleForm action={chargeAction.bind(null, customerId)} submitLabel="Cargar fiado">
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
        <SimpleForm action={payAction.bind(null, customerId)} submitLabel="Registrar pago">
          <div className="grid-2">
            <label className="field">
              <span className="small muted">Monto ($)</span>
              <input name="amount" className="input" inputMode="decimal" required defaultValue={balance.isPositive() && !balance.isZero() ? balance.toString() : ""} />
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
        <h2>Fiados y pagos</h2>
        {customer.creditEntries.length === 0 ? (
          <p className="muted small">Todavía no hay movimientos.</p>
        ) : (
          <ul className="list plain">
            {customer.creditEntries.map((e) => (
              <li key={e.id} className={`row exception-row ${e.voidedAt ? "voided" : ""}`}>
                <div className="stack-xs">
                  <strong className="small">
                    {fmt(e.date)} · {e.kind === "CHARGE" ? "Fiado" : "Pago"}
                    {e.voidedAt ? " · ANULADO" : ""}
                  </strong>
                  <span className="small muted">
                    {[e.description, e.cashSession ? SHIFT_LABEL[e.cashSession.shift].toLowerCase() : null, e.createdBy?.name]
                      .filter(Boolean)
                      .join(" · ")}
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
          <SimpleForm action={updateCustomerAction.bind(null, customerId)} submitLabel="Guardar">
            <CustomerFields
              values={{
                firstName: person.firstName,
                lastName: person.lastName,
                alias: customer.alias,
                phone: formatCellphone(person.cellphoneNumber),
                dni: person.dni,
                notes: customer.notes,
              }}
            />
            {otherAgencies > 0 && (
              <p className="small muted">Nombre, celular y DNI son de la persona: el cambio se ve en sus otras agencias. El alias es solo de esta.</p>
            )}
          </SimpleForm>
        </div>
      </details>
    </main>
  );
}
