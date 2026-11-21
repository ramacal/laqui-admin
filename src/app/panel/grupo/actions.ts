"use server";

// Server actions for groups of agencies (spec: agency-groups). Every action re-checks access:
// owners act on their group; the platform admin creates groups and adds agencies.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAccess, ownsGroup } from "@/lib/access";
import {
  GroupValidationError,
  addAgencyToGroup,
  addOwner,
  createGroup,
  moveAgency,
  removeOwner,
  setTitular,
  type TitularAccess,
} from "@/lib/groups";
import { prisma } from "@/lib/prisma";
import type { FormState } from "@/app/panel/horarios/actions";

class Forbidden extends Error {}
const str = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

async function requireOwner(groupId: string) {
  const access = await getAccess();
  if (!access) throw new Forbidden("Tu sesión expiró. Volvé a ingresar.");
  if (!ownsGroup(access, groupId)) throw new Forbidden("Solo los dueños del grupo pueden hacer esto.");
  return access;
}

async function requirePlatformAdmin() {
  const access = await getAccess();
  if (!access?.isPlatformAdmin) throw new Forbidden("Solo el admin de plataforma da de alta grupos y agencias.");
  return access;
}

async function guarded(fn: () => Promise<string>): Promise<FormState> {
  try {
    const message = await fn();
    revalidatePath("/panel", "layout");
    return { ok: true, message };
  } catch (err) {
    if (err instanceof GroupValidationError || err instanceof Forbidden) return { ok: false, message: err.message };
    throw err;
  }
}

// ─── Owners ────────────────────────────────────────────────────

export async function addOwnerAction(groupId: string, _prev: FormState, form: FormData) {
  return guarded(async () => {
    const access = await requireOwner(groupId);
    const r = await addOwner(groupId, str(form, "email"), access.user.id);
    return r.linked ? `${r.email} ya es dueño del grupo.` : `Listo: cuando ${r.email} ingrese con Google va a ver el grupo.`;
  });
}

export async function removeOwnerAction(groupId: string, ownerId: string, _prev: FormState, _form: FormData) {
  return guarded(async () => {
    const access = await requireOwner(groupId);
    const removed = await removeOwner(groupId, ownerId, access.user.id);
    return `${removed} ya no es dueño del grupo.`;
  });
}

// ─── Titular and moving an agency ──────────────────────────────

async function requireAgencyOwner(agencyId: string) {
  const agency = await prisma.agency.findUnique({ where: { id: agencyId }, select: { groupId: true } });
  if (!agency) throw new Forbidden("La agencia no existe.");
  return requireOwner(agency.groupId ?? "");
}

export async function saveTitularAction(agencyId: string, _prev: FormState, form: FormData) {
  return guarded(async () => {
    const access = await requireAgencyOwner(agencyId);
    const choice = str(form, "access");
    return setTitular(
      agencyId,
      {
        firstName: str(form, "firstName"),
        lastName: str(form, "lastName"),
        cuil: str(form, "cuil"),
        email: str(form, "email"),
        access: (["OWNER", "ADMIN", "NONE"].includes(choice) ? choice : null) as TitularAccess | null,
      },
      access.user.id,
    );
  });
}

export async function moveAgencyAction(agencyId: string, _prev: FormState, form: FormData): Promise<FormState> {
  let groupName: string;
  try {
    const access = await requireAgencyOwner(agencyId);
    groupName = await moveAgency(agencyId, { confirmName: str(form, "confirmName"), targetOwnerEmail: str(form, "targetEmail") }, access.user.id);
  } catch (err) {
    if (err instanceof GroupValidationError || err instanceof Forbidden) return { ok: false, message: err.message };
    throw err;
  }
  revalidatePath("/panel", "layout");
  // The agency may no longer be visible to this user.
  const access = await getAccess();
  if (access && !access.isPlatformAdmin && !access.memberships.some((m) => m.agency.id === agencyId)) redirect("/panel");
  return { ok: true, message: `La agencia pasó al grupo ${groupName}.` };
}

// ─── Platform: groups and agencies ─────────────────────────────

export async function createGroupAction(_prev: FormState, form: FormData): Promise<FormState> {
  let groupId: string;
  try {
    const access = await requirePlatformAdmin();
    groupId = (await createGroup({ name: str(form, "name"), ownerEmail: str(form, "ownerEmail") }, access.user.id)).id;
  } catch (err) {
    if (err instanceof GroupValidationError || err instanceof Forbidden) return { ok: false, message: err.message };
    throw err;
  }
  revalidatePath("/panel", "layout");
  redirect(`/panel/grupos/${groupId}`);
}

export async function addAgencyAction(groupId: string, _prev: FormState, form: FormData) {
  return guarded(async () => {
    await requirePlatformAdmin();
    const agency = await addAgencyToGroup(groupId, {
      name: str(form, "name"),
      provinceId: str(form, "provinceId"),
      licenseNumber: str(form, "licenseNumber"),
      city: str(form, "city"),
      cellphone: str(form, "cellphone"),
      titularFirstName: str(form, "titularFirstName"),
      titularLastName: str(form, "titularLastName"),
    });
    return `Agencia ${agency.name} creada. Completá su logo, dirección y personal desde su ficha.`;
  });
}
