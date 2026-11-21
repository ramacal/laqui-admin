import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { EmployeeRole } from "@/generated/prisma/enums";

// What the signed-in user can access: platform profile + active agency memberships.
export async function getAccess() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      memberships: {
        where: { active: true, agency: { active: true } },
        include: {
          agency: {
            select: {
              id: true,
              slug: true,
              name: true,
              licenseNumber: true,
              city: true,
              primaryColor: true,
              province: { select: { code: true } },
              assets: { where: { kind: "LOGO_SYMBOL" }, select: { storageKey: true } },
            },
          },
        },
        orderBy: { agency: { name: "asc" } },
      },
    },
  });
  if (!user || !user.active) return null;

  return {
    user,
    isPlatformAdmin: user.platformRole === "PLATFORM_ADMIN",
    memberships: user.memberships,
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
