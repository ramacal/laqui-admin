"use server";

import { revalidatePath } from "next/cache";
import { getAccess } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { onStaffChanged } from "@/lib/drive/sharing";

export type OwnerEmailState = { ok: boolean; message: string } | null;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Spec agency-administration "Owner Email Assignment": only platform admins.
// The owner gets access when they sign in with Google using this email (or right
// away if that user already exists). Changing it removes the previous login's access.
export async function assignOwnerEmail(agencyId: string, _prev: OwnerEmailState, form: FormData): Promise<OwnerEmailState> {
  const access = await getAccess();
  if (!access?.isPlatformAdmin) return { ok: false, message: "Solo el admin de plataforma puede asignar el dueño." };

  const email = String(form.get("email") ?? "").trim().toLowerCase();
  if (!EMAIL.test(email)) return { ok: false, message: "Ingresá un email válido." };

  const owner = await prisma.agencyEmployee.findFirst({ where: { agencyId, role: "OWNER", active: true } });
  if (!owner) return { ok: false, message: "La agencia no tiene un dueño cargado." };
  if (owner.email === email) return { ok: true, message: "El dueño ya tiene ese email." };

  const user = await prisma.user.findUnique({ where: { email } });
  if (user) {
    // One membership per user per agency: the same person cannot also be staff here.
    const other = await prisma.agencyEmployee.findFirst({
      where: { agencyId, userId: user.id, NOT: { id: owner.id } },
    });
    if (other) {
      return {
        ok: false,
        message: `${email} ya está cargado en esta agencia como ${other.firstName} ${other.lastName}.`,
      };
    }
  }

  await prisma.agencyEmployee.update({
    where: { id: owner.id },
    data: { email, userId: user?.id ?? null },
  });
  await onStaffChanged(agencyId); // the owner's new email gets the Drive folder, the old one loses it
  revalidatePath(`/panel/agencias/${agencyId}`);
  revalidatePath("/panel");

  return {
    ok: true,
    message: user
      ? `Listo: ${email} ya tiene acceso como dueño.`
      : `Listo: cuando ${email} ingrese con Google va a ver la agencia.`,
  };
}
