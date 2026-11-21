"use server";

// Agency Google Drive actions (spec agency-google-drive). Connecting is a redirect flow
// (/api/drive/connect), not an action.
import { revalidatePath } from "next/cache";
import { agencyRole, canManageDrive, getAccess } from "@/lib/access";
import { ideaPicture, pictureFileName } from "@/lib/content/picture";
import { driveErrorMessage } from "@/lib/drive/client";
import { DriveFolderMissingError, disconnectDrive, uploadPicture } from "@/lib/drive/connection";
import { syncDriveAccess } from "@/lib/drive/sharing";

export type DriveActionState = { ok: boolean; message: string; link?: string } | null;

const NOT_ALLOWED = { ok: false, message: "Solo el dueño o un administrador puede manejar el Drive de la agencia." };

export async function syncDrive(agencyId: string, _prev: DriveActionState): Promise<DriveActionState> {
  const access = await getAccess();
  if (!access || !canManageDrive(agencyRole(access, agencyId))) return NOT_ALLOWED;
  try {
    const r = await syncDriveAccess(agencyId);
    if (!r) return { ok: false, message: "No hay una conexión activa con Google Drive." };
    const parts = [
      r.added && `${r.added} con acceso nuevo`,
      r.removed && `${r.removed} sin acceso`,
      r.failed && `${r.failed} no se pudieron compartir`,
    ].filter(Boolean);
    return { ok: true, message: parts.length ? `Listo: ${parts.join(", ")}.` : "Listo: los accesos ya estaban al día." };
  } catch (err) {
    return { ok: false, message: driveErrorMessage(err) };
  } finally {
    revalidatePath(`/panel/agencias/${agencyId}`);
  }
}

export async function disconnectDriveAction(agencyId: string, _prev: DriveActionState): Promise<DriveActionState> {
  const access = await getAccess();
  if (!access || !canManageDrive(agencyRole(access, agencyId))) return NOT_ALLOWED;
  await disconnectDrive(agencyId);
  revalidatePath(`/panel/agencias/${agencyId}`);
  return { ok: true, message: "Google Drive desconectado. La carpeta y sus imágenes siguen en ese Drive." };
}

/** "Guardar en Drive" on the post editor: anyone who can see the agency's pictures. */
export async function savePictureToDrive(
  agencyId: string,
  ideaId: string,
  input: { format: string; date: string; title: string | null },
): Promise<DriveActionState> {
  const access = await getAccess();
  if (!access || !agencyRole(access, agencyId)) return { ok: false, message: "No tenés acceso a esta agencia." };

  const result = await ideaPicture(agencyId, ideaId, input);
  if (!result) return { ok: false, message: "No se encontró la idea para esa fecha." };
  const png = Buffer.from(await result.picture.arrayBuffer());
  const name = pictureFileName(result.date, result.idea.title, result.format);

  try {
    const file = await uploadPicture(agencyId, { name, date: result.date, png });
    return { ok: true, message: `Guardada en Drive: ${name}`, link: file.link };
  } catch (err) {
    if (err instanceof DriveFolderMissingError) {
      return { ok: false, message: "La carpeta de la agencia ya no está en Drive (¿se borró?). Reconectá Google Drive desde la agencia." };
    }
    revalidatePath(`/panel/agencias/${agencyId}`);
    return { ok: false, message: driveErrorMessage(err) };
  }
}
