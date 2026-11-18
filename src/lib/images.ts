// Pictures uploaded by admins (official games, later products): made small for the web before
// they are stored. Whatever comes in (a 4 MB phone photo, a PNG) leaves as a WebP of at most
// 512×512 px, upright, without metadata.
import sharp from "sharp";

export class ImageError extends Error {}

const MAX_SIDE = 512;
const ACCEPTED = new Set([
  "jpeg",
  "png",
  "webp",
  "gif",
  "avif",
  "heif",
  "tiff",
]);

export async function webImage(input: Uint8Array) {
  let format: string | undefined;
  try {
    format = (await sharp(input).metadata()).format;
  } catch {
    throw new ImageError("El archivo no es una imagen.");
  }
  if (!format || !ACCEPTED.has(format))
    throw new ImageError("Formato no soportado: subí una JPG, PNG o WebP.");
  const body = await sharp(input)
    .rotate() // apply the EXIF orientation of phone photos
    .resize(MAX_SIDE, MAX_SIDE, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 80, effort: 5 })
    .toBuffer();
  return new Uint8Array(body);
}
