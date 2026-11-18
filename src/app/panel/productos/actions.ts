"use server";

// Server actions for base products (platform admin) and owner products (owners).
// Specs: global-game-catalog, owner-products. Every action re-checks permissions.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  agencyRole,
  canEditAgencyHours,
  getAccess,
  type Access,
} from "@/lib/access";
import {
  CatalogValidationError,
  resetProvinceGamePrice,
  setGamePrice,
  setOwnerProductPrice,
  setProvinceGamePrice,
} from "@/lib/catalog";
import { prisma } from "@/lib/prisma";
import { ImageError, webImage } from "@/lib/images";
import { deleteFile, keys, putFile } from "@/lib/storage";
import { agenciesOwnedBy, dateValue, todayIn } from "@/lib/schedule";

export type FormState = { ok: boolean; message: string } | null;
const TZ = "America/Argentina/Buenos_Aires";

class Forbidden extends Error {}

async function requirePlatformAdmin(): Promise<Access> {
  const access = await getAccess();
  if (!access?.isPlatformAdmin)
    throw new Forbidden("Solo el admin de plataforma administra los juegos.");
  return access;
}

async function requireProductOwner(productId: string) {
  const access = await getAccess();
  if (!access) throw new Forbidden("Tu sesión expiró. Volvé a ingresar.");
  const product = await prisma.ownerProduct.findUnique({
    where: { id: productId },
  });
  if (
    !product ||
    (!access.isPlatformAdmin && product.ownerUserId !== access.user.id)
  )
    throw new Forbidden("No podés modificar este producto.");
  return { access, product };
}

async function guarded(fn: () => Promise<string>): Promise<FormState> {
  try {
    const message = await fn();
    revalidatePath("/panel", "layout");
    return { ok: true, message };
  } catch (err) {
    if (err instanceof CatalogValidationError || err instanceof Forbidden)
      return { ok: false, message: err.message };
    throw err;
  }
}

const str = (form: FormData, key: string) => String(form.get(key) ?? "").trim();
const optDate = (form: FormData, key: string) => {
  const v = str(form, key);
  if (!v) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v))
    throw new CatalogValidationError("Fecha inválida.");
  return dateValue(v);
};

// ─── Base products (platform admin) ────────────────────────────

export async function setGameActive(gameId: string, active: boolean) {
  await requirePlatformAdmin();
  await prisma.gameDefinition.update({
    where: { id: gameId },
    data: { active },
  });
  revalidatePath("/panel", "layout");
}

export async function setProvinceGameEnabled(
  provinceId: string,
  gameId: string,
  enabled: boolean,
) {
  await requirePlatformAdmin();
  await prisma.provinceGameAvailability.upsert({
    where: { provinceId_gameId: { provinceId, gameId } },
    create: { provinceId, gameId, enabled },
    update: { enabled },
  });
  revalidatePath("/panel", "layout");
}

/** Picture of an official game: compressed to a small WebP; replaces (and deletes) the old one. */
export async function setGameImage(
  gameId: string,
  _prev: FormState,
  form: FormData,
) {
  return guarded(async () => {
    await requirePlatformAdmin();
    const file = form.get("image");
    if (!(file instanceof File) || file.size === 0)
      throw new CatalogValidationError("Elegí una imagen.");
    if (file.size > 8 * 1024 * 1024)
      throw new CatalogValidationError("La imagen pesa más de 8 MB.");
    const game = await prisma.gameDefinition.findUniqueOrThrow({
      where: { id: gameId },
    });
    let body: Uint8Array;
    try {
      body = await webImage(new Uint8Array(await file.arrayBuffer()));
    } catch (err) {
      if (err instanceof ImageError)
        throw new CatalogValidationError(err.message);
      throw err;
    }
    const key = keys.gameImage(game.code, Date.now());
    await putFile("public", key, body, "image/webp");
    await prisma.gameDefinition.update({
      where: { id: gameId },
      data: { imageKey: key },
    });
    if (game.imageKey)
      await deleteFile("public", game.imageKey).catch(() => undefined);
    return `Imagen guardada (${Math.max(1, Math.round(body.byteLength / 1024))} KB).`;
  });
}

export async function removeGameImage(gameId: string) {
  await requirePlatformAdmin();
  const game = await prisma.gameDefinition.findUniqueOrThrow({
    where: { id: gameId },
  });
  await prisma.gameDefinition.update({
    where: { id: gameId },
    data: { imageKey: null },
  });
  if (game.imageKey)
    await deleteFile("public", game.imageKey).catch(() => undefined);
  revalidatePath("/panel", "layout");
}

/** Offer a game in one more province (picked in the form). */
export async function addGameProvince(
  gameId: string,
  _prev: FormState,
  form: FormData,
) {
  return guarded(async () => {
    await requirePlatformAdmin();
    const province = await prisma.province.findUnique({
      where: { id: str(form, "provinceId") },
    });
    if (!province) throw new CatalogValidationError("Elegí una provincia.");
    await prisma.provinceGameAvailability.upsert({
      where: { provinceId_gameId: { provinceId: province.id, gameId } },
      create: { provinceId: province.id, gameId, enabled: true },
      update: { enabled: true },
    });
    return `Ahora se ofrece en ${province.name}, con el precio oficial.`;
  });
}

/** National price of a game (applies to every province without a price of its own). */
export async function addGamePrice(
  gameId: string,
  _prev: FormState,
  form: FormData,
) {
  return guarded(async () => {
    await requirePlatformAdmin();
    const validFrom = str(form, "validFrom");
    await setGamePrice(
      gameId,
      str(form, "amount"),
      validFrom,
      str(form, "note") || undefined,
    );
    return validFrom > todayIn(TZ)
      ? `Aumento del precio oficial programado desde ${validFrom}.`
      : "Precio oficial guardado.";
  });
}

export async function deleteGamePrice(priceId: string) {
  await requirePlatformAdmin();
  await prisma.gamePrice.deleteMany({
    where: { id: priceId, validFrom: { gt: dateValue(todayIn(TZ)) } },
  });
  revalidatePath("/panel", "layout");
}

/** Own price for one province (it stops following the national price). Province picked in the form. */
export async function addProvincePrice(
  gameId: string,
  _prev: FormState,
  form: FormData,
) {
  return guarded(async () => {
    await requirePlatformAdmin();
    const provinceId = str(form, "provinceId");
    const province = await prisma.province.findUnique({
      where: { id: provinceId },
    });
    if (!province) throw new CatalogValidationError("Elegí una provincia.");
    const validFrom = str(form, "validFrom");
    await setProvinceGamePrice(
      provinceId,
      gameId,
      str(form, "amount"),
      validFrom,
      str(form, "note") || undefined,
      todayIn(TZ),
    );
    return validFrom > todayIn(TZ)
      ? `${province.name}: precio propio programado desde ${validFrom}.`
      : `${province.name} ahora tiene precio propio.`;
  });
}

export async function resetProvincePrice(provinceId: string, gameId: string) {
  await requirePlatformAdmin();
  await resetProvinceGamePrice(provinceId, gameId);
  revalidatePath("/panel", "layout");
}

/** Only scheduled (future) prices can be deleted: past prices are history. */
export async function deleteProvincePrice(priceId: string) {
  await requirePlatformAdmin();
  await prisma.provinceGamePrice.deleteMany({
    where: { id: priceId, validFrom: { gt: dateValue(todayIn(TZ)) } },
  });
  revalidatePath("/panel", "layout");
}

// ─── Owner products ────────────────────────────────────────────

export async function createOwnerProduct(
  _prev: FormState,
  form: FormData,
): Promise<FormState> {
  const access = await getAccess();
  if (!access)
    return { ok: false, message: "Tu sesión expiró. Volvé a ingresar." };
  const owned = await agenciesOwnedBy(access.user.id);
  if (owned.length === 0)
    return {
      ok: false,
      message: "Solo los dueños de agencias cargan productos.",
    };

  let productId: string;
  try {
    const name = str(form, "name");
    if (name.length < 2)
      throw new CatalogValidationError("Poné un nombre al producto.");
    const allowed = new Set(owned.map((a) => a.id));
    const agencyIds = form
      .getAll("agencyId")
      .map(String)
      .filter((id) => allowed.has(id));
    if (agencyIds.length === 0)
      throw new CatalogValidationError(
        "Elegí al menos una agencia donde se ofrece.",
      );
    const availableFrom = optDate(form, "availableFrom");
    const availableUntil = optDate(form, "availableUntil");
    if (availableFrom && availableUntil && availableUntil < availableFrom)
      throw new CatalogValidationError(
        "La fecha «hasta» es anterior a «desde».",
      );

    const product = await prisma.ownerProduct.create({
      data: {
        ownerUserId: access.user.id,
        name,
        description: str(form, "description") || null,
        saleMode: str(form, "saleMode") === "MACHINE" ? "MACHINE" : "PHYSICAL",
        availableFrom,
        availableUntil,
        agencies: { create: agencyIds.map((agencyId) => ({ agencyId })) },
      },
    });
    try {
      await setOwnerProductPrice(
        product.id,
        str(form, "amount"),
        str(form, "validFrom") || todayIn(TZ),
      );
    } catch (err) {
      await prisma.ownerProduct.delete({ where: { id: product.id } }); // no product without a valid price
      throw err;
    }
    productId = product.id;
  } catch (err) {
    if (err instanceof CatalogValidationError)
      return { ok: false, message: err.message };
    throw err;
  }
  revalidatePath("/panel", "layout");
  redirect(`/panel/productos/${productId}`);
}

export async function updateOwnerProduct(
  productId: string,
  _prev: FormState,
  form: FormData,
) {
  return guarded(async () => {
    await requireProductOwner(productId);
    const name = str(form, "name");
    if (name.length < 2)
      throw new CatalogValidationError("Poné un nombre al producto.");
    const availableFrom = optDate(form, "availableFrom");
    const availableUntil = optDate(form, "availableUntil");
    if (availableFrom && availableUntil && availableUntil < availableFrom)
      throw new CatalogValidationError(
        "La fecha «hasta» es anterior a «desde».",
      );
    await prisma.ownerProduct.update({
      where: { id: productId },
      data: {
        name,
        description: str(form, "description") || null,
        saleMode: str(form, "saleMode") === "MACHINE" ? "MACHINE" : "PHYSICAL",
        availableFrom,
        availableUntil,
      },
    });
    return "Producto guardado.";
  });
}

export async function setOwnerProductActive(
  productId: string,
  active: boolean,
) {
  await requireProductOwner(productId);
  await prisma.ownerProduct.update({
    where: { id: productId },
    data: { active },
  });
  revalidatePath("/panel", "layout");
}

export async function setOwnerProductAgencies(
  productId: string,
  _prev: FormState,
  form: FormData,
) {
  return guarded(async () => {
    const { product } = await requireProductOwner(productId);
    const allowed = new Set(
      (await agenciesOwnedBy(product.ownerUserId)).map((a) => a.id),
    );
    const agencyIds = form
      .getAll("agencyId")
      .map(String)
      .filter((id) => allowed.has(id));
    if (agencyIds.length === 0)
      throw new CatalogValidationError(
        "Elegí al menos una agencia, o pausá el producto.",
      );
    await prisma.$transaction([
      prisma.ownerProductAgency.deleteMany({ where: { productId } }),
      prisma.ownerProductAgency.createMany({
        data: agencyIds.map((agencyId) => ({ productId, agencyId })),
      }),
    ]);
    return `Se ofrece en ${agencyIds.length} agencia(s).`;
  });
}

export async function addOwnerProductPrice(
  productId: string,
  _prev: FormState,
  form: FormData,
) {
  return guarded(async () => {
    await requireProductOwner(productId);
    const validFrom = str(form, "validFrom");
    await setOwnerProductPrice(
      productId,
      str(form, "amount"),
      validFrom,
      str(form, "note") || undefined,
    );
    return validFrom > todayIn(TZ)
      ? `Cambio de precio programado desde ${validFrom}.`
      : "Precio guardado.";
  });
}

export async function deleteOwnerProductPrice(priceId: string) {
  const price = await prisma.ownerProductPrice.findUnique({
    where: { id: priceId },
  });
  if (!price) return;
  await requireProductOwner(price.productId);
  if (price.validFrom > dateValue(todayIn(TZ)))
    await prisma.ownerProductPrice.delete({ where: { id: priceId } });
  revalidatePath("/panel", "layout");
}

// ─── Agency: which base games it shows ─────────────────────────

export async function setAgencyGameVisible(
  agencyId: string,
  gameId: string,
  visible: boolean,
) {
  const access = await getAccess();
  if (!access || !canEditAgencyHours(agencyRole(access, agencyId)))
    throw new Forbidden("Solo el dueño elige los juegos.");
  await prisma.agencyGameAvailability.upsert({
    where: { agencyId_gameId: { agencyId, gameId } },
    create: { agencyId, gameId, visible },
    update: { visible },
  });
  revalidatePath("/panel", "layout");
}

// ─── New official game (platform admin) ────────────────────────

const intIn = (
  form: FormData,
  key: string,
  min: number,
  max: number,
  label: string,
) => {
  const raw = str(form, key);
  const n = Number(raw);
  if (!raw || !Number.isInteger(n) || n < min || n > max)
    throw new CatalogValidationError(
      `${label}: un número entero entre ${min} y ${max}.`,
    );
  return n;
};

export async function createGame(
  _prev: FormState,
  form: FormData,
): Promise<FormState> {
  return guarded(async () => {
    await requirePlatformAdmin();
    const name = str(form, "name");
    if (name.length < 2)
      throw new CatalogValidationError("Poné el nombre del juego.");
    const code = name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "_")
      .replace(/^_|_$/g, "");
    if (await prisma.gameDefinition.findUnique({ where: { code } }))
      throw new CatalogValidationError(
        `Ya existe un juego con ese nombre (${code}).`,
      );

    // Physical products (Telekino, scratch cards) are sold by unit: no numbers or modalities.
    const saleMode =
      str(form, "saleMode") === "PHYSICAL" ? "PHYSICAL" : "MACHINE";
    const kind =
      saleMode === "PHYSICAL"
        ? "UNIT"
        : str(form, "kind") === "QUINIELA"
          ? "QUINIELA"
          : "NUMBER_PICK";
    let rules: Record<string, number | null> = {};
    if (kind === "UNIT") {
      rules = {};
    } else if (kind === "NUMBER_PICK") {
      const minNumber = intIn(form, "minNumber", 0, 99, "Número mínimo");
      const maxNumber = intIn(form, "maxNumber", 1, 999, "Número máximo");
      if (maxNumber <= minNumber)
        throw new CatalogValidationError(
          "El número máximo tiene que ser mayor al mínimo.",
        );
      const pickCount = intIn(form, "pickCount", 1, 20, "Cantidad de números");
      if (pickCount > maxNumber - minNumber + 1)
        throw new CatalogValidationError("No hay tantos números en el rango.");
      const hasExtra = form.get("hasExtra") === "on";
      rules = {
        pickCount,
        minNumber,
        maxNumber,
        extraMin: hasExtra
          ? intIn(form, "extraMin", 0, 99, "Número extra mínimo")
          : null,
        extraMax: hasExtra
          ? intIn(form, "extraMax", 1, 99, "Número extra máximo")
          : null,
      };
      if (hasExtra && rules.extraMax! <= rules.extraMin!)
        throw new CatalogValidationError(
          "El número extra máximo tiene que ser mayor al mínimo.",
        );
    } else {
      rules = { maxDigits: intIn(form, "maxDigits", 1, 6, "Cifras máximas") };
    }

    const modalities = (kind === "UNIT" ? "" : str(form, "modalities"))
      .split(",")
      .map((m) => m.trim())
      .filter(Boolean);
    const provinceIds = form.getAll("provinceId").map(String);
    const amount = str(form, "amount");
    const validFrom = str(form, "validFrom") || todayIn(TZ);

    const game = await prisma.gameDefinition.create({
      data: {
        code,
        name,
        kind,
        saleMode,
        ...rules,
        modalities: {
          create: modalities.map((m, i) => ({
            code: m
              .normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "")
              .toUpperCase()
              .replace(/[^A-Z0-9]+/g, "_"),
            name: m,
            sortOrder: i,
          })),
        },
        provinces: {
          create: provinceIds.map((provinceId) => ({ provinceId })),
        },
      },
    });
    try {
      await setGamePrice(game.id, amount, validFrom, "Precio inicial");
    } catch (err) {
      await prisma.gameDefinition.delete({ where: { id: game.id } }); // no game without a valid price
      throw err;
    }
    // Straight to the new game's page (redirect is thrown, so guarded() lets it through).
    revalidatePath("/panel", "layout");
    redirect(`/panel/juegos/${game.id}`);
  });
}
