import Link from "next/link";
import { notFound } from "next/navigation";
import { ROLE_LABEL, agencyRole, canManageStaff, canViewStaff, requireAccess } from "@/lib/access";
import { formatCellphone } from "@/lib/phone";
import { prisma } from "@/lib/prisma";
import type { EmployeeRole } from "@/generated/prisma/enums";
import { SimpleForm } from "@/components/schedule/simple-form";
import { EmployeeFields } from "@/components/staff/employee-fields";
import { deactivateAction, hireAction, reactivateAction, updateAction } from "./actions";

export const metadata = { title: "Personal · Laqui" };

const ROLE_ORDER = { OWNER: 0, ADMIN: 1, EMPLOYEE: 2 } as const;
const SHIFT_LABEL = { MORNING: "Turno mañana", AFTERNOON: "Turno tarde", FULL_DAY: "Jornada completa", ROTATING: "Rotativo" } as const;
const formatDate = (d: Date) => d.toLocaleDateString("es-AR", { timeZone: "UTC" });
const today = () => new Date().toISOString().slice(0, 10);

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

// Staff of one agency: owners and agency admins add, edit and deactivate people.
export default async function StaffPage({ params }: { params: Promise<{ agencyId: string }> }) {
  const { agencyId } = await params;
  const access = await requireAccess();
  const role = agencyRole(access, agencyId);
  if (!role || !canViewStaff(role)) notFound();

  const agency = await prisma.agency.findUnique({
    where: { id: agencyId },
    select: {
      name: true,
      employees: { where: { role: { not: "OWNER" } }, orderBy: [{ lastName: "asc" }, { firstName: "asc" }] }, // legacy OWNER rows: the titular is agency data now
    },
  });
  if (!agency) notFound();

  const staff = agency.employees.sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role]);
  const active = staff.filter((e) => e.active);
  const inactive = staff.filter((e) => !e.active);
  const roles = (["ADMIN", "EMPLOYEE"] as EmployeeRole[])
    .filter((r) => canManageStaff(role, r))
    .map((r) => ({ value: r, label: ROLE_LABEL[r] }));

  return (
    <main className="screen">
      <Link href={`/panel/agencias/${agencyId}`} className="back">
        ← {agency.name}
      </Link>
      <div className="row">
        <h1>Personal</h1>
        <span className="muted small">
          {active.length} {active.length === 1 ? "activo" : "activos"}
        </span>
      </div>

      <details className="card" open={active.length <= 1}>
        <summary>Agregar empleado</summary>
        <div className="spaced">
          <SimpleForm action={hireAction.bind(null, agencyId)} submitLabel="Agregar al personal">
            <EmployeeFields roles={roles} />
            <p className="small muted">
              Solo nombre y apellido son obligatorios. Con el email de Google, la persona entra al panel y ve la carpeta de Drive
              de la agencia.
            </p>
          </SimpleForm>
        </div>
      </details>

      {active.length === 0 ? (
        <p className="card muted">Todavía no hay personal cargado.</p>
      ) : (
        <ul className="list">
          {active.map((e) => {
            const manageable = canManageStaff(role, e.role);
            return (
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
                  {e.phone && <span className="tag">{formatCellphone(e.phone)}</span>}
                  {e.email && <span className="tag">{e.email}</span>}
                  {e.userId ? (
                    <span className="tag ok">Con acceso al panel</span>
                  ) : (
                    e.email && <span className="tag">Todavía no ingresó</span>
                  )}
                  {e.role !== "OWNER" && (
                    <span className={`tag ${e.socialMediaConsent ? "ok" : ""}`}>
                      {e.socialMediaConsent
                        ? `Redes: sí${e.publicName ? ` como "${e.publicName}"` : ""}`
                        : "Redes: sin permiso firmado"}
                    </span>
                  )}
                </div>
                {e.notes && <p className="note small">{e.notes}</p>}

                {manageable && (
                  <details>
                    <summary className="small">Editar</summary>
                    <div className="spaced stack-sm">
                      <SimpleForm action={updateAction.bind(null, e.id)} submitLabel="Guardar cambios">
                        <EmployeeFields values={e} roles={roles} isOwnerRow={e.role === "OWNER"} />
                      </SimpleForm>
                      {e.role !== "OWNER" && (
                        <SimpleForm action={deactivateAction.bind(null, e.id)} submitLabel="Dar de baja" className="stack-sm">
                          <label className="field">
                            <span className="small muted">Fecha de egreso</span>
                            <input name="leftAt" type="date" className="input" defaultValue={today()} />
                          </label>
                          <p className="small muted">Deja de entrar al panel y a la carpeta de Drive. Sus datos quedan guardados.</p>
                        </SimpleForm>
                      )}
                    </div>
                  </details>
                )}
              </li>
            );
          })}
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
                  {e.leftAt ? ` · egreso ${formatDate(e.leftAt)}` : ""}
                </span>
                {canManageStaff(role, e.role) && (
                  <SimpleForm action={reactivateAction.bind(null, e.id)} submitLabel="Reactivar" className="inline-form" />
                )}
              </li>
            ))}
          </ul>
        </details>
      )}
    </main>
  );
}
