import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ROLE_LABEL, agencyRole, canManageDrive, canViewStaff, ownsGroup, requireAccess } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { publicUrl } from "@/lib/storage";
import { formatRanges, isAgencyOpen } from "@/lib/schedule";
import { agencyCatalog } from "@/lib/catalog";
import { agencyBalances } from "@/lib/finance";
import { money } from "@/components/products/price-parts";
import { DriveCard } from "@/components/drive/drive-card";
import { TitularForm } from "@/components/groups/titular-form";
import { SimpleForm } from "@/components/schedule/simple-form";
import { moveAgencyAction, saveTitularAction } from "@/app/panel/grupo/actions";

export const metadata = { title: "Agencia · Laqui" };

const ROLE_ORDER = { OWNER: 0, ADMIN: 1, EMPLOYEE: 2 } as const;

const formatPhone = (e164: string | null) => (e164 ? `+${e164}` : null);

export default async function AgencyPage({
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
  if (!role) notFound(); // do not reveal agencies the user cannot see

  const agency = await prisma.agency.findUnique({
    where: { id: agencyId },
    include: {
      province: { select: { code: true, name: true } },
      group: { select: { name: true, owners: { select: { email: true } }, _count: { select: { agencies: true, owners: true } } } },
      assets: { where: { kind: "LOGO_SYMBOL" }, select: { storageKey: true } },
      employees: canViewStaff(role)
        ? { where: { role: { not: "OWNER" } }, orderBy: [{ active: "desc" }, { lastName: "asc" }, { firstName: "asc" }] }
        : false,
    },
  });
  if (!agency) notFound();

  // Titular = legal data of the license; the agency belongs to a group (spec agency-groups).
  const titular = [agency.titularFirstName, agency.titularLastName].filter(Boolean).join(" ");
  // The group is named only when there is more than one agency or owner in it.
  const showGroup = Boolean(agency.group) && (agency.group!._count.agencies > 1 || agency.group!._count.owners > 1);
  const isGroupOwner = ownsGroup(access, agency.groupId);
  const [now, catalog, finances] = await Promise.all([
    isAgencyOpen(agencyId),
    agencyCatalog(agencyId),
    canViewStaff(role) ? agencyBalances(agencyId) : Promise.resolve(null), // owners and admins only
  ]);
  const isMember = access.memberships.some((m) => m.agency.id === agencyId);
  const roleLabel = !isMember && access.isPlatformAdmin ? "Admin de plataforma" : ROLE_LABEL[role];

  const logo = agency.assets[0];
  const pendingLicense = /^pend/i.test(agency.licenseNumber);
  const staff = (agency.employees ?? []).sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role]);
  const active = staff.filter((e) => e.active);
  const address = [agency.street, agency.streetNumber].filter(Boolean).join(" ");

  return (
    <main className="screen">
      <Link href="/panel" className="back">
        ← Tus agencias
      </Link>

      <header className="row agency">
        {logo ? (
          <Image src={publicUrl(logo.storageKey)} alt="" width={64} height={64} className="agency-logo lg" />
        ) : (
          <span
            className="agency-logo lg placeholder"
            style={{ background: agency.primaryColor ?? undefined }}
            aria-hidden="true"
          >
            {agency.name.charAt(0)}
          </span>
        )}
        <div className="stack-xs">
          <h1>{agency.name}</h1>
          <span className="muted small">
            {pendingLicense ? "Legajo pendiente" : `Legajo ${agency.province.code}-${agency.licenseNumber}`} ·{" "}
            <span className="badge inline">{roleLabel}</span>
          </span>
        </div>
      </header>

      <section className="card">
        <dl className="facts">
          <div>
            <dt>Titular del legajo</dt>
            <dd>
              {titular || <span className="warn">Pendiente de cargar</span>}
            </dd>
          </div>
          {showGroup && (
            <div>
              <dt>Grupo</dt>
              <dd>{agency.group!.name}</dd>
            </div>
          )}
          <div>
            <dt>Dirección</dt>
            <dd>
              {address || <span className="muted">Sin cargar</span>}
              {agency.city ? `, ${agency.city}` : ""}
              <span className="muted"> · {agency.province.name}</span>
            </dd>
          </div>
          <div>
            <dt>WhatsApp para jugadas</dt>
            <dd>
              {formatPhone(agency.cellphoneNumber) ?? (
                <span className="warn">Sin cargar: la agencia no puede recibir jugadas</span>
              )}
            </dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>{agency.email ?? <span className="muted">Sin cargar</span>}</dd>
          </div>
        </dl>
      </section>

      <Link href={`/panel/agencias/${agencyId}/horario`} className={`card row link-card status ${now.open ? "is-open" : "is-closed"}`}>
        <div className="stack-xs">
          <strong>Horario · {now.open ? `Abierta, cierra ${now.closesAt}` : "Cerrada ahora"}</strong>
          <span className="small">
            Hoy: {formatRanges(now.ranges)}
            {now.reason ? ` · ${now.reason}` : ""}
            {now.holidayWithoutException ? " · feriado sin excepción" : ""}
          </span>
        </div>
        <span className="chevron" aria-hidden="true">
          ›
        </span>
      </Link>

      <Link href={`/panel/agencias/${agencyId}/productos`} className="card row link-card">
        <div className="stack-xs">
          <strong>Productos · {catalog.games.length + catalog.products.length} a la venta hoy</strong>
          <span className="small muted">
            {[...catalog.games.map((g) => g.name), ...catalog.products.map((p) => p.name)].join(", ") || "Nada a la venta"}
          </span>
        </div>
        <span className="chevron" aria-hidden="true">
          ›
        </span>
      </Link>

      <Link href={`/panel/agencias/${agencyId}/caja`} className="card row link-card">
        <div className="stack-xs">
          <strong>Caja diaria</strong>
          <span className="small muted">Abrir y cerrar el turno, aciertos, gastos, transferencias y fiados</span>
        </div>
        <span className="chevron" aria-hidden="true">
          ›
        </span>
      </Link>

      <Link href={`/panel/agencias/${agencyId}/redes`} className="card row link-card">
        <div className="stack-xs">
          <strong>Redes</strong>
          <span className="small muted">Ideas para publicar con números para jugar, imágenes con la marca e Instagram</span>
        </div>
        <span className="chevron" aria-hidden="true">
          ›
        </span>
      </Link>

      {canManageDrive(role) && <DriveCard agencyId={agencyId} flash={drive} />}

      {finances && (
        <Link href={`/panel/agencias/${agencyId}/finanzas`} className="card row link-card">
          <div className="stack-xs">
            <strong>Finanzas · {money(finances.total.toString())}</strong>
            <span className="small muted">
              {finances.funds
                .filter((f) => f.fund.active)
                .map((f) => `${f.fund.name} ${money(f.balance.toString())}`)
                .join(" · ")}
            </span>
          </div>
          <span className="chevron" aria-hidden="true">
            ›
          </span>
        </Link>
      )}

      {canViewStaff(role) && (
        <Link href={`/panel/agencias/${agencyId}/personal`} className="card row link-card">
          <div className="stack-xs">
            <strong>
              Personal · {active.length} {active.length === 1 ? "activo" : "activos"}
            </strong>
            <span className="small muted">
              {active.map((e) => e.firstName).join(", ") || "Todavía no hay personal cargado"} · agregar, editar o dar de baja
            </span>
          </div>
          <span className="chevron" aria-hidden="true">
            ›
          </span>
        </Link>
      )}

      {isGroupOwner && (
        <section className="card stack-sm">
          <div className="stack-xs">
            <h2>Titular del legajo</h2>
            <p className="muted small">El dato legal ante Lotería. Ser titular no da acceso por sí solo.</p>
          </div>
          <details open={!titular}>
            <summary>{titular ? `Editar titular (${titular})` : "Cargar titular"}</summary>
            <div className="spaced">
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
            </div>
          </details>
        </section>
      )}

      {isGroupOwner && (
        <section className="card stack-sm danger-zone">
          <details>
            <summary>Pasar esta agencia a otro grupo</summary>
            <div className="spaced">
              <SimpleForm
                action={moveAgencyAction.bind(null, agencyId)}
                submitLabel="Pasar la agencia"
                buttonClassName="btn btn-danger"
              >
                <p className="small muted">
                  Por ejemplo, si la vendés. Se lleva su caja, fiados, finanzas y personal. Va a usar el horario general
                  del otro grupo (salvo que tenga horario propio) y deja de ofrecer los productos propios de este grupo.
                  Ustedes dejan de verla.
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
            </div>
          </details>
        </section>
      )}
    </main>
  );
}
