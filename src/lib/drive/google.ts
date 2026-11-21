// Google OAuth and Drive REST v3 with plain fetch (spec agency-google-drive). The OAuth client is
// the same as the Laqui sign-in (GOOGLE_CLIENT_ID/SECRET), with its own redirect URI and only
// the drive.file scope: Laqui sees and manages only the files it creates.

export const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
/** Access level given to the agency staff on laqui/{agencia}. One level for everyone. */
export const DRIVE_SHARE_ROLE = "writer";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const REVOKE_URL = "https://oauth2.googleapis.com/revoke";
const API = "https://www.googleapis.com/drive/v3";
export const UPLOAD_API = "https://www.googleapis.com/upload/drive/v3";

/** Google no longer accepts this connection's token: the agency has to reconnect. */
export class DriveAuthError extends Error {
  constructor(
    message: string,
    readonly fromDrive = false, // a 401 from Drive (may be a stale access token) vs the token endpoint
  ) {
    super(message);
  }
}

export class DriveError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly reason?: string,
  ) {
    super(message);
  }
}

export const appUrl = () => (process.env.NEXT_PUBLIC_APP_URL ?? process.env.BETTER_AUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");
export const redirectUri = () => `${appUrl()}/api/drive/callback`;
export const hasGoogleClient = () => Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

export function authUrl(state: string) {
  const q = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: DRIVE_SCOPE,
    access_type: "offline",
    // Always choose the account (often not the sign-in one) and always get a refresh token.
    prompt: "select_account consent",
    include_granted_scopes: "false",
    state,
  });
  return `${AUTH_URL}?${q}`;
}

type TokenResponse = {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  error?: string;
  error_description?: string;
};

async function tokenRequest(params: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      ...params,
    }),
    cache: "no-store",
  });
  const body = (await res.json().catch(() => ({}))) as TokenResponse;
  if (!res.ok) {
    const msg = body.error_description ?? body.error ?? `HTTP ${res.status}`;
    // invalid_grant: expired (7 days in testing mode), revoked, or password changed.
    if (body.error === "invalid_grant" || body.error === "unauthorized_client") throw new DriveAuthError(msg);
    throw new DriveError(`Google OAuth: ${msg}`, res.status, body.error);
  }
  return body;
}

export async function exchangeCode(code: string) {
  const t = await tokenRequest({ grant_type: "authorization_code", code, redirect_uri: redirectUri() });
  return {
    accessToken: t.access_token ?? null,
    expiresIn: t.expires_in ?? 0,
    refreshToken: t.refresh_token ?? null,
    scopes: (t.scope ?? "").split(" "),
  };
}

// Access tokens live in memory only, per connection, until a minute before they expire.
const accessTokens = new Map<string, { token: string; until: number }>();

export function rememberAccessToken(connectionId: string, token: string, expiresIn: number) {
  accessTokens.set(connectionId, { token, until: Date.now() + (expiresIn - 60) * 1000 });
}
export const forgetAccessToken = (connectionId: string) => accessTokens.delete(connectionId);

export async function accessTokenFor(connectionId: string, refreshToken: string) {
  const hit = accessTokens.get(connectionId);
  if (hit && hit.until > Date.now()) return hit.token;
  const t = await tokenRequest({ grant_type: "refresh_token", refresh_token: refreshToken });
  if (!t.access_token) throw new DriveAuthError("Google did not return an access token");
  if (t.scope && !t.scope.split(" ").includes(DRIVE_SCOPE)) throw new DriveAuthError("The Drive permission was removed");
  rememberAccessToken(connectionId, t.access_token, t.expires_in ?? 3600);
  return t.access_token;
}

/** Revokes the whole grant of that Google account for this app (every token of it). */
export async function revokeToken(token: string) {
  const res = await fetch(REVOKE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token }),
  });
  // 400 invalid_token: already revoked or expired, which is what we wanted.
  return res.ok || res.status === 400;
}

type DriveInit = { method?: string; query?: Record<string, string>; json?: unknown; body?: BodyInit; headers?: Record<string, string> };

/** One Drive REST call. Returns the parsed JSON (null for 204). */
export async function driveFetch<T = unknown>(token: string, path: string, init: DriveInit = {}, base = API): Promise<T> {
  const url = `${base}${path}${init.query ? `?${new URLSearchParams(init.query)}` : ""}`;
  const headers: Record<string, string> = { Authorization: `Bearer ${token}`, ...init.headers };
  if (init.json !== undefined) headers["Content-Type"] = "application/json; charset=UTF-8";
  const res = await fetch(url, {
    method: init.method ?? "GET",
    headers,
    body: init.json !== undefined ? JSON.stringify(init.json) : init.body,
    cache: "no-store",
  });
  if (res.status === 204) return null as T;
  const body = (await res.json().catch(() => null)) as { error?: { message?: string; errors?: { reason?: string }[] } } | null;
  if (!res.ok) {
    const message = body?.error?.message ?? `HTTP ${res.status}`;
    const reason = body?.error?.errors?.[0]?.reason;
    if (res.status === 401) throw new DriveAuthError(message, true);
    if (res.status === 403 && /authentication scopes/i.test(message)) throw new DriveAuthError(message);
    throw new DriveError(message, res.status, reason);
  }
  return body as T;
}

export const folderUrl = (folderId: string) => `https://drive.google.com/drive/folders/${folderId}`;
