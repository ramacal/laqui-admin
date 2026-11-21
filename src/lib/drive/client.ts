// Runs Drive calls for an agency's connection. When Google rejects the token the connection is
// marked NEEDS_RECONNECT and no more calls are made until someone reconnects.
import { prisma } from "@/lib/prisma";
import { decryptToken } from "./crypto";
import { DriveAuthError, DriveError, accessTokenFor, forgetAccessToken } from "./google";

export class DriveNotConnectedError extends Error {}

export type DriveConnection = NonNullable<Awaited<ReturnType<typeof loadConnection>>>;

const loadConnection = (agencyId: string) => prisma.agencyDriveConnection.findUnique({ where: { agencyId } });

export async function markNeedsReconnect(connectionId: string, reason: string) {
  forgetAccessToken(connectionId);
  await prisma.agencyDriveConnection.update({
    where: { id: connectionId },
    data: { status: "NEEDS_RECONNECT", lastError: reason.slice(0, 500) },
  });
}

export async function withDrive<T>(agencyId: string, fn: (token: string, conn: DriveConnection) => Promise<T>): Promise<T> {
  const conn = await loadConnection(agencyId);
  if (!conn || conn.status !== "ACTIVE" || !conn.refreshTokenEnc) {
    throw new DriveNotConnectedError(conn?.status === "NEEDS_RECONNECT" ? "reconnect" : "not-connected");
  }
  let refreshToken: string;
  try {
    refreshToken = decryptToken(conn.refreshTokenEnc, agencyId);
  } catch {
    await markNeedsReconnect(conn.id, "No se pudo leer el token guardado (¿cambió DRIVE_TOKEN_KEY?)");
    throw new DriveNotConnectedError("reconnect");
  }

  for (let attempt = 0; ; attempt++) {
    try {
      const token = await accessTokenFor(conn.id, refreshToken);
      return await fn(token, conn);
    } catch (err) {
      // A 401 from Drive with a cached access token: refresh once before giving up.
      if (err instanceof DriveAuthError && err.fromDrive && attempt === 0) {
        forgetAccessToken(conn.id);
        continue;
      }
      if (err instanceof DriveAuthError) {
        await markNeedsReconnect(conn.id, err.message);
        throw new DriveNotConnectedError("reconnect");
      }
      throw err;
    }
  }
}

/** Spanish message for the panel. */
export function driveErrorMessage(err: unknown) {
  if (err instanceof DriveNotConnectedError) {
    return err.message === "reconnect"
      ? "Hay que reconectar Google Drive: Google ya no acepta el permiso que diste."
      : "La agencia no tiene Google Drive conectado.";
  }
  if (err instanceof DriveError) {
    if (err.reason === "storageQuotaExceeded") return "El Drive de la agencia no tiene más espacio.";
    return `Google Drive respondió: ${err.message}`;
  }
  console.error("Drive:", err);
  return "No se pudo hablar con Google Drive. Probá de nuevo en un rato.";
}
