// GET /api/drive/connect?agencia={agencyId}
// Starts the agency Google Drive OAuth flow (spec agency-google-drive "Separate Drive Connection").
import { NextResponse } from "next/server";
import { agencyRole, canManageDrive, getAccess } from "@/lib/access";
import { DRIVE_NONCE_COOKIE, STATE_TTL_SECONDS, hasDriveKey, newNonce, signState } from "@/lib/drive/crypto";
import { appUrl, authUrl, hasGoogleClient } from "@/lib/drive/google";

export async function GET(req: Request) {
  const agencyId = new URL(req.url).searchParams.get("agencia") ?? "";
  const access = await getAccess();
  if (!access) return NextResponse.redirect(`${appUrl()}/login`);
  if (!agencyId || !canManageDrive(agencyRole(access, agencyId))) return new Response("No encontrado", { status: 404 });

  const back = `${appUrl()}/panel/agencias/${agencyId}`;
  if (!hasGoogleClient() || !hasDriveKey()) return NextResponse.redirect(`${back}?drive=error-config`);

  const nonce = newNonce();
  const res = NextResponse.redirect(authUrl(signState({ agencyId, userId: access.user.id, nonce })));
  res.cookies.set(DRIVE_NONCE_COOKIE, nonce, {
    httpOnly: true,
    sameSite: "lax", // sent on Google's top-level redirect back to the callback
    secure: appUrl().startsWith("https://"),
    path: "/api/drive",
    maxAge: STATE_TTL_SECONDS,
  });
  return res;
}
