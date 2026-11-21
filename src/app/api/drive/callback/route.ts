// GET /api/drive/callback?code=…&state=… (Google redirects here after the Drive consent).
// The state must be signed by us, unexpired, match this browser's cookie and the signed-in user.
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { agencyRole, canManageDrive, getAccess } from "@/lib/access";
import { DRIVE_NONCE_COOKIE, readState, safeEqual } from "@/lib/drive/crypto";
import { DriveConnectError, connectDrive } from "@/lib/drive/connection";
import { appUrl } from "@/lib/drive/google";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const state = readState(q.get("state"));
  const jar = await cookies();
  const nonce = jar.get(DRIVE_NONCE_COOKIE)?.value;
  jar.delete({ name: DRIVE_NONCE_COOKIE, path: "/api/drive" });

  const access = await getAccess();
  if (!access) return NextResponse.redirect(`${appUrl()}/login`);
  if (!state || !nonce || !safeEqual(nonce, state.nonce) || state.userId !== access.user.id) {
    return NextResponse.redirect(`${appUrl()}/panel${state ? `/agencias/${state.agencyId}/datos` : ""}?drive=error-estado`);
  }

  const back = (result: string) => NextResponse.redirect(`${appUrl()}/panel/agencias/${state.agencyId}/datos?drive=${result}`);
  if (!canManageDrive(agencyRole(access, state.agencyId))) return back("error-acceso");
  if (q.get("error")) return back("cancelado"); // access_denied: the user closed the consent screen
  const code = q.get("code");
  if (!code) return back("error-google");

  try {
    await connectDrive({ agencyId: state.agencyId, userId: access.user.id, code });
    return back("conectado");
  } catch (err) {
    if (err instanceof DriveConnectError) return back(`error-${err.code}`);
    console.error("Drive connect failed:", err);
    return back("error-google");
  }
}
