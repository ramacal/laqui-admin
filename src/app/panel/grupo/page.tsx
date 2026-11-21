import Link from "next/link";
import { ArrowRight, UserMinus } from "lucide-react";
import { currentGroupId, requireAccess } from "@/lib/access";
import { groupDetail } from "@/lib/groups";
import { SimpleForm } from "@/components/schedule/simple-form";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { ConfirmAction } from "@/components/ui/confirm-action";
import { EditableSection } from "@/components/ui/editable-section";
import { PageHeader } from "@/components/ui/page-header";
import { Row, RowList } from "@/components/ui/row-list";
import { SettingsPage, SettingsSection } from "@/components/ui/settings-section";
import { addOwnerAction, removeOwnerAction } from "./actions";

export const metadata = { title: "Personas del grupo · Laqui" };

const when = (d: Date) =>
  d.toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });

// "Personas del grupo" (spec agency-groups): the owners, all equal. Each sees every agency of
// the group and its shared settings. Per-agency admins and employees are under each agency.
export default async function GroupPeoplePage({ searchParams }: { searchParams: Promise<{ group?: string }> }) {
  const access = await requireAccess();
  const groupId = currentGroupId(access, (await searchParams).group);
  const group = groupId ? await groupDetail(groupId) : null;

  if (!group) {
    return (
      <main className="screen">
        <PageHeader title="Personas del grupo" subtitle="Esta sección es para los dueños de un grupo de agencias." />
      </main>
    );
  }

  const lastOne = group.owners.length <= 1;
  const activeAgencies = group.agencies.filter((a) => a.active);

  return (
    <main className="screen">
      <PageHeader
        title="Personas del grupo"
        subtitle={`${group.name} · ${activeAgencies.length} ${activeAgencies.length === 1 ? "agencia" : "agencias"}`}
      />

      <SettingsPage>
        <EditableSection
          title="Dueños"
          description="Todos los dueños ven y manejan todas las agencias del grupo, la plata, el horario general y los productos y precios. Los administradores y empleados de cada agencia se cargan en su Personal."
          addLabel="Agregar dueño"
          view={
            <div className="flex flex-col gap-2">
              <RowList>
                {group.owners.map((o) => {
                  const you = o.userId === access.user.id;
                  return (
                    <Row
                      key={o.id}
                      title={o.user?.name ?? o.email}
                      badge={you ? <Badge>Vos</Badge> : !o.user ? <Badge tone="warning">Todavía no ingresó</Badge> : undefined}
                      detail={o.user ? o.email : "Va a tener acceso cuando entre con Google"}
                      trailing={
                        lastOne ? undefined : (
                          <ConfirmAction
                            label={you ? "Dejar de ser dueño" : "Sacar"}
                            icon={<UserMinus />}
                            question={
                              you
                                ? "Dejás de ver las agencias del grupo. Queda registrado."
                                : "Deja de ver las agencias del grupo. Queda registrado quién lo sacó."
                            }
                            confirmLabel={you ? "Sí, dejar" : "Sí, sacar"}
                            action={removeOwnerAction.bind(null, group.id, o.id)}
                          />
                        )
                      }
                    />
                  );
                })}
              </RowList>
              {lastOne && <p className="text-sm text-muted-foreground">El grupo tiene que tener al menos un dueño.</p>}
            </div>
          }
        >
          <SimpleForm footer action={addOwnerAction.bind(null, group.id)} submitLabel="Agregar">
            <label className="field">
              <span className="small muted">Email de Google</span>
              <input name="email" type="email" className="input" placeholder="nombre@gmail.com" required autoComplete="off" />
            </label>
            <p className="text-sm text-muted-foreground">
              Si todavía no entró a Laqui, va a tener acceso la primera vez que ingrese con ese email.
            </p>
          </SimpleForm>
        </EditableSection>

        <SettingsSection title="Agencias" description="Las agencias del grupo y el titular de cada legajo.">
          <RowList>
            {group.agencies.map((a) => {
              const titular = [a.titularFirstName, a.titularLastName].filter(Boolean).join(" ");
              return (
                <Row
                  key={a.id}
                  muted={!a.active}
                  title={a.name}
                  badge={!a.active ? <Badge>Inactiva</Badge> : undefined}
                  detail={titular ? `Titular: ${titular}` : <span className="text-warning">Titular pendiente de cargar</span>}
                  trailing={
                    <Link href={`/panel/agencias/${a.id}/datos`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                      <ArrowRight /> Datos
                    </Link>
                  }
                />
              );
            })}
          </RowList>
        </SettingsSection>

        <SettingsSection title="Actividad" description="Los últimos cambios en dueños, titulares y agencias del grupo.">
          {group.events.length === 0 ? (
            <p className="text-sm text-muted-foreground">Todavía no hay cambios registrados.</p>
          ) : (
            <RowList>
              {group.events.map((e) => (
                <Row
                  key={e.id}
                  title={<span className="font-normal">
                    <strong>{e.actor?.name ?? "Sistema"}</strong> {e.detail}
                  </span>}
                  trailing={<span className="text-sm whitespace-nowrap text-muted-foreground">{when(e.createdAt)}</span>}
                />
              ))}
            </RowList>
          )}
        </SettingsSection>
      </SettingsPage>
    </main>
  );
}
