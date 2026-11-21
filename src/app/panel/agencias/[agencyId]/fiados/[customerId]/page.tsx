import { notFound } from "next/navigation";
import { HandCoins, Undo2, Wallet } from "lucide-react";
import { agencyRole, requireAccess } from "@/lib/access";
import { SHIFT_LABEL, openSessionOf } from "@/lib/cash";
import { customerDetail } from "@/lib/credit";
import { fullName } from "@/lib/customers";
import { formatCellphone } from "@/lib/phone";
import { prisma } from "@/lib/prisma";
import { todayIn } from "@/lib/schedule";
import { money } from "@/components/products/price-parts";
import { SimpleForm } from "@/components/schedule/simple-form";
import { CustomerFields } from "@/components/cash/customer-fields";
import { Badge } from "@/components/ui/badge";
import { ConfirmAction } from "@/components/ui/confirm-action";
import { DashCard } from "@/components/ui/dash-card";
import { EditableSection } from "@/components/ui/editable-section";
import { PageHeader } from "@/components/ui/page-header";
import { Row, RowList } from "@/components/ui/row-list";
import { DataItem, DataList, Missing, SettingsPage } from "@/components/ui/settings-section";
import { chargeAction, payAction, updateCustomerAction, voidEntryAction } from "@/app/panel/caja/actions";

export const metadata = { title: "Cliente · Laqui" };
const TZ = "America/Argentina/Buenos_Aires";

const fmt = (d: Date) => d.toLocaleDateString("es-AR", { timeZone: "UTC", weekday: "short", day: "2-digit", month: "2-digit" });

// One agency customer at the counter: what they owe, "Fiar" and "Registrar pago" always at hand,
// their history (voidable while its caja is open) and, at the end, their details.
export default async function CustomerPage({ params }: { params: Promise<{ agencyId: string; customerId: string }> }) {
  const { agencyId, customerId } = await params;
  const access = await requireAccess();
  if (!agencyRole(access, agencyId)) notFound();
  const exists = await prisma.agencyCustomer.findUnique({ where: { id: customerId }, select: { agencyId: true } });
  if (!exists || exists.agencyId !== agencyId) notFound();

  const [{ customer, balance }, open, funds] = await Promise.all([
    customerDetail(customerId),
    openSessionOf(agencyId),
    prisma.agencyFund.findMany({
      where: { agencyId, active: true, settlesAgencyId: null },
      select: { id: true, name: true },
      orderBy: { sortOrder: "asc" },
    }),
  ]);
  const person = customer.customer;
  const otherAgencies = person._count.agencies - 1;
  const owes = balance.isPositive() && !balance.isZero();
  const phone = formatCellphone(person.cellphoneNumber);
  // Charges and payments go to the open caja. If it was left open on another day, say so.
  const staleCash = Boolean(open && open.date.toISOString().slice(0, 10) < todayIn(TZ));
  const sessionNote = open ? (
    staleCash ? (
      <Badge tone="warning" className="whitespace-normal">
        Va a la caja del {fmt(open.date)} ({SHIFT_LABEL[open.shift].toLowerCase()}), que sigue abierta
      </Badge>
    ) : (
      <Badge tone="success">Va a la caja abierta ({SHIFT_LABEL[open.shift].toLowerCase()})</Badge>
    )
  ) : (
    <Badge className="whitespace-normal">Sin caja abierta: queda solo en la cuenta</Badge>
  );

  return (
    <main className="screen">
      <PageHeader
        back={{ href: `/panel/agencias/${agencyId}/fiados`, label: "Fiados" }}
        title={customer.alias}
        subtitle={[fullName(person) !== customer.alias ? fullName(person) : null, phone].filter(Boolean).join(" · ") || undefined}
        actions={
          <div className="flex flex-col items-end">
            <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {owes ? "Debe" : "Saldo"}
            </span>
            <strong className={`text-3xl leading-tight ${owes ? "text-destructive" : "text-success"}`}>
              {owes ? money(balance.toString()) : "Al día"}
            </strong>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-2">
        <DashCard title="Fiar">
          <SimpleForm footer action={chargeAction.bind(null, customerId)} submitLabel="Cargar fiado">
            <label className="field">
              <span className="small muted">Monto ($)</span>
              <input name="amount" className="input" inputMode="decimal" required placeholder="3.000" />
            </label>
            <label className="field">
              <span className="small muted">Detalle (opcional)</span>
              <input name="description" className="input" maxLength={120} placeholder="Quiniela nocturna" />
            </label>
            <div>{sessionNote}</div>
          </SimpleForm>
        </DashCard>

        <DashCard title="Registrar pago">
          <SimpleForm footer action={payAction.bind(null, customerId)} submitLabel="Registrar pago">
            <label className="field">
              <span className="small muted">Monto ($)</span>
              <input name="amount" className="input" inputMode="decimal" required defaultValue={owes ? balance.toString() : ""} />
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
            <div>{sessionNote}</div>
          </SimpleForm>
        </DashCard>
      </div>

      <DashCard title="Fiados y pagos">
        {customer.creditEntries.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todavía no hay movimientos.</p>
        ) : (
          <RowList>
            {customer.creditEntries.map((e) => {
              const voidable = !e.voidedAt && (!e.cashSession || e.cashSession.status === "OPEN");
              return (
                <Row
                  key={e.id}
                  muted={Boolean(e.voidedAt)}
                  title={
                    <span className={e.voidedAt ? "line-through" : ""}>
                      {fmt(e.date)}
                    </span>
                  }
                  badge={
                    e.voidedAt ? (
                      <Badge>Anulado</Badge>
                    ) : e.kind === "CHARGE" ? (
                      <Badge tone="danger">
                        <HandCoins className="mr-1 size-3" aria-hidden="true" /> Fiado
                      </Badge>
                    ) : (
                      <Badge tone="success">
                        <Wallet className="mr-1 size-3" aria-hidden="true" /> Pago
                      </Badge>
                    )
                  }
                  detail={
                    [e.description, e.cashSession ? `caja ${SHIFT_LABEL[e.cashSession.shift].toLowerCase()}` : null, e.createdBy?.name]
                      .filter(Boolean)
                      .join(" · ") || undefined
                  }
                  trailing={
                    <div className="flex items-center gap-3">
                      <strong className={e.voidedAt ? "text-muted-foreground" : e.kind === "CHARGE" ? "text-destructive" : "text-success"}>
                        {e.kind === "CHARGE" ? "+" : "−"}
                        {money(e.amount.toString())}
                      </strong>
                      {voidable && (
                        <ConfirmAction
                          label="Anular"
                          icon={<Undo2 />}
                          question={e.kind === "CHARGE" ? "Se borra este fiado de la cuenta." : "Se borra este pago de la cuenta."}
                          confirmLabel="Sí, anular"
                          action={voidEntryAction.bind(null, e.id)}
                        />
                      )}
                    </div>
                  }
                />
              );
            })}
          </RowList>
        )}
      </DashCard>

      <SettingsPage>
        <EditableSection
          title="Datos del cliente"
          description={
            otherAgencies > 0
              ? `También es cliente de ${otherAgencies} ${otherAgencies === 1 ? "agencia más" : "agencias más"}: nombre, celular y DNI se comparten, el alias y la nota son de esta.`
              : "Cómo lo conocen en la agencia y cómo contactarlo."
          }
          view={
            <DataList>
              <DataItem label="Nombre">{fullName(person)}</DataItem>
              <DataItem label="Alias">{customer.alias}</DataItem>
              <DataItem label="Celular">{phone ?? <Missing />}</DataItem>
              <DataItem label="DNI">{person.dni ?? <Missing />}</DataItem>
              {customer.notes && (
                <DataItem label="Nota" wide>
                  {customer.notes}
                </DataItem>
              )}
            </DataList>
          }
        >
          <SimpleForm footer action={updateCustomerAction.bind(null, customerId)} submitLabel="Guardar">
            <CustomerFields
              values={{
                firstName: person.firstName,
                lastName: person.lastName,
                alias: customer.alias,
                phone,
                dni: person.dni,
                notes: customer.notes,
              }}
            />
          </SimpleForm>
        </EditableSection>
      </SettingsPage>
    </main>
  );
}
