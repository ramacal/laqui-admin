// Folders in the agency's Drive, by purpose and then by month. Names follow the shared rule
// (src/lib/names.ts: lowercase, no accents, "-"):
//   laqui / {agencia} / redes    / {yyyy} / {mm-mes}   pictures (and later reels) for social media
//   laqui / {agencia} / reportes / {yyyy} / {mm-mes}   cash closings, settlements, fiados…
// e.g. laqui/la-brujita/redes/2026/11-noviembre. {agencia} is Agency.slug.
// With drive.file every search only sees folders Laqui created, never the agency's own files.
import { monthName, slug } from "@/lib/names";
import { DriveError, driveFetch } from "./google";

const FOLDER = "application/vnd.google-apps.folder";
export const ROOT_FOLDER_NAME = "laqui";

const quote = (s: string) => `'${s.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;

/** True when the folder exists, is ours to see and is not in the trash. */
export async function folderExists(token: string, id: string) {
  try {
    const f = await driveFetch<{ trashed?: boolean; mimeType?: string }>(token, `/files/${encodeURIComponent(id)}`, {
      query: { fields: "id,trashed,mimeType" },
    });
    return !f.trashed && f.mimeType === FOLDER;
  } catch (err) {
    if (err instanceof DriveError && err.status === 404) return false;
    throw err;
  }
}

async function findFolder(token: string, name: string, parent: string) {
  const res = await driveFetch<{ files: { id: string }[] }>(token, "/files", {
    query: {
      q: `name = ${quote(name)} and mimeType = '${FOLDER}' and ${quote(parent)} in parents and trashed = false`,
      fields: "files(id)",
      spaces: "drive",
      orderBy: "createdTime",
      pageSize: "1",
    },
  });
  return res.files[0]?.id ?? null;
}

async function createFolder(token: string, name: string, parent: string) {
  const f = await driveFetch<{ id: string }>(token, "/files", {
    method: "POST",
    query: { fields: "id" },
    json: { name, mimeType: FOLDER, parents: [parent] },
  });
  return f.id;
}

export async function findOrCreateFolder(token: string, name: string, parent: string) {
  return (await findFolder(token, name, parent)) ?? createFolder(token, name, parent);
}

/** "laqui" at the root: a known id first (other agencies on the same account), then a search. */
export async function ensureRootFolder(token: string, knownIds: string[]) {
  for (const id of new Set(knownIds)) if (await folderExists(token, id)) return id;
  return findOrCreateFolder(token, ROOT_FOLDER_NAME, "root");
}

/** "laqui/{agencia}" (agency slug): the previous folder when the same account reconnects, else by name. */
export async function ensureAgencyFolder(token: string, rootId: string, agencySlug: string, previousId?: string | null) {
  if (previousId && (await folderExists(token, previousId))) return previousId;
  return findOrCreateFolder(token, slug(agencySlug) || "agencia", rootId);
}

export const DRIVE_SECTIONS = { social: "redes", reports: "reportes" } as const;
export type DriveSection = keyof typeof DRIVE_SECTIONS;

/** "{seccion}/{yyyy}/{mm-mes}" inside the agency folder for an ISO date, e.g. redes/2026/11-noviembre. */
export async function monthFolder(token: string, agencyFolderId: string, section: DriveSection, isoDate: string) {
  const [year, month] = isoDate.split("-");
  const sectionId = await findOrCreateFolder(token, DRIVE_SECTIONS[section], agencyFolderId);
  const yearId = await findOrCreateFolder(token, year, sectionId);
  return findOrCreateFolder(token, monthName(Number(month)), yearId);
}
