"use server";

// Server actions for base products (platform admin) and owner products (owners).
// Specs: global-game-catalog, owner-products. Every action re-checks permissions.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { agencyRole, canEditAgencyHours, getAccess, type Access } from "@/lib/access";
import { CatalogValidationError, setOwnerProductPrice, setProvinceGamePrice } from "@/lib/catalog";
import { prisma } from "@/lib/prisma";
import { agenciesOwnedBy, dateValue, todayIn } from "@/lib/schedule";

export type FormState = { ok: boolean; message: string } | null;
const TZ = "America/Argentina/Buenos_Aires";

class Forbidden extends Error {}

async function requirePlatformAdmin(): Promise<Access> {
  const access = await getAccess();
  if (!access?.isPlatformAdmin) throw new Forbidden("Solo el admin de plataforma administra los juegos.");
  return access;
}

async function requireProductOwner(productId: string) {
  const access = await getAccess();
  if (!access) throw new Forbidden("Tu sesión expiró. Volvé a ingresar.");
  const product = await prisma.ownerProduct.findUnique({ where: { id: productId } });
  if (!product || (!access.isPlatformAdmin && product.ownerUserId !== access.user.id))
    throw new Forbidden("No podés modificar este producto.");
  return { access, product };
}

async function guarded(fn: () => Promise<string>): Promise<FormState> {
  try {
    const message = await fn();
    revalidatePath("/panel", "layout");
    return { ok: true, message };
  } catch (err) {
    if (err instanceof CatalogValidationError || err instanceof Forbidden) return { ok: false, message: err.message };
    throw err;
  }
}

const str = (form: FormData, key: string) => String(form.get(key) ?? "").trim();
const optDate = (form: FormData, key: string) => {
  const v = str(form, key);
  if (!v) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) throw new CatalogValidationError("Fecha inválida.");
  return dateValue(v);
};

// ─── Base products (platform admin) ────────────────────────────

export async function setGameActive(gameId: string, active: boolean) {
  await requirePlatformAdmin();
  await prisma.gameDefinition.update({ where: { id: gameId }, data: { active } });
  revalidatePath("/panel", "layout");
}

export async function setProvinceGameEnabled(provinceId: string, gameId: string, enabled: boolean) {
  await requirePlatformAdmin();
  await prisma.provinceGameAvailability.upsert({
    where: { provinceId_gameId: { provinceId, gameId } },
    create: { provinceId, gameId, enabled },
    update: { enabled },
  });
  revalidatePath("/panel", "layout");
}

export async function addProvincePrice(provinceId: string, gameId: string, _prev: FormState, form: FormData) {
  return guarded(async () => {
    await requirePlatformAdmin();
    await prisma.provinceGameAvailability.upsert({
      where: { provinceId_gameId: { provinceId, gameId } },
      create: { provinceId, gameId },
      update: {},
    });
    const validFrom = str(form, "validFrom");
    await setProvinceGamePrice(provinceId, gameId, str(form, "amount"), validFrom, str(form, "note") || undefined);
    return validFrom > todayIn(TZ) ? `Aumento programado desde ${validFrom}.` : "Precio guardado.";
  });
}

/** Only scheduled (future) prices can be deleted: past prices are history. */
export async function deleteProvincePrice(priceId: string) {
  await requirePlatformAdmin();
  await prisma.provinceGamePrice.deleteMany({ where: { id: priceId, validFrom: { gt: dateValue(todayIn(TZ)) } } });
  revalidatePath("/panel", "layout");
}

// ─── Owner products ────────────────────────────────────────────

export async function createOwnerProduct(_prev: FormState, form: FormData): Promise<FormState> {
  const access = await getAccess();
  if (!access) return { ok: false, message: "Tu sesión expiró. Volvé a ingresar." };
  const owned = await agenciesOwnedBy(access.user.id);
  if (owned.length === 0) return { ok: false, message: "Solo los dueños de agencias cargan productos." };

  let productId: string;
  try {
    const name = str(form, "name");
    if (name.length < 2) throw new CatalogValidationError("Poné un nombre al producto.");
    const allowed = new Set(owned.map((a) => a.id));
    const agencyIds = form.getAll("agencyId").map(String).filter((id) => allowed.has(id));
    if (agencyIds.length === 0) throw new CatalogValidationError("Elegí al menos una agencia donde se ofrece.");
    const availableFrom = optDate(form, "availableFrom");
    const availableUntil = optDate(form, "availableUntil");
    if (availableFrom && availableUntil && availableUntil < availableFrom)
      throw new CatalogValidationError("La fecha «hasta» es anterior a «desde».");

    const product = await prisma.ownerProduct.create({
      data: {
        ownerUserId: access.user.id,
        name,
        description: str(form, "description") || null,
        availableFrom,
        availableUntil,
        agencies: { create: agencyIds.map((agencyId) => ({ agencyId })) },
      },
    });
    try {
      await setOwnerProductPrice(product.id, str(form, "amount"), str(form, "validFrom") || todayIn(TZ));
    } catch (err) {
      await prisma.ownerProduct.delete({ where: { id: product.id } }); // no product without a valid price
      throw err;
    }
    productId = product.id;
  } catch (err) {
    if (err instanceof CatalogValidationError) return { ok: false, message: err.message };
    throw err;
  }
  revalidatePath("/panel", "layout");
  redirect(`/panel/productos/${productId}`);
}

export async function updateOwnerProduct(productId: string, _prev: FormState, form: FormData) {
  return guarded(async () => {
    await requireProductOwner(productId);
    const name = str(form, "name");
    if (name.length < 2) throw new CatalogValidationError("Poné un nombre al producto.");
    const availableFrom = optDate(form, "availableFrom");
    const availableUntil = optDate(form, "availableUntil");
    if (availableFrom && availableUntil && availableUntil < availableFrom)
      throw new CatalogValidationError("La fecha «hasta» es anterior a «desde».");
    await prisma.ownerProduct.update({
      where: { id: productId },
      data: { name, description: str(form, "description") || null, availableFrom, availableUntil },
    });
    return "Producto guardado.";
  });
}

export async function setOwnerProductActive(productId: string, active: boolean) {
  await requireProductOwner(productId);
  await prisma.ownerProduct.update({ where: { id: productId }, data: { active } });
  revalidatePath("/panel", "layout");
}

export async function setOwnerProductAgencies(productId: string, _prev: FormState, form: FormData) {
  return guarded(async () => {
    const { product } = await requireProductOwner(productId);
    const allowed = new Set((await agenciesOwnedBy(product.ownerUserId)).map((a) => a.id));
    const agencyIds = form.getAll("agencyId").map(String).filter((id) => allowed.has(id));
    if (agencyIds.length === 0) throw new CatalogValidationError("Elegí al menos una agencia, o pausá el producto.");
    await prisma.$transaction([
      prisma.ownerProductAgency.deleteMany({ where: { productId } }),
      prisma.ownerProductAgency.createMany({ data: agencyIds.map((agencyId) => ({ productId, agencyId })) }),
    ]);
    return `Se ofrece en ${agencyIds.length} agencia(s).`;
  });
}

export async function addOwnerProductPrice(productId: string, _prev: FormState, form: FormData) {
  return guarded(async () => {
    await requireProductOwner(productId);
    const validFrom = str(form, "validFrom");
    await setOwnerProductPrice(productId, str(form, "amount"), validFrom, str(form, "note") || undefined);
    return validFrom > todayIn(TZ) ? `Cambio de precio programado desde ${validFrom}.` : "Precio guardado.";
  });
}

export async function deleteOwnerProductPrice(priceId: string) {
  const price = await prisma.ownerProductPrice.findUnique({ where: { id: priceId } });
  if (!price) return;
  await requireProductOwner(price.productId);
  if (price.validFrom > dateValue(todayIn(TZ))) await prisma.ownerProductPrice.delete({ where: { id: priceId } });
  revalidatePath("/panel", "layout");
}

// ─── Agency: which base games it shows ─────────────────────────

export async function setAgencyGameVisible(agencyId: string, gameId: string, visible: boolean) {
  const access = await getAccess();
  if (!access || !canEditAgencyHours(agencyRole(access, agencyId))) throw new Forbidden("Solo el dueño elige los juegos.");
  await prisma.agencyGameAvailability.upsert({
    where: { agencyId_gameId: { agencyId, gameId } },
    create: { agencyId, gameId, visible },
    update: { visible },
  });
  revalidatePath("/panel", "layout");
}
