// "Google Drive" card on the agency page (spec agency-google-drive): connection, folder and who
// has access. Read from the database only: no Drive calls while rendering the page.
import { prisma } from "@/lib/prisma";
import { folderUrl } from "@/lib/drive/google";
import { disconnectDriveAction, syncDrive } from "@/app/panel/agencias/[agencyId]/drive-actions";
import { DriveButtons } from "./drive-buttons";

const FLASH: Record<string, { ok: boolean; text: string }> = {
  conectado: { ok: true, text: "Google Drive conectado. La carpeta ya está creada y compartida con el personal." },
  cancelado: { ok: false, text: "Se canceló la conexión con Google Drive." },
  "error-permiso": { ok: false, text: "Falta el permiso de Drive: volvé a conectar y dejá tildado «Ver, editar, crear y borrar los archivos de Drive que uses con esta app»." },
  "error-token": { ok: false, text: "Google no devolvió un permiso duradero. Probá conectar de nuevo." },
  "error-estado": { ok: false, text: "No se pudo conectar: el pedido venció o no salió de esta sesión. Probá de nuevo." },
  "error-acceso": { ok: false, text: "Solo el dueño o un administrador puede conectar Google Drive." },
  "error-config": { ok: false, text: "Google Drive no está configurado en Laqui (faltan las claves de Google o DRIVE_TOKEN_KEY)." },
  "error-google": { ok: false, text: "No se pudo conectar con Google Drive. Probá de nuevo en un rato." },
};

const fullName = (e: { firstName: string; lastName: string } | null, email: string) => (e ? `${e.firstName} ${e.lastName}` : email);
const when = (d: Date) => d.toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", dateStyle: "short", timeStyle: "short" });

export async function DriveCard({ agencyId, flash }: { agencyId: string; flash?: string }) {
  const [conn, staff] = await Promise.all([
    prisma.agencyDriveConnection.findUnique({
      where: { agencyId },
      include: { shares: { include: { employee: { select: { firstName: true, lastName: true } } }, orderBy: { email: "asc" } } },
    }),
    prisma.agencyEmployee.findMany({
      where: { agencyId, active: true },
      select: { id: true, firstName: true, lastName: true, email: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
  ]);
  const message = flash ? FLASH[flash] : undefined;
  const connectHref = `/api/drive/connect?agencia=${agencyId}`;
  const connected = conn && conn.status !== "DISCONNECTED";

  if (!connected) {
    return (
      <section className="card stack-sm">
        <h2>Google Drive</h2>
        {message && <p className={`small ${message.ok ? "ok-text" : "error"}`}>{message.text}</p>}
        <p className="small muted">
          Guardá las imágenes de Redes en el Drive de la agencia. Puede ser otra cuenta de Google que la que usás para
          entrar (por ejemplo la de las redes). Laqui crea la carpeta <strong>laqui/…</strong>, la comparte con el
          personal y solo ve lo que crea ahí.
        </p>
        <div className="row-start">
          <a href={connectHref} className="btn btn-primary btn-sm">
            Conectar Google Drive
          </a>
        </div>
      </section>
    );
  }

  const byState = (s: "SHARED" | "MANUAL" | "FAILED") => conn.shares.filter((r) => r.state === s);
  const handled = new Set(conn.shares.map((r) => r.email));
  const driveEmail = conn.googleEmail.toLowerCase();
  const noEmail = staff.filter((e) => !e.email);
  const pending = staff.filter((e) => e.email && e.email.toLowerCase() !== driveEmail && !handled.has(e.email.toLowerCase()));
  const needsReconnect = conn.status === "NEEDS_RECONNECT";
  const groups = [
    { label: "Con acceso", items: byState("SHARED").map((r) => ({ key: r.id, name: fullName(r.employee, r.email), detail: r.email })) },
    {
      label: "Acceso dado a mano (Laqui no lo toca)",
      items: byState("MANUAL").map((r) => ({ key: r.id, name: fullName(r.employee, r.email), detail: r.email })),
    },
    {
      label: "No se pudo compartir",
      items: byState("FAILED").map((r) => ({ key: r.id, name: fullName(r.employee, r.email), detail: `${r.email} · ${r.error ?? "error de Google"}` })),
    },
    { label: "Falta sincronizar", items: pending.map((e) => ({ key: e.id, name: fullName(e, ""), detail: e.email! })) },
    { label: "Sin email: no pueden recibir acceso", items: noEmail.map((e) => ({ key: e.id, name: fullName(e, ""), detail: "Cargá su email de Google" })) },
  ].filter((g) => g.items.length > 0);

  return (
    <section className="card stack-sm">
      <div className="row">
        <h2>Google Drive</h2>
        <span className={`badge ${needsReconnect ? "neutral" : ""}`}>{needsReconnect ? "Hay que reconectar" : "Conectado"}</span>
      </div>
      {message && <p className={`small ${message.ok ? "ok-text" : "error"}`}>{message.text}</p>}
      <p className="small">
        Cuenta <strong>{conn.googleEmail}</strong> ·{" "}
        <a href={folderUrl(conn.folderId)} target="_blank" rel="noreferrer" className="link">
          Abrir carpeta
        </a>
        <span className="muted"> · {conn.lastSyncedAt ? `accesos al día al ${when(conn.lastSyncedAt)}` : "accesos sin sincronizar"}</span>
      </p>
      {needsReconnect && (
        <p className="notice small">
          Google ya no acepta el permiso de esta cuenta{conn.lastError ? ` (${conn.lastError})` : ""}. Reconectá para seguir
          guardando imágenes y compartiendo la carpeta.
        </p>
      )}

      {groups.map((g) => (
        <details key={g.label} open={g.label !== "Con acceso" || g.items.length <= 6}>
          <summary className="small">
            {g.label} ({g.items.length})
          </summary>
          <ul className="list plain">
            {g.items.map((i) => (
              <li key={i.key} className="row small">
                <span>{i.name}</span>
                <span className="muted">{i.detail}</span>
              </li>
            ))}
          </ul>
        </details>
      ))}

      <DriveButtons
        sync={needsReconnect ? undefined : syncDrive.bind(null, agencyId)}
        disconnect={disconnectDriveAction.bind(null, agencyId)}
        connectHref={connectHref}
      />
    </section>
  );
}
