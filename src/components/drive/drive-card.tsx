// "Google Drive" card on the agency page (spec agency-google-drive): connection, folder and who
// has access. Read from the database only: no Drive calls while rendering the page.
import { prisma } from "@/lib/prisma";
import { folderUrl } from "@/lib/drive/google";
import { disconnectDriveAction, syncDrive } from "@/app/panel/agencias/[agencyId]/drive-actions";
import { DriveButtons } from "./drive-buttons";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { DataItem, DataList, Missing, SettingsSection } from "@/components/ui/settings-section";

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

// Shown as a settings section (Datos de la agencia).
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
  const flashLine = message && (
    <p className={`text-sm ${message.ok ? "text-success" : "text-destructive"}`} role="status">
      {message.text}
    </p>
  );

  if (!connected) {
    return (
      <SettingsSection
        title="Google Drive"
        description={DESCRIPTION}
        status={<Badge tone="neutral">Sin conectar</Badge>}
        actions={
          <a href={connectHref} className={buttonVariants({ variant: "outline", size: "sm" })}>
            <Plus /> Conectar
          </a>
        }
      >
        {flashLine}
        <p className="text-sm leading-relaxed text-muted-foreground">
          Puede ser otra cuenta de Google que la que usás para entrar (por ejemplo la de las redes). Laqui crea la carpeta{" "}
          <strong>laqui/…</strong>, la comparte con el personal y solo ve lo que crea ahí.
        </p>
      </SettingsSection>
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
    <SettingsSection
      title="Google Drive"
      description={DESCRIPTION}
      status={needsReconnect ? <Badge tone="warning">Hay que reconectar</Badge> : <Badge tone="success">Conectado</Badge>}
      actions={
        <DriveButtons
          sync={needsReconnect ? undefined : syncDrive.bind(null, agencyId)}
          disconnect={disconnectDriveAction.bind(null, agencyId)}
          connectHref={connectHref}
          folderHref={folderUrl(conn.folderId)}
        />
      }
    >
      {flashLine}
      {needsReconnect && (
        <p className="rounded-lg bg-warning-soft px-3 py-2 text-sm text-warning">
          Google ya no acepta el permiso de esta cuenta{conn.lastError ? ` (${conn.lastError})` : ""}. Reconectá para seguir
          guardando imágenes y compartiendo la carpeta.
        </p>
      )}
      <DataList>
        <DataItem label="Cuenta de Google">{conn.googleEmail}</DataItem>
        <DataItem label="Accesos">
          {conn.lastSyncedAt ? `Al día al ${when(conn.lastSyncedAt)}` : <Missing warn>Sin sincronizar</Missing>}
        </DataItem>
      </DataList>
      <div className="flex flex-col gap-1">
        {groups.map((g) => (
          <details key={g.label} className="group" open={g.label !== "Con acceso" && g.label !== "Sin email: no pueden recibir acceso"}>
            <summary className="cursor-pointer py-1 text-sm font-semibold">
              {g.label} ({g.items.length})
            </summary>
            <ul className="m-0 flex list-none flex-col gap-1 p-0 pt-1 pb-2 pl-4">
              {g.items.map((i) => (
                <li key={i.key} className="flex flex-wrap justify-between gap-x-4 text-sm">
                  <span>{i.name}</span>
                  <span className="text-muted-foreground">{i.detail}</span>
                </li>
              ))}
            </ul>
          </details>
        ))}
      </div>
    </SettingsSection>
  );
}

const DESCRIPTION = "La carpeta de la agencia para las imágenes de Redes, compartida con el personal.";
