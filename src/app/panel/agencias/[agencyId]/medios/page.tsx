import Link from "next/link";
import { notFound } from "next/navigation";
import { Pause, Play } from "lucide-react";
import { agencyRole, canViewStaff, requireAccess } from "@/lib/access";
import { FUND_KIND_LABEL, ensureDefaultFunds } from "@/lib/finance";
import { prisma } from "@/lib/prisma";
import { todayIn } from "@/lib/schedule";
import { EditFundForm, NewFundForm } from "@/components/finance/finance-forms";
import { createFundAction, setFundActive, updateFundAction } from "@/app/panel/finanzas/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AddableList, EditableSection } from "@/components/ui/editable-section";
import { PageHeader } from "@/components/ui/page-header";
import { DataItem, DataList, Missing, PanelList } from "@/components/ui/settings-section";

export const metadata = { title: "Medios de cobro · Laqui" };


// Configuration: where the agency's customers pay (cash, bank accounts, wallets, card terminals).
// Balances are operation (Movimientos, Caja diaria); here only what each method is.
export default async function AgencyFundsPage({ params }: { params: Promise<{ agencyId: string }> }) {
  const { agencyId } = await params;
  const access = await requireAccess();
  if (!canViewStaff(agencyRole(access, agencyId))) notFound(); // owners and agency admins only

  const agency = await prisma.agency.findUnique({ where: { id: agencyId }, select: { name: true, timezone: true } });
  if (!agency) notFound();
  const today = todayIn(agency.timezone);
  await ensureDefaultFunds(agencyId); // every agency has "Efectivo" and the legajo account
  // The legajo's account is configured in Datos: it is not a way to get paid by customers.
  const funds = await prisma.agencyFund.findMany({
    where: { agencyId, settlesAgencyId: null },
    orderBy: [{ active: "desc" }, { sortOrder: "asc" }, { name: "asc" }],
  });
  const active = funds.filter((f) => f.active).length;

  return (
    <main className="screen">
      <PageHeader
        back={{ href: `/panel/agencias/${agencyId}`, label: agency.name }}
        title="Medios de cobro"
        subtitle={
          <>
            Dónde te pagan los clientes: efectivo, cuentas, billeteras, Posnet. La cuenta donde Lotería debita y acredita
            está en{" "}
            <Link href={`/panel/agencias/${agencyId}/datos#cuenta-legajo`} className="font-semibold text-primary hover:underline">
              Datos
            </Link>
            .
          </>
        }
      />

      <AddableList
        count={`${active} ${active === 1 ? "activo" : "activos"}${funds.length > active ? ` · ${funds.length - active} pausados` : ""}`}
        addLabel="Agregar medio de cobro"
        formTitle="Nuevo medio de cobro"
        form={<NewFundForm action={createFundAction.bind(null, agencyId)} today={today} />}
      >
        <PanelList>
          {funds.map((fund) => {
            const bankLike = fund.kind === "BANK_ACCOUNT" || fund.kind === "DIGITAL_WALLET";
            return (
              <li key={fund.id}>
                <EditableSection
                  item
                  muted={!fund.active}
                  title={fund.name}
                  subtitle={[FUND_KIND_LABEL[fund.kind], fund.provider].filter((t) => t && t !== fund.name).join(" · ") || undefined}
                  status={
                    <>
                      {!fund.active && <Badge>Pausado</Badge>}
                      {fund.showToCustomers && <Badge tone="success">Se muestra a clientes</Badge>}
                    </>
                  }
                  view={
                    <DataList>
                      {bankLike && <DataItem label="Titular">{fund.holderName ?? <Missing />}</DataItem>}
                      {bankLike && (
                        <DataItem label={fund.kind === "BANK_ACCOUNT" ? "CBU" : "CVU"}>{fund.cbuCvu ?? <Missing />}</DataItem>
                      )}
                      {bankLike && <DataItem label="Alias">{fund.alias ?? <Missing />}</DataItem>}
                      {fund.kind === "CARD_TERMINAL" && (
                        <DataItem label="N.º de comercio / terminal">{fund.merchantNumber ?? <Missing />}</DataItem>
                      )}
                      {fund.kind === "CASH" && (
                        <DataItem label="Saldo" wide>
                          <span className="text-muted-foreground">Sale de lo contado al abrir cada caja.</span>
                        </DataItem>
                      )}
                      {fund.reference && (
                        <DataItem label="Referencia" wide>
                          {fund.reference}
                        </DataItem>
                      )}
                    </DataList>
                  }
                  actions={
                    <form action={setFundActive.bind(null, fund.id, !fund.active)} className="flex">
                      <Button type="submit" variant="outline" size="sm" className="flex-1 lg:justify-start">
                        {fund.active ? <Pause /> : <Play />} {fund.active ? "Pausar" : "Reactivar"}
                      </Button>
                    </form>
                  }
                >
                  <EditFundForm
                    action={updateFundAction.bind(null, fund.id)}
                    kind={fund.kind}
                    today={today}
                    values={{
                      name: fund.name,
                      provider: fund.provider,
                      holderName: fund.holderName,
                      cbuCvu: fund.cbuCvu,
                      alias: fund.alias,
                      merchantNumber: fund.merchantNumber,
                      accountNumber: fund.accountNumber,
                      reference: fund.reference,
                      showToCustomers: fund.showToCustomers,
                    }}
                  />
                </EditableSection>
              </li>
            );
          })}
        </PanelList>
      </AddableList>
    </main>
  );
}
