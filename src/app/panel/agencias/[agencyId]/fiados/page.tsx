import { notFound } from "next/navigation";
import { agencyRole, requireAccess } from "@/lib/access";
import { agencyCustomers } from "@/lib/credit";
import { formatCellphone } from "@/lib/phone";
import { prisma } from "@/lib/prisma";
import { money } from "@/components/products/price-parts";
import { SimpleForm } from "@/components/schedule/simple-form";
import { CustomerFields } from "@/components/cash/customer-fields";
import { CustomerList, type CustomerRow } from "@/components/cash/customer-list";
import { AddableList } from "@/components/ui/editable-section";
import { PageHeader } from "@/components/ui/page-header";
import { addCustomerAction } from "@/app/panel/caja/actions";

export const metadata = { title: "Fiados · Laqui" };

const fmt = (d: Date) => d.toLocaleDateString("es-AR", { timeZone: "UTC", day: "2-digit", month: "2-digit" });

// The agency's customers, those who owe first: find one fast and open their account.
export default async function CustomersPage({ params }: { params: Promise<{ agencyId: string }> }) {
  const { agencyId } = await params;
  const access = await requireAccess();
  if (!agencyRole(access, agencyId)) notFound();
  const agency = await prisma.agency.findUnique({ where: { id: agencyId }, select: { name: true } });
  if (!agency) notFound();
  const { rows, total } = await agencyCustomers(agencyId);

  const list: CustomerRow[] = rows.map(({ customer, name, balance, lastDate }) => ({
    id: customer.id,
    alias: customer.alias,
    name,
    phone: formatCellphone(customer.customer.cellphoneNumber),
    balance: money(balance.toString()),
    owes: balance.isPositive() && !balance.isZero(),
    lastDate: lastDate ? fmt(lastDate) : null,
  }));
  const owing = list.filter((r) => r.owes).length;

  return (
    <main className="screen">
      <PageHeader
        back={{ href: `/panel/agencias/${agencyId}`, label: agency.name }}
        title="Fiados"
        subtitle="Los clientes de la agencia y lo que deben. Tocá uno para fiarle o registrar un pago."
      />

      <dl className="m-0 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-solid border-border bg-card p-4">
          <dt className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Deben en total</dt>
          <dd className={`m-0 text-2xl font-bold ${owing ? "text-destructive" : ""}`}>{money(total.toString())}</dd>
        </div>
        <div className="rounded-xl border border-solid border-border bg-card p-4">
          <dt className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Clientes que deben</dt>
          <dd className="m-0 text-2xl font-bold">{owing}</dd>
        </div>
        <div className="hidden rounded-xl border border-solid border-border bg-card p-4 sm:block">
          <dt className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Clientes</dt>
          <dd className="m-0 text-2xl font-bold">{list.length}</dd>
        </div>
      </dl>

      <AddableList
        count={`${list.length} ${list.length === 1 ? "cliente" : "clientes"}`}
        addLabel="Nuevo cliente"
        formTitle="Nuevo cliente"
        form={
          <SimpleForm footer action={addCustomerAction.bind(null, agencyId)} submitLabel="Agregar">
            <CustomerFields />
            <p className="text-sm text-muted-foreground">
              Si el celular o el DNI ya son de un cliente de otra agencia, se reconoce a la misma persona.
            </p>
          </SimpleForm>
        }
      >
        <CustomerList rows={list} base={`/panel/agencias/${agencyId}/fiados`} />
      </AddableList>
    </main>
  );
}
