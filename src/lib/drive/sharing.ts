// Keeps laqui/{agencia} shared with the agency's active staff (spec agency-google-drive "Staff Access").
// Laqui only removes permissions it created (rows in state SHARED, with their permission id).
// An email that already had access when Laqui tried is recorded as MANUAL and never touched.
import { prisma } from "@/lib/prisma";
import { withDrive } from "./client";
import { DRIVE_SHARE_ROLE, DriveError, driveFetch } from "./google";

type Permission = { id: string; emailAddress?: string; role: string; type: string };

async function listPermissions(token: string, fileId: string) {
  const all: Permission[] = [];
  let pageToken: string | undefined;
  do {
    const page = await driveFetch<{ permissions: Permission[]; nextPageToken?: string }>(
      token,
      `/files/${encodeURIComponent(fileId)}/permissions`,
      { query: { fields: "nextPageToken,permissions(id,emailAddress,role,type)", pageSize: "100", ...(pageToken ? { pageToken } : {}) } },
    );
    all.push(...page.permissions);
    pageToken = page.nextPageToken;
  } while (pageToken);
  return all;
}

export type SyncResult = { added: number; removed: number; failed: number; manual: number };

const running = new Set<string>();

/** Reconciles the folder sharing with the staff. Safe to call any time; no-op when not connected. */
export async function syncDriveAccess(agencyId: string): Promise<SyncResult | null> {
  const conn = await prisma.agencyDriveConnection.findUnique({ where: { agencyId }, select: { status: true } });
  if (conn?.status !== "ACTIVE" || running.has(agencyId)) return null;
  running.add(agencyId);
  try {
    return await withDrive(agencyId, (token, c) => reconcile(token, c.id, c.folderId, c.googleEmail, agencyId));
  } finally {
    running.delete(agencyId);
  }
}

async function reconcile(token: string, connectionId: string, folderId: string, driveEmail: string, agencyId: string) {
  const result: SyncResult = { added: 0, removed: 0, failed: 0, manual: 0 };
  const agency = await prisma.agency.findUniqueOrThrow({ where: { id: agencyId }, select: { name: true } });

  // Desired: active employees with an email, except the Drive's own account.
  const employees = await prisma.agencyEmployee.findMany({
    where: { agencyId, active: true, email: { not: null } },
    select: { id: true, email: true },
    orderBy: { createdAt: "asc" },
  });
  const desired = new Map<string, string>(); // email -> employeeId
  for (const e of employees) {
    const email = e.email!.trim().toLowerCase();
    if (email && email !== driveEmail.toLowerCase() && !desired.has(email)) desired.set(email, e.id);
  }

  const rows = await prisma.agencyDriveShare.findMany({ where: { connectionId } });
  const byEmail = new Map(rows.map((r) => [r.email, r]));
  const permissions = await listPermissions(token, folderId);
  const permissionIds = new Set(permissions.map((p) => p.id));
  const permissionByEmail = new Map(
    permissions.filter((p) => p.type === "user" && p.emailAddress).map((p) => [p.emailAddress!.toLowerCase(), p]),
  );

  // Remove access of people who are no longer active staff (only what Laqui created).
  for (const row of rows) {
    if (desired.has(row.email)) continue;
    if (row.state === "SHARED" && row.permissionId && permissionIds.has(row.permissionId)) {
      try {
        await driveFetch(token, `/files/${encodeURIComponent(folderId)}/permissions/${encodeURIComponent(row.permissionId)}`, {
          method: "DELETE",
        });
      } catch (err) {
        if (!(err instanceof DriveError && err.status === 404)) throw err;
      }
      result.removed++;
    }
    await prisma.agencyDriveShare.delete({ where: { id: row.id } });
  }

  // Give access to active staff.
  for (const [email, employeeId] of desired) {
    const row = byEmail.get(email);
    const existing = permissionByEmail.get(email);
    const ours = row?.state === "SHARED" && row.permissionId && permissionIds.has(row.permissionId);
    if (ours || row?.state === "MANUAL") {
      if (row.employeeId !== employeeId) await prisma.agencyDriveShare.update({ where: { id: row.id }, data: { employeeId } });
      if (row.state === "MANUAL") result.manual++;
      continue;
    }

    const key = { connectionId_email: { connectionId, email } };
    if (existing) {
      // Someone shared it by hand (or a Laqui permission was changed in Drive): not ours to remove.
      const state = row?.state === "SHARED" && row.permissionId === existing.id ? "SHARED" : "MANUAL";
      await prisma.agencyDriveShare.upsert({
        where: key,
        create: { connectionId, email, employeeId, state, permissionId: state === "SHARED" ? existing.id : null, role: existing.role },
        update: { employeeId, state, permissionId: state === "SHARED" ? existing.id : null, role: existing.role, error: null },
      });
      if (state === "MANUAL") result.manual++;
      continue;
    }

    try {
      const p = await driveFetch<{ id: string }>(token, `/files/${encodeURIComponent(folderId)}/permissions`, {
        method: "POST",
        query: {
          fields: "id",
          sendNotificationEmail: "true",
          emailMessage: `Carpeta de imágenes para redes de ${agency.name}, compartida desde Laqui.`,
        },
        json: { type: "user", role: DRIVE_SHARE_ROLE, emailAddress: email },
      });
      await prisma.agencyDriveShare.upsert({
        where: key,
        create: { connectionId, email, employeeId, state: "SHARED", permissionId: p.id, role: DRIVE_SHARE_ROLE },
        update: { employeeId, state: "SHARED", permissionId: p.id, role: DRIVE_SHARE_ROLE, error: null },
      });
      result.added++;
    } catch (err) {
      if (!(err instanceof DriveError)) throw err;
      // Usually: the email has no Google account. The others still get access.
      const error = err.message.slice(0, 500);
      await prisma.agencyDriveShare.upsert({
        where: key,
        create: { connectionId, email, employeeId, state: "FAILED", role: DRIVE_SHARE_ROLE, error },
        update: { employeeId, state: "FAILED", permissionId: null, error },
      });
      result.failed++;
    }
  }

  await prisma.agencyDriveConnection.update({ where: { id: connectionId }, data: { lastSyncedAt: new Date() } });
  return result;
}

/**
 * Call after any staff change (hire, leave, (re)activation, email change). Never throws: a Drive
 * problem must not undo or block the staff change; it shows on the agency page instead.
 */
export async function onStaffChanged(agencyId: string) {
  try {
    await syncDriveAccess(agencyId);
  } catch (err) {
    console.warn(`Drive sync for agency ${agencyId} failed:`, err);
  }
}
