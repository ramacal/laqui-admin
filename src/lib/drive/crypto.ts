// Secrets of the agency Drive connection (spec agency-google-drive "Token Protection").
// One env key, DRIVE_TOKEN_KEY (32 bytes, base64url):
//   - refresh tokens: AES-256-GCM, the agency id as additional data (a token copied to another
//     agency's row does not decrypt);
//   - OAuth state: HMAC-SHA256 with a key derived from it.
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const VERSION = "v1";

function tokenKey(): Buffer {
  const raw = process.env.DRIVE_TOKEN_KEY;
  if (!raw) throw new Error("DRIVE_TOKEN_KEY is not set");
  const key = Buffer.from(raw, "base64url");
  if (key.length !== 32) throw new Error("DRIVE_TOKEN_KEY must be 32 bytes in base64url");
  return key;
}

export const hasDriveKey = () => {
  try {
    tokenKey();
    return true;
  } catch {
    return false;
  }
};

export function encryptToken(plain: string, agencyId: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", tokenKey(), iv);
  cipher.setAAD(Buffer.from(agencyId));
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [VERSION, iv, cipher.getAuthTag(), ct].map((p) => (typeof p === "string" ? p : p.toString("base64url"))).join(".");
}

/** Throws when the key changed, the value was tampered with or belongs to another agency. */
export function decryptToken(stored: string, agencyId: string): string {
  const [version, iv, tag, ct] = stored.split(".");
  if (version !== VERSION || !iv || !tag || !ct) throw new Error("Unknown token format");
  const decipher = createDecipheriv("aes-256-gcm", tokenKey(), Buffer.from(iv, "base64url"));
  decipher.setAAD(Buffer.from(agencyId));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ct, "base64url")), decipher.final()]).toString("utf8");
}

// ─── OAuth state (CSRF): tied to agency, user, a browser cookie and 10 minutes ───

export type OAuthState = { agencyId: string; userId: string; nonce: string; exp: number };
export const STATE_TTL_SECONDS = 10 * 60;
export const DRIVE_NONCE_COOKIE = "laqui_drive_nonce";

const stateKey = () => createHash("sha256").update("laqui-drive-state:").update(tokenKey()).digest();
const sign = (payload: string) => createHmac("sha256", stateKey()).update(payload).digest("base64url");

export const newNonce = () => randomBytes(16).toString("base64url");

export function signState(state: Omit<OAuthState, "exp">): string {
  const payload = Buffer.from(JSON.stringify({ ...state, exp: Math.floor(Date.now() / 1000) + STATE_TTL_SECONDS })).toString(
    "base64url",
  );
  return `${payload}.${sign(payload)}`;
}

/** The state if its signature is valid and it has not expired, else null. */
export function readState(token: string | null): OAuthState | null {
  if (!token) return null;
  const [payload, mac] = token.split(".");
  if (!payload || !mac || !safeEqual(mac, sign(payload))) return null;
  try {
    const state = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as OAuthState;
    if (typeof state.exp !== "number" || state.exp < Date.now() / 1000) return null;
    return state;
  } catch {
    return null;
  }
}

export function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
