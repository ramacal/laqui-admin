"use server";

// Plataforma → Loterías (ABM). Platform admins only.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAccess } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { deleteFile } from "@/lib/storage";
import { LotteryError, logoPng, lotteryUsage, parseLotteryForm, replaceLotteryLogo } from "@/lib/lotteries";

export type FormState = { ok: boolean; message: string } | null;

async function admin() {
  const access = await getAccess();
  if (!access?.isPlatformAdmin) throw new LotteryError("Solo el admin de plataforma administra las loterías.");
}

async function guarded(fn: () => Promise<string>): Promise<FormState> {
  try {
    return { ok: true, message: await fn() };
  } catch (err) {
    if (err instanceof LotteryError) return { ok: false, message: err.message };
    throw err;
  }
}

async function logoFrom(form: FormData) {
  const file = form.get("logo");
  if (!(file instanceof File) || file.size === 0) return null;
  if (file.size > 8 * 1024 * 1024) throw new LotteryError("El logo pesa más de 8 MB.");
  return logoPng(new Uint8Array(await file.arrayBuffer()));
}

export async function createLottery(_prev: FormState, form: FormData): Promise<FormState> {
  let id = "";
  const state = await guarded(async () => {
    await admin();
    const data = await parseLotteryForm(form, null);
    const logo = await logoFrom(form);
    const lottery = await prisma.lottery.create({ data });
    if (logo) await replaceLotteryLogo(lottery, logo);
    id = lottery.id;
    return "Lotería creada.";
  });
  if (state?.ok) {
    revalidatePath("/panel/loterias");
    redirect(`/panel/loterias/${id}`);
  }
  return state;
}

export async function updateLottery(lotteryId: string, _prev: FormState, form: FormData): Promise<FormState> {
  return guarded(async () => {
    await admin();
    const lottery = await prisma.lottery.findUnique({ where: { id: lotteryId } });
    if (!lottery) throw new LotteryError("La lotería ya no existe.");
    const data = await parseLotteryForm(form, lotteryId);
    // The code names Quiniela draws in programs and results: it stays once it is in use.
    if (data.code !== lottery.code && (await lotteryUsage(lotteryId)) > 0)
      throw new LotteryError("El código no se puede cambiar: la lotería ya tiene sorteos o provincias que la ofrecen.");
    const logo = await logoFrom(form);
    await prisma.lottery.update({ where: { id: lotteryId }, data });
    if (logo) await replaceLotteryLogo({ ...lottery, code: data.code }, logo);
    revalidatePath("/panel/loterias");
    revalidatePath(`/panel/loterias/${lotteryId}`);
    return logo ? "Guardado, con el logo nuevo." : "Guardado.";
  });
}

export async function removeLotteryLogo(lotteryId: string) {
  await admin();
  const lottery = await prisma.lottery.findUniqueOrThrow({ where: { id: lotteryId } });
  if (lottery.logoKey) {
    await prisma.lottery.update({ where: { id: lotteryId }, data: { logoKey: null } });
    await deleteFile("public", lottery.logoKey).catch(() => undefined);
  }
  revalidatePath(`/panel/loterias/${lotteryId}`);
  revalidatePath("/panel/loterias");
}

/** Delete only when nothing points to it; otherwise the admin deactivates it. */
export async function deleteLottery(lotteryId: string, _prev: FormState): Promise<FormState> {
  const state = await guarded(async () => {
    await admin();
    const lottery = await prisma.lottery.findUnique({ where: { id: lotteryId } });
    if (!lottery) return "Ya estaba eliminada.";
    if ((await lotteryUsage(lotteryId)) > 0)
      throw new LotteryError("Tiene sorteos, resultados o provincias que la ofrecen: desactivala en lugar de eliminarla.");
    await prisma.lottery.delete({ where: { id: lotteryId } });
    if (lottery.logoKey) await deleteFile("public", lottery.logoKey).catch(() => undefined);
    return "Eliminada.";
  });
  if (state?.ok) {
    revalidatePath("/panel/loterias");
    redirect("/panel/loterias");
  }
  return state;
}
