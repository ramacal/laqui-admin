// S3-compatible file storage (SeaweedFS locally; S3 / R2 / Supabase Storage in production).
// The database only keeps object keys; files never go into MySQL.
//
// Layout (spec: openspec/.../design.md "File Storage"), one folder per agency:
//   agencias/{provincia}/{legajo}/logo/{tipo}.{ext}                          public
//   agencias/{provincia}/{legajo}/empleados/{employeeId}/foto.{ext}           public
//   agencias/{provincia}/{legajo}/comprobantes/{yyyy}/{mm}/{orderId}/{id}.{ext}  private
//   agencias/{provincia}/{legajo}/boletas/{yyyy}/{mm}/{orderId}/{id}.{ext}       private
//   agencias/{provincia}/{legajo}/liquidaciones/{yyyy}/{mm}/{fecha}-{id}.{ext}    private
import { CreateBucketCommand, GetObjectCommand, HeadBucketCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

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
    region: env("STORAGE_REGION", "us-east-1"),
    forcePathStyle: true, // required by SeaweedFS / MinIO-style endpoints
    credentials: {
      accessKeyId: env("STORAGE_ACCESS_KEY"),
      secretAccessKey: env("STORAGE_SECRET_KEY"),
    },
  });
if (process.env.NODE_ENV !== "production") globalForStorage.s3 = s3;

// ─── Keys ──────────────────────────────────────────────────────

type AgencyRef = { id: string; licenseNumber: string; province: { code: string } };

const slugPart = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-|-$/g, "");

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

export const keys = {
  logo: (agency: AgencyRef, kind: string, ext: string) =>
    `${agencyFolder(agency)}/logo/${slugPart(kind)}.${ext}`,
  employeePhoto: (agency: AgencyRef, employeeId: string, ext: string) =>
    `${agencyFolder(agency)}/empleados/${employeeId}/foto.${ext}`,
  receipt: (agency: AgencyRef, orderId: string, fileId: string, ext: string, at = new Date()) =>
    `${agencyFolder(agency)}/comprobantes/${yearMonth(at)}/${orderId}/${fileId}.${ext}`,
  settlement: (agency: AgencyRef, issueDate: Date, fileId: string, ext: string) =>
    `${agencyFolder(agency)}/liquidaciones/${yearMonth(issueDate)}/${issueDate.toISOString().slice(0, 10)}-${fileId}.${ext}`,
  ticket: (agency: AgencyRef, orderId: string, fileId: string, ext: string, at = new Date()) =>
    `${agencyFolder(agency)}/boletas/${yearMonth(at)}/${orderId}/${fileId}.${ext}`,
  // Official monthly Quiniela program of a province (private: kept as the source of a draft).
  quinielaProgram: (provinceCode: string, year: number, month: number, version: number) =>
    `provincias/${slugPart(provinceCode)}/quiniela/programas/${year}-${String(month).padStart(2, "0")}-v${version}.pdf`,
};

// ─── Operations ────────────────────────────────────────────────

export async function putFile(bucket: BucketName, key: string, body: Uint8Array, contentType: string) {
  await s3.send(
    new PutObjectCommand({
      Bucket: buckets[bucket],
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: bucket === "public" ? "public, max-age=3600" : "private, no-store",
    }),
  );
  return { key, sizeBytes: body.byteLength };
}

/** Public files (logos): direct URL, cacheable. */
export function publicUrl(key: string) {
  const base = env("STORAGE_PUBLIC_URL", `${process.env.STORAGE_ENDPOINT}/${buckets.public}`);
  return `${base.replace(/\/$/, "")}/${key.split("/").map(encodeURIComponent).join("/")}`;
}

/** Private files (receipts, tickets): short-lived signed URL. Check access BEFORE calling. */
export function signedUrl(key: string, expiresInSeconds = 300) {
  return getSignedUrl(s3, new GetObjectCommand({ Bucket: buckets.private, Key: key }), {
    expiresIn: expiresInSeconds,
  });
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
