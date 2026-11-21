"use server";

import { revalidatePath } from "next/cache";
import { agencyRole, canViewStaff, getAccess } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { normalizeHandle } from "@/lib/content/social";

export type SocialState = { ok: boolean; message: string } | null;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Spec social-content "Agency Social Accounts": owners, agency admins and platform admins. No passwords.
export async function saveInstagram(agencyId: string, _prev: SocialState, form: FormData): Promise<SocialState> {
  const access = await getAccess();
  if (!access || !canViewStaff(agencyRole(access, agencyId))) return { ok: false, message: "Solo el dueño o un administrador puede cambiar las redes." };

  const rawHandle = String(form.get("handle") ?? "");
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  if (!rawHandle.trim()) {
    await prisma.agencySocialAccount.deleteMany({ where: { agencyId, network: "INSTAGRAM" } });
    revalidatePath(`/panel/agencias/${agencyId}/redes`);
    return { ok: true, message: "Instagram quitado." };
  }
  const handle = normalizeHandle(rawHandle);
  if (!handle) return { ok: false, message: "La cuenta solo puede tener letras, números, puntos y guiones bajos (hasta 30)." };
  if (email && !EMAIL.test(email)) return { ok: false, message: "Ingresá un email válido o dejalo vacío." };

  await prisma.agencySocialAccount.upsert({
    where: { agencyId_network: { agencyId, network: "INSTAGRAM" } },
    create: { agencyId, network: "INSTAGRAM", handle, email: email || null },
    update: { handle, email: email || null },
  });
  revalidatePath(`/panel/agencias/${agencyId}/redes`);
  revalidatePath(`/panel/agencias/${agencyId}`);
  return { ok: true, message: `Guardado: @${handle}` };
}
