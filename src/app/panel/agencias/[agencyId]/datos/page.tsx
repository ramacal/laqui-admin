import { notFound } from "next/navigation";
import { agencyRole, canManageDrive, canViewStaff, ownsGroup, requireAccess } from "@/lib/access";
import { agencyBalances } from "@/lib/finance";
import { prisma } from "@/lib/prisma";
import { todayIn } from "@/lib/schedule";
import { money } from "@/components/products/price-parts";
import { EditFundForm } from "@/components/finance/finance-forms";
import { updateFundAction } from "@/app/panel/finanzas/actions";
import { DriveCard } from "@/components/drive/drive-card";
import { TitularForm } from "@/components/groups/titular-form";
import { SimpleForm } from "@/components/schedule/simple-form";
import { moveAgencyAction, saveTitularAction } from "@/app/panel/grupo/actions";
import { EditableSection } from "@/components/ui/editable-section";
import { PageHeader } from "@/components/ui/page-header";
import { DataItem, DataList, Missing, SettingsPage, SettingsSection } from "@/components/ui/settings-section";

export const metadata = { title: "Datos de la agencia · Laqui" };

const formatPhone = (e164: string | null) => (e164 ? `+${e164}` : null);

// Configuration of the agency itself: legal data, contact, Google Drive and group.
export default async function AgencyDataPage({
  params,
  searchParams,
}: {
  params: Promise<{ agencyId: string }>;
  searchParams: Promise<{ drive?: string }>;
}) {
  const { agencyId } = await params;
  const { drive } = await searchParams;
  const access = await requireAccess();
  const role = agencyRole(access, agencyId);
  if (!role) notFound();

  const agency = await prisma.agency.findUnique({
    where: { id: agencyId },
    include: {
      province: { select: { code: true, name: true } },
      group: { select: { name: true, owners: { select: { email: true } }, _count: { select: { agencies: true, owners: true } } } },
    },
  });
  if (!agency) notFound();

  const titular = [agency.titularFirstName, agency.titularLastName].filter(Boolean).join(" ");
  const showGroup = Boolean(agency.group) && (agency.group!._count.agencies > 1 || agency.group!._count.owners > 1);
  const isGroupOwner = ownsGroup(access, agency.groupId);
  const pendingLicense = /^pend/i.test(agency.licenseNumber);
  const address = [agency.street, agency.streetNumber].filter(Boolean).join(" ");
  // The legajo's bank account: owners and agency admins only, like the rest of the money.
  const legajoAccount = canViewStaff(role)
    ? ((await agencyBalances(agencyId)).funds.find((f) => f.fund.settlesAgencyId) ?? null)
    : null;
  const today = todayIn(agency.timezone);

  const account = legajoAccount?.fund;

  return (
    <main className="screen">
      <PageHeader
        back={{ href: `/panel/agencias/${agencyId}`, label: agency.name }}
        title="Datos de la agencia"
        subtitle={
          pendingLicense
            ? `Legajo pendiente de cargar · ${agency.province.name}`
            : `Legajo ${agency.province.code}-${agency.licenseNumber} · ${agency.province.name}`
        }
      />

      <SettingsPage>
        <SettingsSection title="Agencia" description="Cómo la conoce Lotería y cómo la contactan los clientes.">
          <DataList>
            <DataItem label="Legajo">
              {pendingLicense ? <Missing warn>Pendiente de cargar</Missing> : `${agency.province.code}-${agency.licenseNumber}`}
            </DataItem>
            {showGroup && <DataItem label="Grupo">{agency.group!.name}</DataItem>}
            <DataItem label="Dirección">
              {address || <Missing />}
              {agency.city ? `, ${agency.city}` : ""}
              <span className="text-muted-foreground"> · {agency.province.name}</span>
            </DataItem>
            <DataItem label="WhatsApp para jugadas">
              {formatPhone(agency.cellphoneNumber) ?? <Missing warn>Sin cargar: la agencia no puede recibir jugadas</Missing>}
            </DataItem>
            <DataItem label="Email">{agency.email ?? <Missing />}</DataItem>
          </DataList>
        </SettingsSection>

        <EditableSection
          title="Titular del legajo"
          description="El dato legal ante Lotería. Ser titular no da acceso por sí solo."
          canEdit={isGroupOwner}
          empty={!titular}
          view={
            <DataList>
              <DataItem label="Nombre" wide>
                {titular || <Missing warn>Pendiente de cargar</Missing>}
              </DataItem>
              <DataItem label="CUIL">{agency.titularCuil || <Missing />}</DataItem>
              <DataItem label="Email de Google">{agency.titularEmail || <Missing />}</DataItem>
            </DataList>
          }
        >
          <TitularForm
            action={saveTitularAction.bind(null, agencyId)}
            ownerEmails={agency.group?.owners.map((o) => o.email) ?? []}
            values={{
              firstName: agency.titularFirstName ?? "",
              lastName: agency.titularLastName ?? "",
              cuil: agency.titularCuil ?? "",
              email: agency.titularEmail ?? "",
            }}
          />
        </EditableSection>

        {legajoAccount && account && (
          <EditableSection
            id="cuenta-legajo"
            title="Cuenta del legajo"
            description="Donde Lotería debita lo recaudado y acredita premios y comisiones, según el ticket diario. Es una sola y no se usa para cobrarle a clientes."
            view={
              <DataList>
                <DataItem label="Banco">{account.provider ?? <Missing />}</DataItem>
                {/* Configuration shows where the account started in Laqui; today's balance lives in Movimientos. */}
                <DataItem label="Saldo inicial">
                  {money(account.openingBalance.toString())}
                  <span className="text-muted-foreground">
                    {" "}
                    al {account.openingDate.toLocaleDateString("es-AR", { timeZone: "UTC" })}
                  </span>
                </DataItem>
                <DataItem label="N.º de cuenta (como figura en el ticket)" wide>
                  {account.accountNumber ?? <Missing warn>Sin cargar</Missing>}
                </DataItem>
                {account.cbuCvu && <DataItem label="CBU">{account.cbuCvu}</DataItem>}
                {account.holderName && <DataItem label="Titular de la cuenta">{account.holderName}</DataItem>}
              </DataList>
            }
          >
            <EditFundForm
              legajo
              action={updateFundAction.bind(null, account.id)}
              kind={account.kind}
              today={today}
              values={{
                name: account.name,
                provider: account.provider,
                holderName: account.holderName,
                cbuCvu: account.cbuCvu,
                alias: account.alias,
                accountNumber: account.accountNumber,
                reference: account.reference,
                openingBalance: account.openingBalance.toString(),
                openingDate: account.openingDate.toISOString().slice(0, 10),
              }}
            />
          </EditableSection>
        )}

        {canManageDrive(role) && <DriveCard agencyId={agencyId} flash={drive} />}

        {isGroupOwner && (
          <EditableSection
            tone="danger"
            title="Pasar a otro grupo"
            actionLabel="Pasar a otro grupo"
            description="Por ejemplo, si la vendés."
            view={
              <p className="text-sm leading-relaxed text-muted-foreground">
                Se lleva su caja, fiados, finanzas y personal. Va a usar el horario general del otro grupo (salvo que
                tenga horario propio) y deja de ofrecer los productos propios de este grupo. Ustedes dejan de verla.
              </p>
            }
          >
            <SimpleForm footer danger action={moveAgencyAction.bind(null, agencyId)} submitLabel="Pasar la agencia">
              <p className="text-sm leading-relaxed text-muted-foreground">
                Se lleva su caja, fiados, finanzas y personal. Va a usar el horario general del otro grupo (salvo que
                tenga horario propio) y deja de ofrecer los productos propios de este grupo. Ustedes dejan de verla.
              </p>
              <label className="field">
                <span className="small muted">Email de un dueño del otro grupo</span>
                <input name="targetEmail" type="email" className="input" required autoComplete="off" />
              </label>
              <label className="field">
                <span className="small muted">
                  Para confirmar, escribí el nombre de la agencia: <strong>{agency.name}</strong>
                </span>
                <input name="confirmName" className="input" required autoComplete="off" />
              </label>
            </SimpleForm>
          </EditableSection>
        )}
      </SettingsPage>
    </main>
  );
}
