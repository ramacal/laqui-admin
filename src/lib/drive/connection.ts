// Connect, disconnect and upload (spec agency-google-drive).
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { withDrive } from "./client";
import { decryptToken, encryptToken } from "./crypto";
import { type DriveSection, ensureAgencyFolder, ensureRootFolder, folderExists, monthFolder } from "./folders";
import {
  DRIVE_SCOPE,
  UPLOAD_API,
  driveFetch,
  exchangeCode,
  forgetAccessToken,
  rememberAccessToken,
  revokeToken,
} from "./google";
import { onStaffChanged } from "./sharing";

export class DriveConnectError extends Error {
  constructor(readonly code: "permiso" | "token") {
    super(code);
  }
}

/** OAuth callback: store the connection, create the folders and share them with the staff. */
export async function connectDrive({ agencyId, userId, code }: { agencyId: string; userId: string; code: string }) {
  const grant = await exchangeCode(code);
  if (!grant.scopes.includes(DRIVE_SCOPE)) throw new DriveConnectError("permiso");
  if (!grant.refreshToken || !grant.accessToken) throw new DriveConnectError("token");
  const token = grant.accessToken;

  const about = await driveFetch<{ user: { emailAddress: string; permissionId: string } }>(token, "/about", {
    query: { fields: "user(emailAddress,permissionId)" },
  });
  const googleEmail = about.user.emailAddress.toLowerCase();
  const googleAccountId = about.user.permissionId;

  const [agency, previous, sameAccount] = await Promise.all([
    prisma.agency.findUniqueOrThrow({ where: { id: agencyId }, select: { slug: true } }),
    prisma.agencyDriveConnection.findUnique({ where: { agencyId } }),
    prisma.agencyDriveConnection.findMany({ where: { googleAccountId }, select: { rootFolderId: true } }),
  ]);
  const reconnecting = previous?.googleAccountId === googleAccountId;

  // One "laqui" folder per Google account, shared by every agency connected with it.
  const rootFolderId = await ensureRootFolder(token, sameAccount.map((c) => c.rootFolderId));
  const folderId = await ensureAgencyFolder(token, rootFolderId, agency.slug, reconnecting ? previous.folderId : null);

  // Switching accounts: the old token is no longer needed.
  if (previous?.refreshTokenEnc && !reconnecting) await dropToken(previous);

  const data = {
    googleEmail,
    googleAccountId,
    refreshTokenEnc: encryptToken(grant.refreshToken, agencyId),
    rootFolderId,
    folderId,
    status: "ACTIVE" as const,
    lastError: null,
    connectedById: userId,
    connectedAt: new Date(),
  };
  const conn = await prisma.agencyDriveConnection.upsert({ where: { agencyId }, create: { agencyId, ...data }, update: data });
  // Share rows describe one folder: start over when the folder is a different one.
  if (previous && previous.folderId !== folderId) await prisma.agencyDriveShare.deleteMany({ where: { connectionId: conn.id } });

  rememberAccessToken(conn.id, token, grant.expiresIn);
  await onStaffChanged(agencyId);
  return { googleEmail, folderId };
}

/** Deletes the token and revokes it unless another agency is connected with the same account. */
async function dropToken(conn: { id: string; agencyId: string; googleAccountId: string; refreshTokenEnc: string | null }) {
  forgetAccessToken(conn.id);
  if (!conn.refreshTokenEnc) return;
  const othersActive = await prisma.agencyDriveConnection.count({
    where: { googleAccountId: conn.googleAccountId, status: "ACTIVE", NOT: { id: conn.id } },
  });
  // Revoking any token ends the whole grant of that Google account for Laqui.
  if (othersActive > 0) return;
  try {
    await revokeToken(decryptToken(conn.refreshTokenEnc, conn.agencyId));
  } catch (err) {
    console.warn("Drive token revoke failed:", err);
  }
}

/** The folder and its files stay in the agency's Drive; Laqui keeps the ids for a reconnection. */
export async function disconnectDrive(agencyId: string) {
  const conn = await prisma.agencyDriveConnection.findUnique({ where: { agencyId } });
  if (!conn) return;
  await dropToken(conn);
  await prisma.agencyDriveConnection.update({
    where: { id: conn.id },
    data: { refreshTokenEnc: null, status: "DISCONNECTED", lastError: null },
  });
}

export class DriveFolderMissingError extends Error {}

/** Uploads a social media picture (PNG) to laqui/{agencia}/redes/{yyyy}/{mm-mes}/ and returns its Drive link. */
export async function uploadPicture(agencyId: string, file: { name: string; date: string; png: Buffer }) {
  return uploadFile(agencyId, "social", { name: file.name, date: file.date, mimeType: "image/png", body: file.png });
}

/**
 * Uploads a file to laqui/{agencia}/{redes|reportes}/{yyyy}/{mm-mes}/ (month of `date`, an ISO date)
 * and returns its Drive link. Reports (PDF, spreadsheets) go to the "reports" section.
 */
export async function uploadFile(
  agencyId: string,
  section: DriveSection,
  file: { name: string; date: string; mimeType: string; body: Buffer },
) {
  return withDrive(agencyId, async (token, conn) => {
    if (!(await folderExists(token, conn.folderId))) throw new DriveFolderMissingError();
    const parent = await monthFolder(token, conn.folderId, section, file.date);

    const boundary = `laqui-${randomBytes(12).toString("hex")}`;
    const meta = JSON.stringify({ name: file.name, parents: [parent], mimeType: file.mimeType });
    const body = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: ${file.mimeType}\r\n\r\n`),
      file.body,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);
    const uploaded = await driveFetch<{ id: string; webViewLink: string }>(
      token,
      "/files",
      {
        method: "POST",
        query: { uploadType: "multipart", fields: "id,webViewLink" },
        headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
        body: new Uint8Array(body),
      },
      UPLOAD_API,
    );
    return { id: uploaded.id, link: uploaded.webViewLink };
  });
}
