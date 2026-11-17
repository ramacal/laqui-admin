import Link from "next/link";
import { notFound } from "next/navigation";
import { agencyRole, requireAccess } from "@/lib/access";
import { agencyCustomers } from "@/lib/credit";
import { prisma } from "@/lib/prisma";
import { money } from "@/components/products/price-parts";
import { SimpleForm } from "@/components/schedule/simple-form";
import { CustomerFields } from "@/components/cash/customer-fields";
import { addCustomerAction } from "@/app/panel/caja/actions";

export const metadata = { title: "Clientes y fiados · Laqui" };

const fmt = (d: Date) => d.toLocaleDateString("es-AR", { timeZone: "UTC", day: "2-digit", month: "2-digit" });

// The agency's customers, those who owe first.
export default async function CustomersPage({ params }: { params: Promise<{ agencyId: string }> }) {
  const { agencyId } = await params;
  const access = await requireAccess();
  if (!agencyRole(access, agencyId)) notFound();
  const agency = await prisma.agency.findUnique({ where: { id: agencyId }, select: { name: true } });
  if (!agency) notFound();
  const { rows, total } = await agencyCustomers(agencyId);

  return (
    <main className="screen">
      <Link href={`/panel/agencias/${agencyId}/caja`} className="back">
        ← Caja de {agency.name}
      </Link>
      <h1>Clientes y fiados</h1>

      <section className="card stack-xs">
        <span className="small muted">Total que deben los clientes</span>
        <strong className="big-number">{money(total.toString())}</strong>
      </section>

      <section className="card stack-sm">
        <h2>Clientes</h2>
        {rows.length === 0 ? (
          <p className="muted small">Todavía no hay clientes.</p>
        ) : (
          <ul className="list plain">
            {rows.map(({ customer, name, balance, lastDate }) => (
              <li key={customer.id}>
                <Link href={`/panel/agencias/${agencyId}/fiados/${customer.id}`} className="row exception-row link">
                  <span className="stack-xs">
                    <strong className="small">{customer.alias}</strong>
                    <span className="small muted">
                      {name !== customer.alias ? `${name} · ` : ""}
                      {lastDate ? `último movimiento ${fmt(lastDate)}` : "sin fiados"}
                    </span>
                  </span>
                  <strong className={`small ${balance.isZero() ? "muted" : "error"}`}>
                    {balance.isZero() ? "al día" : money(balance.toString())} ›
                  </strong>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <details className="card">
        <summary>Nuevo cliente</summary>
        <div className="spaced">
          <SimpleForm action={addCustomerAction.bind(null, agencyId)} submitLabel="Agregar cliente">
            <CustomerFields />
            <p className="small muted">Si el celular o el DNI ya son de un cliente de otra agencia, se reconoce a la misma persona.</p>
          </SimpleForm>
        </div>
      </details>
    </main>
  );
}
