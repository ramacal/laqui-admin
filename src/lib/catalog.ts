// Sales catalog of an agency (specs: global-game-catalog, owner-products).
//
// Base products (official games): offered when the game is active, enabled in the
// agency's province, visible in the agency, and has a price in effect: the national
// price, or the province's own one when it overrides it (customPrice).
// Owner products: offered when active, linked to the agency, inside their sale window,
// and with a unit price in effect.
// Price in effect on a date = the price with the latest validFrom <= that date.
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { dateValue, todayIn } from "@/lib/schedule";

type PriceRow = { amount: Prisma.Decimal; validFrom: Date; note?: string | null };

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Price rows that apply to a game in a province: its own when it overrides, else national. */
export const effectivePriceRows = <T extends PriceRow>(availability: { customPrice: boolean; prices: T[] }, national: T[]) =>
  availability.customPrice ? availability.prices : national;

/** Price in effect on `date` (YYYY-MM-DD) and the next scheduled one, if any. */
export function priceOn(rows: PriceRow[], date: string) {
  const day = dateValue(date).getTime();
  const sorted = [...rows].sort((a, b) => a.validFrom.getTime() - b.validFrom.getTime());
  const current = sorted.filter((r) => r.validFrom.getTime() <= day).at(-1) ?? null;
  const next = sorted.find((r) => r.validFrom.getTime() > day) ?? null;
  return {
    current: current ? { amount: current.amount.toString(), validFrom: iso(current.validFrom) } : null,
    next: next ? { amount: next.amount.toString(), validFrom: iso(next.validFrom) } : null,
  };
}

export async function agencyCatalog(agencyId: string, date?: string) {
  const agency = await prisma.agency.findUniqueOrThrow({
    where: { id: agencyId },
    select: { provinceId: true, timezone: true, games: { select: { gameId: true, visible: true } } },
  });
  const day = date ?? todayIn(agency.timezone);
  const dayValue = dateValue(day);
  const hidden = new Set(agency.games.filter((g) => !g.visible).map((g) => g.gameId));

  const provinceGames = await prisma.provinceGameAvailability.findMany({
    where: { provinceId: agency.provinceId, enabled: true, game: { active: true } },
    include: { game: { include: { prices: true } }, prices: true },
    orderBy: { game: { name: "asc" } },
  });
  const games = provinceGames
    .filter((pg) => !hidden.has(pg.gameId))
    .map((pg) => ({ game: pg.game, ...priceOn(effectivePriceRows(pg, pg.game.prices), day) }))
    .filter((g) => g.current)
    .map((g) => ({
      id: g.game.id,
      code: g.game.code,
      name: g.game.name,
      kind: g.game.kind,
      price: g.current!, // Quiniela: minimum per bet line
      nextPrice: g.next,
    }));

  const ownerProducts = await prisma.ownerProduct.findMany({
    where: {
      active: true,
      agencies: { some: { agencyId } },
      AND: [
        { OR: [{ availableFrom: null }, { availableFrom: { lte: dayValue } }] },
        { OR: [{ availableUntil: null }, { availableUntil: { gte: dayValue } }] },
      ],
    },
    include: { prices: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  const products = ownerProducts
    .map((p) => ({ product: p, ...priceOn(p.prices, day) }))
    .filter((p) => p.current)
    .map((p) => ({
      id: p.product.id,
      name: p.product.name,
      description: p.product.description,
      imageKey: p.product.imageKey,
      unitPrice: p.current!,
      nextPrice: p.next,
      availableUntil: p.product.availableUntil ? iso(p.product.availableUntil) : null,
    }));

  return { date: day, games, products };
}

// ─── Writes ────────────────────────────────────────────────────

export class CatalogValidationError extends Error {}

function parsePrice(amount: string | number, validFrom: string) {
  const value = new Prisma.Decimal(String(amount).replace(",", "."));
  if (value.isNaN() || value.lte(0)) throw new CatalogValidationError("El precio tiene que ser mayor a cero.");
  if (value.decimalPlaces() > 2) throw new CatalogValidationError("El precio admite hasta 2 decimales.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(validFrom)) throw new CatalogValidationError("Fecha de vigencia inválida.");
  return { amount: value, validFrom: dateValue(validFrom) };
}

/** Set (or replace) the national price of a game from a date. Same date = correction. */
export async function setGamePrice(gameId: string, amount: string | number, validFrom: string, note?: string) {
  const data = parsePrice(amount, validFrom);
  return prisma.gamePrice.upsert({
    where: { gameId_validFrom: { gameId, validFrom: data.validFrom } },
    create: { gameId, ...data, note: note ?? null },
    update: { amount: data.amount, note: note ?? null },
  });
}

/**
 * Province's own price from a date (copy on modify). The first time, the national price in
 * effect today is copied as the province's starting price, so the game stays on sale until
 * the new one starts; from then on national changes no longer apply to this province.
 */
export async function setProvinceGamePrice(
  provinceId: string,
  gameId: string,
  amount: string | number,
  validFrom: string,
  note?: string,
  today = todayIn("America/Argentina/Buenos_Aires"),
) {
  const data = parsePrice(amount, validFrom);
  const availability = await prisma.provinceGameAvailability.upsert({
    where: { provinceId_gameId: { provinceId, gameId } },
    create: { provinceId, gameId },
    update: {},
  });
  if (!availability.customPrice) {
    const national = await prisma.gamePrice.findMany({ where: { gameId } });
    const { current } = priceOn(national, today);
    await prisma.$transaction([
      prisma.provinceGamePrice.deleteMany({ where: { provinceId, gameId } }),
      ...(current
        ? [
            prisma.provinceGamePrice.create({
              data: {
                provinceId,
                gameId,
                amount: new Prisma.Decimal(current.amount),
                validFrom: dateValue(current.validFrom),
                note: "Copiado del precio nacional",
              },
            }),
          ]
        : []),
      prisma.provinceGameAvailability.update({
        where: { provinceId_gameId: { provinceId, gameId } },
        data: { customPrice: true },
      }),
    ]);
  }
  return prisma.provinceGamePrice.upsert({
    where: { provinceId_gameId_validFrom: { provinceId, gameId, validFrom: data.validFrom } },
    create: { provinceId, gameId, ...data, note: note ?? null },
    update: { amount: data.amount, note: note ?? null },
  });
}

/** Province back to the national price: its own price history is discarded. */
export async function resetProvinceGamePrice(provinceId: string, gameId: string) {
  await prisma.$transaction([
    prisma.provinceGamePrice.deleteMany({ where: { provinceId, gameId } }),
    prisma.provinceGameAvailability.update({
      where: { provinceId_gameId: { provinceId, gameId } },
      data: { customPrice: false },
    }),
  ]);
}

/** Set (or replace) an owner product's unit price from a date. */
export async function setOwnerProductPrice(productId: string, amount: string | number, validFrom: string, note?: string) {
  const data = parsePrice(amount, validFrom);
  return prisma.ownerProductPrice.upsert({
    where: { productId_validFrom: { productId, validFrom: data.validFrom } },
    create: { productId, ...data, note: note ?? null },
    update: { amount: data.amount, note: note ?? null },
  });
}

/** Line for an order of an owner product: quantity x unit price in effect (snapshot). */
export async function ownerProductLine(productId: string, quantity: number, date: string) {
  if (!Number.isInteger(quantity) || quantity < 1) throw new CatalogValidationError("Cantidad inválida.");
  const product = await prisma.ownerProduct.findUniqueOrThrow({ where: { id: productId }, include: { prices: true } });
  const { current } = priceOn(product.prices, date);
  if (!current) throw new CatalogValidationError(`«${product.name}» no tiene precio vigente.`);
  const unitPrice = new Prisma.Decimal(current.amount);
  return {
    kind: "OWNER_PRODUCT" as const,
    ownerProductId: product.id,
    productName: product.name,
    quantity,
    unitPrice,
    amount: unitPrice.mul(quantity),
  };
}
