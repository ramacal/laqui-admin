import { notFound } from "next/navigation";
import { ROLE_LABEL, agencyRole, canManageStaff, canViewStaff, requireAccess } from "@/lib/access";
import { formatCellphone } from "@/lib/phone";
import { prisma } from "@/lib/prisma";
import type { EmployeeRole } from "@/generated/prisma/enums";
import { SimpleForm } from "@/components/schedule/simple-form";
import { UserMinus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { AddableList, EditableSection } from "@/components/ui/editable-section";
import { PageHeader } from "@/components/ui/page-header";
import { DataItem, DataList, Missing, Panel, PanelList } from "@/components/ui/settings-section";
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

// Staff of one agency: owners and agency admins add, edit and deactivate people. Each person is a
// panel (data + actions column); former staff are listed at the end with "Reactivar".
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
  const canAdd = roles.length > 0;

  const list = (
    <PanelList>
      {active.map((e) => {
        const manageable = canManageStaff(role, e.role);
        return (
          <li key={e.id}>
            <EditableSection
              item
              canEdit={manageable}
              title={`${e.firstName} ${e.lastName}`}
              subtitle={[e.jobTitle, e.shift ? SHIFT_LABEL[e.shift] : null, seniority(e.hiredAt)].filter(Boolean).join(" · ") || undefined}
              status={
                <>
                  <Badge tone={e.role === "EMPLOYEE" ? "neutral" : "success"}>{ROLE_LABEL[e.role]}</Badge>
                  {e.userId ? (
                    <Badge tone="success">Con acceso al panel</Badge>
                  ) : e.email ? (
                    <Badge>Todavía no ingresó</Badge>
                  ) : null}
                </>
              }
              view={
                <DataList>
                  <DataItem label="Celular">{e.phone ? formatCellphone(e.phone) : <Missing />}</DataItem>
                  <DataItem label="Email de Google">{e.email ?? <Missing>Sin cargar: no puede entrar al panel</Missing>}</DataItem>
                  <DataItem label="Redes">
                    {e.socialMediaConsent ? (
                      `Sí${e.publicName ? `, como "${e.publicName}"` : ""}`
                    ) : (
                      <Missing>Sin permiso firmado</Missing>
                    )}
                  </DataItem>
                  {e.notes && (
                    <DataItem label="Notas" wide>
                      <span className="block rounded-lg bg-warning-soft px-3 py-2 text-sm text-warning">{e.notes}</span>
                    </DataItem>
                  )}
                </DataList>
              }
              forms={
                manageable
                  ? [
                      {
                        key: "baja",
                        label: "Dar de baja",
                        icon: <UserMinus />,
                        tone: "danger",
                        form: (
                          <SimpleForm footer danger action={deactivateAction.bind(null, e.id)} submitLabel="Dar de baja">
                            <label className="field">
                              <span className="small muted">Fecha de egreso</span>
                              <input name="leftAt" type="date" className="input" defaultValue={today()} />
                            </label>
                            <p className="text-sm text-muted-foreground">
                              Deja de entrar al panel y a la carpeta de Drive. Sus datos quedan guardados y se puede
                              reactivar.
                            </p>
                          </SimpleForm>
                        ),
                      },
                    ]
                  : []
              }
            >
              {manageable && (
                <SimpleForm footer action={updateAction.bind(null, e.id)} submitLabel="Guardar">
                  <EmployeeFields values={e} roles={roles} />
                </SimpleForm>
              )}
            </EditableSection>
          </li>
        );
      })}
    </PanelList>
  );

  return (
    <main className="screen">
      <PageHeader
        back={{ href: `/panel/agencias/${agencyId}`, label: agency.name }}
        title="Personal"
        subtitle="Quién trabaja en la agencia. Con su email de Google entra al panel y a la carpeta de Drive."
      />

      {canAdd ? (
        <AddableList
          count={`${active.length} ${active.length === 1 ? "activo" : "activos"}`}
          addLabel="Agregar empleado"
          formTitle="Nuevo empleado"
          form={
            <SimpleForm footer action={hireAction.bind(null, agencyId)} submitLabel="Agregar">
              <EmployeeFields roles={roles} />
              <p className="text-sm text-muted-foreground">Solo nombre y apellido son obligatorios.</p>
            </SimpleForm>
          }
        >
          {active.length === 0 ? <p className="text-sm text-muted-foreground">Todavía no hay personal cargado.</p> : list}
        </AddableList>
      ) : (
        list
      )}

      {inactive.length > 0 && (
        <section className="flex flex-col gap-3 pt-4">
          <h2 className="text-base font-bold">Ex empleados</h2>
          <PanelList>
            {inactive.map((e) => (
              <li key={e.id}>
                <Panel
                  muted
                  heading={{
                    title: `${e.firstName} ${e.lastName}`,
                    subtitle: e.leftAt ? `Egreso ${formatDate(e.leftAt)}` : "Dado de baja",
                  }}
                  actions={
                    canManageStaff(role, e.role) ? (
                      <SimpleForm
                        action={reactivateAction.bind(null, e.id)}
                        submitLabel="Reactivar"
                        className="flex flex-col gap-1"
                        buttonClassName={`${buttonVariants({ variant: "outline", size: "sm" })} w-full lg:justify-start`}
                      />
                    ) : undefined
                  }
                >
                  {null}
                </Panel>
              </li>
            ))}
          </PanelList>
        </section>
      )}
    </main>
  );
}
