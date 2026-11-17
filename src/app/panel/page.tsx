import { ROLE_LABEL, requireAccess } from "@/lib/access";
import { SignOutButton } from "@/components/sign-out-button";

export const metadata = { title: "Panel · Laqui" };

export default async function PanelPage() {
  const { user, isPlatformAdmin, memberships } = await requireAccess();
  const hasAccess = isPlatformAdmin || memberships.length > 0;

  return (
    <main className="screen">
      <header className="topbar">
        <div className="stack-xs">
          <strong>{user.name}</strong>
          <span className="muted small">{user.email}</span>
        </div>
        <SignOutButton />
      </header>

      <section className="stack">
        {isPlatformAdmin && (
          <article className="card stack-sm">
            <span className="badge">Admin de plataforma</span>
            <p className="muted">Acceso a juegos, provincias, calendarios y todas las agencias.</p>
          </article>
        )}

        {memberships.length > 0 && (
          <div className="stack-sm">
            <h2>Tus agencias</h2>
            <ul className="list">
              {memberships.map((m) => (
                <li key={m.id} className="card row">
                  <div className="stack-xs">
                    <strong>{m.agency.name}</strong>
                    <span className="muted small">Legajo {m.agency.licenseNumber}</span>
                  </div>
                  <span className="badge">{ROLE_LABEL[m.role]}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {!hasAccess && (
          <article className="card stack-sm">
            <h2>Todavía no tenés acceso</h2>
            <p className="muted">
              Pedile al dueño o administrador de tu agencia que te registre como empleado con este email:{" "}
              <strong>{user.email}</strong>. La próxima vez que ingreses vas a ver tu agencia acá.
            </p>
          </article>
        )}
      </section>
    </main>
  );
}
