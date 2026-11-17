import Link from "next/link";
import { notFound } from "next/navigation";
import { agencyRole, requireAccess } from "@/lib/access";
import { agencyCredit } from "@/lib/credit";
import { prisma } from "@/lib/prisma";
import { money } from "@/components/products/price-parts";
import { SimpleForm } from "@/components/schedule/simple-form";
import { createAccountAction } from "@/app/panel/caja/actions";

export const metadata = { title: "Fiados · Laqui" };

const fmt = (d: Date) => d.toLocaleDateString("es-AR", { timeZone: "UTC", day: "2-digit", month: "2-digit" });

// Customers who owe the agency, biggest debt first.
export default async function CreditPage({ params }: { params: Promise<{ agencyId: string }> }) {
  const { agencyId } = await params;
  const access = await requireAccess();
  if (!agencyRole(access, agencyId)) notFound();
  const agency = await prisma.agency.findUnique({ where: { id: agencyId }, select: { name: true } });
  if (!agency) notFound();
  const { rows, total } = await agencyCredit(agencyId);

  return (
    <main className="screen">
      <Link href={`/panel/agencias/${agencyId}/caja`} className="back">
        ← Caja de {agency.name}
      </Link>
      <h1>Fiados</h1>

      <section className="card stack-xs">
        <span className="small muted">Total que deben los clientes</span>
        <strong className="big-number">{money(total.toString())}</strong>
      </section>

      <section className="card stack-sm">
        <h2>Clientes</h2>
        {rows.length === 0 ? (
          <p className="muted small">Todavía no hay cuentas de fiado.</p>
        ) : (
          <ul className="list plain">
            {rows.map(({ account, balance, lastDate }) => (
              <li key={account.id}>
                <Link href={`/panel/agencias/${agencyId}/fiados/${account.id}`} className="row exception-row link">
                  <span className="stack-xs">
                    <strong className="small">{account.name}</strong>
                    <span className="small muted">{lastDate ? `último movimiento ${fmt(lastDate)}` : "sin movimientos"}</span>
                  </span>
                  <strong className={`small ${balance.isPositive() && !balance.isZero() ? "error" : "muted"}`}>
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
          <SimpleForm action={createAccountAction.bind(null, agencyId)} submitLabel="Crear cuenta">
            <label className="field">
              <span className="small muted">Nombre (como lo conocen en la agencia)</span>
              <input name="name" className="input" required maxLength={80} placeholder="Juan del kiosco" />
            </label>
            <label className="field">
              <span className="small muted">Celular (opcional)</span>
              <input name="phone" className="input" inputMode="tel" placeholder="11 5555-0000" />
            </label>
            <label className="field">
              <span className="small muted">Nota (opcional)</span>
              <input name="notes" className="input" maxLength={200} />
            </label>
          </SimpleForm>
        </div>
      </details>
    </main>
  );
}
