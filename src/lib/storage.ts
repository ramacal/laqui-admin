// File storage on Cloudflare R2 (S3 API). Locally SeaweedFS simulates it: see docker-compose.yml.
// The database only keeps object keys; files never go into MySQL.
//
// Layout (spec: openspec/.../design.md "File Storage"). Public files get a new name on every
// upload ("-{version}"), so caches never serve an old picture.
//
// Agency: one folder per agency, the same path in both buckets.
//   agencias/{provincia}/{legajo}/marca/{simbolo|logo|perfil}-{v}.{ext}                 public
//   agencias/{provincia}/{legajo}/equipo/{employeeId}/foto-{v}.{ext}                   public
//   agencias/{provincia}/{legajo}/pedidos/{yyyy}/{mm}/{orderId}/comprobante-{id}.{ext}  private
//   agencias/{provincia}/{legajo}/pedidos/{yyyy}/{mm}/{orderId}/boleta-{id}.{ext}       private
//   agencias/{provincia}/{legajo}/finanzas/liquidaciones/{yyyy}/{mm}/{fecha}-{id}.{ext} private
//   agencias/{provincia}/{legajo}/finanzas/movimientos/{yyyy}/{mm}/{id}.{ext}           private
// Owner (shared by the owner's agencies):
//   duenos/{ownerUserId}/productos/{productId}/imagen-{v}.webp                         public
// Platform:
//   juegos/{juego}/imagen-{v}.webp, loterias/{loteria}/logo-{v}.png,
//   quiniela/significados/{nn}-{v}.{ext}                                               public
//   provincias/{provincia}/quiniela/programas/{yyyy}-{mm}-v{n}.pdf                     private
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { slug } from "./names";

const env = (name: string, fallback?: string) => {
  const value = process.env[name] ?? fallback;
  if (value === undefined) throw new Error(`Missing env var ${name}`);
  return value;
};

export const buckets = {
  public: env("STORAGE_PUBLIC_BUCKET", "laqui-public"),
  private: env("STORAGE_PRIVATE_BUCKET", "laqui-private"),
} as const;
export type BucketName = keyof typeof buckets;

const globalForStorage = globalThis as unknown as { s3?: S3Client };

export const s3 =
  globalForStorage.s3 ??
  new S3Client({
    endpoint: process.env.STORAGE_ENDPOINT, // unset = real AWS S3
    region: env("STORAGE_REGION", "auto"), // R2's documented value; it ignores the region
    forcePathStyle: true, // bucket in the path: R2 and SeaweedFS both accept it
    credentials: {
      accessKeyId: env("STORAGE_ACCESS_KEY"),
      secretAccessKey: env("STORAGE_SECRET_KEY"),
    },
  });
if (process.env.NODE_ENV !== "production") globalForStorage.s3 = s3;

// ─── Keys ──────────────────────────────────────────────────────

type AgencyRef = {
  id: string;
  licenseNumber: string;
  province: { code: string };
};

// Every key segment follows the shared naming rule (src/lib/names.ts); ids (cuid) already do.
const slugPart = (s: string) => slug(s);
const extPart = (ext: string) => slug(ext) || "bin";

/** agencias/{provincia}/{legajo} — agencies without a legajo use pendiente-{id}. */
export function agencyFolder(agency: AgencyRef) {
  const legajo =
    !agency.licenseNumber || /^(pend|pendiente)/i.test(agency.licenseNumber)
      ? `pendiente-${agency.id}`
      : slugPart(agency.licenseNumber);
  return `agencias/${slugPart(agency.province.code)}/${legajo}`;
}

const yearMonth = (date: Date) =>
  `${date.getUTCFullYear()}/${String(date.getUTCMonth() + 1).padStart(2, "0")}`;

const inAgency = (agency: AgencyRef, path: string) => `${agencyFolder(agency)}/${path}`;

export const keys = {
  // Branding of an agency (AgencyAsset): "simbolo", "logo", "perfil".
  brand: (agency: AgencyRef, variant: string, ext: string, version = Date.now()) =>
    inAgency(agency, `marca/${slugPart(variant)}-${version}.${extPart(ext)}`),
  employeePhoto: (agency: AgencyRef, employeeId: string, ext: string, version = Date.now()) =>
    inAgency(agency, `equipo/${employeeId}/foto-${version}.${extPart(ext)}`),
  // Everything a customer's order produces stays together, under the month it was placed.
  receipt: (agency: AgencyRef, orderId: string, fileId: string, ext: string, at = new Date()) =>
    inAgency(agency, `pedidos/${yearMonth(at)}/${orderId}/comprobante-${fileId}.${extPart(ext)}`),
  ticket: (agency: AgencyRef, orderId: string, fileId: string, ext: string, at = new Date()) =>
    inAgency(agency, `pedidos/${yearMonth(at)}/${orderId}/boleta-${fileId}.${extPart(ext)}`),
  // Photo of the daily Lotería settlement ticket, by its issue date.
  settlement: (agency: AgencyRef, issueDate: Date, fileId: string, ext: string) =>
    inAgency(
      agency,
      `finanzas/liquidaciones/${yearMonth(issueDate)}/${issueDate.toISOString().slice(0, 10)}-${fileId}.${extPart(ext)}`,
    ),
  // Attachment of a payment method movement (FundMovement.attachmentKey).
  movementAttachment: (agency: AgencyRef, movementId: string, ext: string, at = new Date()) =>
    inAgency(agency, `finanzas/movimientos/${yearMonth(at)}/${movementId}.${extPart(ext)}`),
  // Picture of an owner product (public), shared by every agency that offers it.
  ownerProductImage: (ownerUserId: string, productId: string, version = Date.now()) =>
    `duenos/${ownerUserId}/productos/${productId}/imagen-${version}.webp`,
  // Picture of an official game (public).
  gameImage: (gameCode: string, version = Date.now()) =>
    `juegos/${slugPart(gameCode)}/imagen-${version}.webp`,
  // Logo of an official lottery (public): social pictures, panel.
  lotteryLogo: (lotteryCode: string, version = Date.now()) =>
    `loterias/${slugPart(lotteryCode)}/logo-${version}.png`,
  // Picture of a traditional Quiniela number meaning, 00–99 (public).
  numberMeaningImage: (number: number, ext: string, version = Date.now()) =>
    `quiniela/significados/${String(number).padStart(2, "0")}-${version}.${extPart(ext)}`,
  // Official monthly Quiniela program of a province (private: kept as the source of a draft).
  quinielaProgram: (
    provinceCode: string,
    year: number,
    month: number,
    version: number,
  ) =>
    `provincias/${slugPart(provinceCode)}/quiniela/programas/${year}-${String(month).padStart(2, "0")}-v${version}.pdf`,
};

// ─── Operations ────────────────────────────────────────────────

export async function putFile(
  bucket: BucketName,
  key: string,
  body: Uint8Array,
  contentType: string,
  // Files whose key changes on every upload (versioned names) never change: cache them for a year.
  { immutable = false }: { immutable?: boolean } = {},
) {
  await s3.send(
    new PutObjectCommand({
      Bucket: buckets[bucket],
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl:
        bucket !== "public"
          ? "private, no-store"
          : immutable
            ? "public, max-age=31536000, immutable"
            : "public, max-age=3600",
    }),
  );
  return { key, sizeBytes: body.byteLength };
}

export async function deleteFile(bucket: BucketName, key: string) {
  await s3.send(new DeleteObjectCommand({ Bucket: buckets[bucket], Key: key }));
}

/** Public files (logos): the public bucket's own domain (R2 custom domain or r2.dev), cacheable. */
export function publicUrl(key: string) {
  const base = env("STORAGE_PUBLIC_URL");
  return `${base.replace(/\/$/, "")}/${key.split("/").map(encodeURIComponent).join("/")}`;
}

/** Private files (receipts, tickets): short-lived signed URL. Check access BEFORE calling. */
export function signedUrl(key: string, expiresInSeconds = 300) {
  return getSignedUrl(
    s3,
    new GetObjectCommand({ Bucket: buckets.private, Key: key }),
    {
      expiresIn: expiresInSeconds,
    },
  );
}

/** Create both buckets if missing (local setup). */
export async function ensureBuckets() {
  for (const bucket of Object.values(buckets)) {
    try {
      await s3.send(new HeadBucketCommand({ Bucket: bucket }));
    } catch {
      await s3.send(new CreateBucketCommand({ Bucket: bucket }));
    }
  }
}
