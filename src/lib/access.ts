import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { EmployeeRole } from "@/generated/prisma/enums";

const agencySelect = {
  id: true,
  slug: true,
  name: true,
  licenseNumber: true,
  city: true,
  primaryColor: true,
  groupId: true,
  province: { select: { code: true } },
  assets: { where: { kind: "LOGO_SYMBOL" as const }, select: { storageKey: true } },
};

// What the signed-in user can access (spec agency-groups):
//   - groups they own: every active agency of the group, as OWNER;
//   - per-agency memberships (Administrador, Empleado) in other agencies.
// Legacy OWNER membership rows are ignored: ownership comes only from the group.
// `memberships` is the merged list, one entry per agency, owned groups first.
export async function getAccess() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      groupOwnerships: {
        include: {
          group: {
            select: {
              id: true,
              slug: true,
              name: true,
              agencies: { where: { active: true }, select: agencySelect, orderBy: { name: "asc" } },
            },
          },
        },
        orderBy: { group: { name: "asc" } },
      },
      memberships: {
        where: { active: true, role: { not: "OWNER" }, agency: { active: true } },
        include: { agency: { select: agencySelect } },
        orderBy: { agency: { name: "asc" } },
      },
    },
  });
  if (!user || !user.active) return null;

  const groups = user.groupOwnerships.map((o) => ({ id: o.group.id, slug: o.group.slug, name: o.group.name }));
  const owned = user.groupOwnerships.flatMap((o) =>
    o.group.agencies.map((agency) => ({ id: agency.id, role: "OWNER" as EmployeeRole, agency })),
  );
  const ownedIds = new Set(owned.map((m) => m.agency.id));
  const staff = user.memberships
    .filter((m) => !ownedIds.has(m.agency.id)) // the higher access wins
    .map((m) => ({ id: m.id, role: m.role, agency: m.agency }));

  return {
    user,
    isPlatformAdmin: user.platformRole === "PLATFORM_ADMIN",
    groups,
    memberships: [...owned, ...staff],
  };
}

export type Access = NonNullable<Awaited<ReturnType<typeof getAccess>>>;

export async function requireAccess() {
  const access = await getAccess();
  if (!access) redirect("/login");
  return access;
}

export const ROLE_LABEL: Record<EmployeeRole, string> = {
  OWNER: "Dueño",
  ADMIN: "Administrador",
  EMPLOYEE: "Empleado",
};

// Spec agency-administration: admins manage everyone except owners; employees manage no one.
export function canManageStaff(actor: EmployeeRole, target: EmployeeRole) {
  if (actor === "OWNER") return true;
  if (actor === "ADMIN") return target !== "OWNER";
  return false;
}

/** Role of the signed-in user in one agency. Platform admins act as owners everywhere. */
export function agencyRole(access: Access, agencyId: string): EmployeeRole | null {
  if (access.isPlatformAdmin) return "OWNER";
  return access.memberships.find((m) => m.agency.id === agencyId)?.role ?? null;
}

/** Does the user own this group? Platform admins act as owners of every group. */
export const ownsGroup = (access: Access, groupId: string | null | undefined) =>
  Boolean(groupId) && (access.isPlatformAdmin || access.groups.some((g) => g.id === groupId));

/** The group whose shared settings a page shows: `requested` if the user may see it, else their first. */
export function currentGroupId(access: Access, requested?: string | null) {
  if (requested && ownsGroup(access, requested)) return requested;
  return access.groups[0]?.id ?? null;
}

/** Staff list is visible to owners and agency admins, not to plain employees. */
export const canViewStaff = (role: EmployeeRole | null) => role === "OWNER" || role === "ADMIN";

// ─── Schedule permissions (spec: agency-schedule) ──────────────

/** Weekly hours and template choice: owners only (platform admin acts as owner). */
export const canEditAgencyHours = (role: EmployeeRole | null) => role === "OWNER";

/** Agency exceptions (closures, special hours): owners and agency admins. */
export const canEditAgencyExceptions = (role: EmployeeRole | null) => role === "OWNER" || role === "ADMIN";

// ─── Agency Google Drive (spec: agency-google-drive) ───────────

/** Connect, disconnect and re-sync the agency's Drive: owners and agency admins. */
export const canManageDrive = (role: EmployeeRole | null) => role === "OWNER" || role === "ADMIN";
