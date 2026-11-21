// Groups of agencies (spec: agency-groups): owners, titular access, moving agencies, onboarding.
// Every write that changes who controls a group is logged in AgencyGroupEvent.
import type { AgencyGroupEventKind, Prisma } from "@/generated/prisma/client";
import { slug } from "@/lib/names";
import { PhoneError, normalizeCellphone } from "@/lib/phone";
import { prisma } from "@/lib/prisma";
import { ensureGeneral } from "@/lib/schedule";
import { StaffValidationError, optionalCuil } from "@/lib/staff";

export class GroupValidationError extends Error {}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
type Tx = Prisma.TransactionClient;

function email(raw: string | null | undefined, required = true) {
  const e = (raw ?? "").trim().toLowerCase();
  if (!e) {
    if (required) throw new GroupValidationError("Escribí el email de Google.");
    return null;
  }
  if (!EMAIL.test(e)) throw new GroupValidationError("Ese email no es válido.");
  return e;
}

const log = (db: Tx, groupId: string, kind: AgencyGroupEventKind, actorId: string | null, detail: string) =>
  db.agencyGroupEvent.create({ data: { groupId, kind, actorId, detail } });

const sameName = (a: string, b: string) =>
  a.trim().toLocaleLowerCase("es-AR") === b.trim().toLocaleLowerCase("es-AR");

export async function uniqueGroupSlug(name: string, db: Tx = prisma) {
  const base = slug(name) || "grupo";
  let s = base;
  for (let i = 2; await db.agencyGroup.findUnique({ where: { slug: s } }); i++) s = `${base}-${i}`;
  return s;
}

// ─── Reading ───────────────────────────────────────────────────

/** A group with its owners, agencies and last events. */
export function groupDetail(groupId: string) {
  return prisma.agencyGroup.findUnique({
    where: { id: groupId },
    include: {
      owners: { include: { user: { select: { name: true } } }, orderBy: { createdAt: "asc" } },
      agencies: {
        select: { id: true, name: true, licenseNumber: true, active: true, titularFirstName: true, titularLastName: true, province: { select: { code: true } } },
        orderBy: { name: "asc" },
      },
      events: { include: { actor: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 20 },
    },
  });
}

// ─── Owners ────────────────────────────────────────────────────

async function addOwnerTx(db: Tx, groupId: string, rawEmail: string, actorId: string | null, why = "") {
  const e = email(rawEmail)!;
  const existing = await db.agencyGroupOwner.findUnique({ where: { groupId_email: { groupId, email: e } } });
  if (existing) return { email: e, added: false, linked: Boolean(existing.userId) };
  const user = await db.user.findUnique({ where: { email: e }, select: { id: true } });
  await db.agencyGroupOwner.create({ data: { groupId, email: e, userId: user?.id ?? null } });
  await log(db, groupId, "OWNER_ADDED", actorId, `agregó a ${e} como dueño${why}`);
  return { email: e, added: true, linked: Boolean(user) };
}

/** Add an owner by Google email. They get access when that email signs in (or now, if it already has). */
export async function addOwner(groupId: string, rawEmail: string, actorId: string | null) {
  const r = await prisma.$transaction((tx) => addOwnerTx(tx, groupId, rawEmail, actorId));
  if (!r.added) throw new GroupValidationError(`${r.email} ya es dueño del grupo.`);
  return r;
}

/** Remove an owner. The last one cannot be removed. */
export async function removeOwner(groupId: string, ownerId: string, actorId: string | null) {
  return prisma.$transaction(async (tx) => {
    const owner = await tx.agencyGroupOwner.findFirst({ where: { id: ownerId, groupId } });
    if (!owner) throw new GroupValidationError("Esa persona ya no es dueña del grupo.");
    if ((await tx.agencyGroupOwner.count({ where: { groupId } })) <= 1)
      throw new GroupValidationError("El grupo tiene que tener al menos un dueño.");
    await tx.agencyGroupOwner.delete({ where: { id: owner.id } });
    await log(tx, groupId, "OWNER_REMOVED", actorId, `sacó a ${owner.email} de los dueños`);
    return owner.email;
  });
}

// ─── Titular ───────────────────────────────────────────────────

export type TitularAccess = "OWNER" | "ADMIN" | "NONE";

export type TitularInput = {
  firstName: string;
  lastName: string;
  cuil?: string | null;
  email?: string | null;
  access?: TitularAccess | null; // required when the email is not a group owner yet
};

/** Is this email already an owner of the agency's group? (The form hides the access question.) */
export async function isGroupOwnerEmail(groupId: string | null, rawEmail: string | null | undefined) {
  const e = (rawEmail ?? "").trim().toLowerCase();
  if (!groupId || !e) return false;
  return Boolean(await prisma.agencyGroupOwner.findUnique({ where: { groupId_email: { groupId, email: e } } }));
}

/** Save the agency's titular. With an email that is not an owner, the access choice is required. */
export async function setTitular(agencyId: string, input: TitularInput, actorId: string | null) {
  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  if (!firstName || !lastName) throw new GroupValidationError("Escribí nombre y apellido del titular.");
  let cuil: string | null;
  try {
    cuil = optionalCuil(input.cuil);
  } catch (err) {
    if (err instanceof StaffValidationError) throw new GroupValidationError(err.message);
    throw err;
  }
  const e = email(input.email, false);

  return prisma.$transaction(async (tx) => {
    const agency = await tx.agency.findUniqueOrThrow({ where: { id: agencyId }, select: { id: true, name: true, groupId: true } });
    await tx.agency.update({
      where: { id: agencyId },
      data: { titularFirstName: firstName, titularLastName: lastName, titularCuil: cuil, titularEmail: e },
    });
    if (!e || !agency.groupId) return "Titular guardado.";

    const isOwner = await tx.agencyGroupOwner.findUnique({ where: { groupId_email: { groupId: agency.groupId, email: e } } });
    if (isOwner) return "Titular guardado. Ya es dueño del grupo.";

    switch (input.access) {
      case "OWNER": {
        const r = await addOwnerTx(tx, agency.groupId, e, actorId, ` (titular de ${agency.name})`);
        return r.linked ? `Titular guardado. ${e} ya es dueño del grupo.` : `Titular guardado. ${e} va a ser dueño cuando ingrese con Google.`;
      }
      case "ADMIN": {
        const user = await tx.user.findUnique({ where: { email: e }, select: { id: true } });
        const existing = await tx.agencyEmployee.findFirst({ where: { agencyId, email: e } });
        if (existing)
          await tx.agencyEmployee.update({ where: { id: existing.id }, data: { role: "ADMIN", active: true, leftAt: null, userId: user?.id ?? existing.userId } });
        else
          await tx.agencyEmployee.create({
            data: { agencyId, role: "ADMIN", firstName, lastName, cuil, email: e, userId: user?.id ?? null, jobTitle: "Titular" },
          });
        return `Titular guardado. ${e} es administrador de ${agency.name}.`;
      }
      case "NONE":
        return "Titular guardado, sin acceso al panel.";
      default:
        throw new GroupValidationError("Elegí qué acceso le das al titular.");
    }
  });
}

// ─── Moving an agency ──────────────────────────────────────────

/** Move an agency to another group (by the email of one of its owners). Its history moves with it.
 *  It inherits the new group's general schedule unless it has personalized hours; the old group's
 *  own products stop being offered there. */
export async function moveAgency(agencyId: string, input: { confirmName: string; targetOwnerEmail: string }, actorId: string | null) {
  const target = email(input.targetOwnerEmail)!;
  const agency = await prisma.agency.findUniqueOrThrow({ where: { id: agencyId }, select: { id: true, name: true, groupId: true, customHours: true } });
  if (!sameName(input.confirmName, agency.name))
    throw new GroupValidationError(`Para confirmar escribí el nombre de la agencia: ${agency.name}.`);
  const owner = await prisma.agencyGroupOwner.findFirst({ where: { email: target }, include: { group: true } });
  if (!owner) throw new GroupValidationError(`${target} no es dueño de ningún grupo. Pedí que lo den de alta primero.`);
  if (owner.groupId === agency.groupId) throw new GroupValidationError("La agencia ya es de ese grupo.");

  const general = await ensureGeneral(owner.groupId);
  await prisma.$transaction(async (tx) => {
    if (agency.groupId) {
      await tx.ownerProductAgency.deleteMany({ where: { agencyId, product: { groupId: agency.groupId } } });
      await log(tx, agency.groupId, "AGENCY_MOVED_OUT", actorId, `pasó ${agency.name} al grupo ${owner.group.name}`);
    }
    await tx.agency.update({ where: { id: agencyId }, data: { groupId: owner.groupId, scheduleTemplateId: general.id } });
    await log(tx, owner.groupId, "AGENCY_MOVED_IN", actorId, `recibió ${agency.name}`);
  });
  return owner.group.name;
}

// ─── Platform onboarding ───────────────────────────────────────

/** Platform admin: a new group with its first owner. */
export async function createGroup(input: { name: string; ownerEmail: string }, actorId: string | null) {
  const name = input.name.trim();
  if (name.length < 2) throw new GroupValidationError("Poné un nombre al grupo.");
  const e = email(input.ownerEmail)!;
  return prisma.$transaction(async (tx) => {
    const group = await tx.agencyGroup.create({ data: { name, slug: await uniqueGroupSlug(name, tx) } });
    await addOwnerTx(tx, group.id, e, actorId);
    return group;
  });
}

export type NewAgencyInput = {
  name: string;
  provinceId: string;
  licenseNumber: string;
  city?: string | null;
  cellphone?: string | null;
  titularFirstName?: string | null;
  titularLastName?: string | null;
};

/** Platform admin: a new agency in a group, with the games its province offers and the group's hours. */
export async function addAgencyToGroup(groupId: string, input: NewAgencyInput) {
  const name = input.name.trim();
  if (name.length < 2) throw new GroupValidationError("Poné el nombre de la agencia.");
  const licenseNumber = input.licenseNumber.trim() || "pendiente";
  let cellphoneNumber: string | null = null;
  if (input.cellphone?.trim()) {
    try {
      cellphoneNumber = normalizeCellphone(input.cellphone);
    } catch (err) {
      if (err instanceof PhoneError) throw new GroupValidationError(err.message);
      throw err;
    }
  }
  const taken = await prisma.agency.findUnique({ where: { provinceId_licenseNumber: { provinceId: input.provinceId, licenseNumber } } });
  if (taken) throw new GroupValidationError(`Ya existe una agencia con ese legajo en la provincia: ${taken.name}.`);

  const base = slug(name) || "agencia";
  let agencySlug = base;
  for (let i = 2; await prisma.agency.findUnique({ where: { slug: agencySlug } }); i++) agencySlug = `${base}-${i}`;

  const general = await ensureGeneral(groupId);
  const games = await prisma.provinceGameAvailability.findMany({ where: { provinceId: input.provinceId, enabled: true }, select: { gameId: true } });
  return prisma.agency.create({
    data: {
      slug: agencySlug,
      name,
      provinceId: input.provinceId,
      licenseNumber,
      city: input.city?.trim() || null,
      cellphoneNumber,
      groupId,
      scheduleTemplateId: general.id,
      titularFirstName: input.titularFirstName?.trim() || null,
      titularLastName: input.titularLastName?.trim() || null,
      games: { create: games.map((g) => ({ gameId: g.gameId })) },
    },
  });
}
