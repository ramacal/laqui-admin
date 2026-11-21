import Link from "next/link";
import { currentGroupId, requireAccess } from "@/lib/access";
import { groupDetail } from "@/lib/groups";
import { SimpleForm } from "@/components/schedule/simple-form";
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
        <h1>Personas del grupo</h1>
        <p className="card muted">Esta sección es para los dueños de un grupo de agencias.</p>
      </main>
    );
  }

  const lastOne = group.owners.length <= 1;
  const activeAgencies = group.agencies.filter((a) => a.active);

  return (
    <main className="screen">
      <div className="stack-xs">
        <h1>Personas del grupo</h1>
        <p className="muted">
          {group.name} · {activeAgencies.length} {activeAgencies.length === 1 ? "agencia" : "agencias"}
        </p>
      </div>

      <section className="card stack-sm">
        <div className="stack-xs">
          <h2>Dueños</h2>
          <p className="muted small">
            Todos los dueños ven y manejan todas las agencias del grupo, la plata, el horario general y los productos y
            precios. Los administradores y empleados de cada agencia se cargan en su Personal.
          </p>
        </div>
        <ul className="list plain">
          {group.owners.map((o) => (
            <li key={o.id} className="row exception-row">
              <div className="stack-xs">
                <strong>{o.user?.name ?? o.email}</strong>
                <span className="muted small">
                  {o.user ? o.email : "Todavía no ingresó: va a tener acceso cuando entre con Google"}
                  {o.userId === access.user.id ? " · vos" : ""}
                </span>
              </div>
              {!lastOne && (
                <details>
                  <summary className="small">Sacar</summary>
                  <div className="spaced">
                    <SimpleForm
                      action={removeOwnerAction.bind(null, group.id, o.id)}
                      submitLabel={o.userId === access.user.id ? "Dejar de ser dueño" : "Sacar del grupo"}
                      buttonClassName="btn btn-sm btn-danger"
                    >
                      <p className="small muted">Deja de ver las agencias del grupo. Queda registrado quién lo sacó.</p>
                    </SimpleForm>
                  </div>
                </details>
              )}
            </li>
          ))}
        </ul>
        {lastOne && <p className="small muted">El grupo tiene que tener al menos un dueño.</p>}

        <details>
          <summary>Agregar dueño</summary>
          <div className="spaced">
            <SimpleForm action={addOwnerAction.bind(null, group.id)} submitLabel="Agregar dueño">
              <label className="field">
                <span className="small muted">Email de Google</span>
                <input name="email" type="email" className="input" placeholder="nombre@gmail.com" required autoComplete="off" />
              </label>
            </SimpleForm>
          </div>
        </details>
      </section>

      <section className="card stack-sm">
        <h2>Agencias</h2>
        <ul className="list plain">
          {group.agencies.map((a) => {
            const titular = [a.titularFirstName, a.titularLastName].filter(Boolean).join(" ");
            return (
              <li key={a.id} className="row exception-row">
                <Link href={`/panel/agencias/${a.id}`} className="link">
                  {a.name}
                </Link>
                <span className={`small ${titular ? "muted" : "warn"}`}>
                  {titular ? `Titular: ${titular}` : "Titular pendiente"}
                  {a.active ? "" : " · inactiva"}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="card stack-sm">
        <h2>Actividad</h2>
        {group.events.length === 0 ? (
          <p className="muted small">Todavía no hay cambios registrados.</p>
        ) : (
          <ul className="list plain">
            {group.events.map((e) => (
              <li key={e.id} className="row exception-row">
                <span className="small">
                  <strong>{e.actor?.name ?? "Sistema"}</strong> {e.detail}
                </span>
                <span className="muted small">{when(e.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
