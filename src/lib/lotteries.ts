// Official lotteries (country → province/jurisdiction → organism): validation and logos.
// Used by Plataforma → Loterías and by `npm run lotteries:logos`.
import sharp from "sharp";
import { prisma } from "@/lib/prisma";
import { deleteFile, keys, putFile } from "@/lib/storage";

export class LotteryError extends Error {}

const CODE = /^[A-Z][A-Z0-9_]{1,29}$/;
const COLOR = /^#[0-9a-f]{6}$/i;

export type LotteryInput = {
  code: string;
  name: string;
  fullName: string | null;
  countryId: string;
  provinceId: string | null;
  website: string | null;
  brandPrimaryColor: string | null;
  brandSecondaryColor: string | null;
  quinielaDraws: boolean;
  active: boolean;
};

const text = (form: FormData, name: string) => String(form.get(name) ?? "").trim();

export async function parseLotteryForm(form: FormData, lotteryId: string | null): Promise<LotteryInput> {
  const code = text(form, "code").toUpperCase();
  const name = text(form, "name");
  const countryId = text(form, "countryId");
  const provinceId = text(form, "provinceId") || null;
  let website = text(form, "website") || null;
  const primary = text(form, "primary") || null;
  const secondary = text(form, "secondary") || null;

  if (!CODE.test(code)) throw new LotteryError("El código va en mayúsculas, sin espacios (por ejemplo SANTA_FE).");
  if (!name) throw new LotteryError("Poné el nombre corto (como figura en la Quiniela).");
  if (![primary, secondary].every((c) => !c || COLOR.test(c))) throw new LotteryError("Los colores van como #RRGGBB.");
  if (website && !/^https?:\/\//i.test(website)) website = `https://${website}`;
  if (website) {
    try {
      new URL(website);
    } catch {
      throw new LotteryError("La web no es una dirección válida.");
    }
  }

  const country = await prisma.country.findUnique({ where: { id: countryId } });
  if (!country) throw new LotteryError("Elegí el país.");
  if (provinceId) {
    const province = await prisma.province.findUnique({
      where: { id: provinceId },
      include: { ownLottery: { select: { id: true, name: true } } },
    });
    if (!province || province.countryId !== countryId) throw new LotteryError("La jurisdicción no es de ese país.");
    if (province.ownLottery && province.ownLottery.id !== lotteryId)
      throw new LotteryError(`${province.name} ya tiene su lotería oficial: ${province.ownLottery.name}.`);
  }
  const sameCode = await prisma.lottery.findUnique({ where: { code } });
  if (sameCode && sameCode.id !== lotteryId) throw new LotteryError(`Ya existe una lotería con el código ${code}.`);

  return {
    code,
    name,
    fullName: text(form, "fullName") || null,
    countryId,
    provinceId,
    website,
    brandPrimaryColor: primary,
    brandSecondaryColor: secondary,
    quinielaDraws: form.get("quinielaDraws") === "on",
    active: form.get("active") === "on",
  };
}

/** Any image (PNG, JPG, WebP, SVG) → PNG with transparency, at most 800 px, for pictures. */
export async function logoPng(input: Uint8Array) {
  try {
    // Trim the plain margins many published logos carry, then fit.
    const trimmed = await sharp(input, { density: 300 }).trim({ threshold: 20 }).toBuffer();
    const png = await sharp(trimmed)
      .resize(800, 800, { fit: "inside", withoutEnlargement: true })
      .png()
      .toBuffer();
    return new Uint8Array(png);
  } catch {
    throw new LotteryError("El archivo no es una imagen (subí PNG, JPG, WebP o SVG).");
  }
}

/** Store a new logo and drop the previous one. */
export async function replaceLotteryLogo(lottery: { id: string; code: string; logoKey: string | null }, png: Uint8Array) {
  const key = keys.lotteryLogo(lottery.code);
  await putFile("public", key, png, "image/png", { immutable: true });
  await prisma.lottery.update({ where: { id: lottery.id }, data: { logoKey: key } });
  if (lottery.logoKey) await deleteFile("public", lottery.logoKey).catch(() => undefined);
  return key;
}

/** Rows that point to a lottery: while there are any it can only be deactivated. */
export async function lotteryUsage(lotteryId: string) {
  const l = await prisma.lottery.findUnique({
    where: { id: lotteryId },
    select: {
      _count: {
        select: {
          provinces: true,
          orderSlices: true,
          drawRules: true,
          exceptions: true,
          drawNumbers: true,
          resultReadings: true,
          results: true,
        },
      },
    },
  });
  return l ? Object.values(l._count).reduce((a, b) => a + b, 0) : 0;
}
