import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ROLE_LABEL, agencyRole, canViewStaff, requireAccess } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { publicUrl } from "@/lib/storage";
import { OwnerEmailForm } from "@/components/owner-email-form";
import { assignOwnerEmail } from "./actions";

export const metadata = { title: "Agencia · Laqui" };

const ROLE_ORDER = { OWNER: 0, ADMIN: 1, EMPLOYEE: 2 } as const;

function seniority(hiredAt: Date | null) {
  if (!hiredAt) return null;
  const now = new Date();
  let years = now.getUTCFullYear() - hiredAt.getUTCFullYear();
  const beforeAnniversary =
    now.getUTCMonth() < hiredAt.getUTCMonth() ||
    (now.getUTCMonth() === hiredAt.getUTCMonth() && now.getUTCDate() < hiredAt.getUTCDate());
  if (beforeAnniversary) years--;
  const since = hiredAt.toLocaleDateString("es-AR", { timeZone: "UTC", month: "short", year: "numeric" });
  if (years < 1) return `Desde ${since}`;
  return `Desde ${since} · ${years} ${years === 1 ? "año" : "años"}`;
}

const formatPhone = (e164: string | null) => (e164 ? `+${e164}` : null);
const formatDate = (d: Date) => d.toLocaleDateString("es-AR", { timeZone: "UTC" });

const SHIFT_LABEL = { MORNING: "Turno mañana", AFTERNOON: "Turno tarde", FULL_DAY: "Jornada completa", ROTATING: "Rotativo" } as const;

export default async function AgencyPage({ params }: { params: Promise<{ agencyId: string }> }) {
  const { agencyId } = await params;
  const access = await requireAccess();
  const role = agencyRole(access, agencyId);
  if (!role) notFound(); // do not reveal agencies the user cannot see

  const agency = await prisma.agency.findUnique({
    where: { id: agencyId },
    include: {
      province: { select: { code: true, name: true } },
      assets: { where: { kind: "LOGO_SYMBOL" }, select: { storageKey: true } },
      employees: canViewStaff(role)
        ? { orderBy: [{ active: "desc" }, { lastName: "asc" }, { firstName: "asc" }] }
        : false,
    },
  });
  if (!agency) notFound();

  // The titular is the agency's owner (spec: Owner Is the License Holder).
  const owner = await prisma.agencyEmployee.findFirst({
    where: { agencyId, role: "OWNER", active: true },
    select: { firstName: true, lastName: true, email: true, userId: true },
  });
  const isMember = access.memberships.some((m) => m.agency.id === agencyId);
  const roleLabel = !isMember && access.isPlatformAdmin ? "Admin de plataforma" : ROLE_LABEL[role];

  const logo = agency.assets[0];
  const pendingLicense = /^pend/i.test(agency.licenseNumber);
  const staff = (agency.employees ?? []).sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role]);
  const active = staff.filter((e) => e.active);
  const inactive = staff.filter((e) => !e.active);
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
            <dt>Titular (dueño)</dt>
            <dd>
              {owner ? `${owner.firstName} ${owner.lastName}` : <span className="warn">Sin dueño cargado</span>}
              {owner && !owner.userId && (
                <span className="muted"> · todavía no ingresó al panel</span>
              )}
            </dd>
          </div>
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

      {access.isPlatformAdmin && owner && (
        <section className="card stack-sm">
          <h2>Acceso del dueño</h2>
          <OwnerEmailForm currentEmail={owner.email} action={assignOwnerEmail.bind(null, agencyId)} />
        </section>
      )}

      {canViewStaff(role) && (
        <section className="stack-sm">
          <div className="row">
            <h2>Personal</h2>
            <span className="muted small">
              {active.length} {active.length === 1 ? "activo" : "activos"}
            </span>
          </div>

          {active.length === 0 ? (
            <p className="card muted">Todavía no hay personal cargado.</p>
          ) : (
            <ul className="list">
              {active.map((e) => (
                <li key={e.id} className="card stack-sm">
                  <div className="row">
                    <div className="stack-xs">
                      <strong>
                        {e.firstName} {e.lastName}
                      </strong>
                      <span className="muted small">
                        {[
                          e.role === "OWNER" ? "Titular del legajo" : e.jobTitle,
                          e.shift ? SHIFT_LABEL[e.shift] : null,
                          seniority(e.hiredAt),
                        ]
                          .filter(Boolean)
                          .join(" · ") || "Sin puesto ni fecha de ingreso"}
                      </span>
                    </div>
                    <span className={`badge ${e.role === "EMPLOYEE" ? "neutral" : ""}`}>{ROLE_LABEL[e.role]}</span>
                  </div>
                  <div className="tags">
                    {e.phone && <span className="tag">{formatPhone(e.phone)}</span>}
                    {e.userId && <span className="tag">Con acceso al panel</span>}
                    {e.role !== "OWNER" && (
                      <span className={`tag ${e.socialMediaConsent ? "ok" : ""}`}>
                        {e.socialMediaConsent
                          ? `Redes: sí${e.publicName ? ` como "${e.publicName}"` : ""}`
                          : "Redes: sin permiso firmado"}
                      </span>
                    )}
                  </div>
                  {e.notes && <p className="note small">{e.notes}</p>}
                </li>
              ))}
            </ul>
          )}

          {inactive.length > 0 && (
            <details className="card">
              <summary>Ex empleados ({inactive.length})</summary>
              <ul className="list plain">
                {inactive.map((e) => (
                  <li key={e.id} className="row muted small">
                    <span>
                      {e.firstName} {e.lastName}
                    </span>
                    <span>{e.leftAt ? `Egreso ${formatDate(e.leftAt)}` : "Sin fecha de egreso"}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </section>
      )}
    </main>
  );
}
