"use server";

// Platform admin: Quiniela programs and scheduled jobs.
import { revalidatePath } from "next/cache";
import { getAccess } from "@/lib/access";
import { JobError, runJob, setJobEnabled } from "@/lib/jobs/runner";
import { parseMoney } from "@/lib/finance";
import { prisma } from "@/lib/prisma";
import { ProgramError, discardDraft, importProgramPdf, publishProgram } from "@/lib/quiniela/program";

export type FormState = { ok: boolean; message: string } | null;
class Forbidden extends Error {}

async function requireAdmin() {
  const access = await getAccess();
  if (!access?.isPlatformAdmin) throw new Forbidden("Solo el admin de la plataforma.");
  return access;
}

async function guarded(fn: () => Promise<string>): Promise<FormState> {
  try {
    const message = await fn();
    revalidatePath("/panel", "layout");
    return { ok: true, message };
  } catch (err) {
    if (err instanceof Forbidden || err instanceof ProgramError || err instanceof JobError) return { ok: false, message: err.message };
    if (err instanceof Error && /programa|columnas|título|PDF|página/i.test(err.message)) return { ok: false, message: err.message };
    throw err;
  }
}

export async function runJobAction(key: string, _prev: FormState, _form: FormData) {
  return guarded(async () => {
    const access = await requireAdmin();
    const run = await runJob(key, "MANUAL", access.user.id);
    return run.status === "ERROR" ? `Falló: ${run.error}` : (run.summary ?? "Listo.");
  });
}

export async function setJobEnabledAction(key: string, enabled: boolean) {
  await requireAdmin();
  await setJobEnabled(key, enabled);
  revalidatePath("/panel", "layout");
}

export async function publishProgramAction(programId: string, _prev: FormState, _form: FormData) {
  return guarded(async () => {
    await requireAdmin();
    await publishProgram(programId);
    return "Programa publicado: ya define qué sorteos hay cada día.";
  });
}

export async function discardDraftAction(programId: string) {
  await requireAdmin();
  await discardDraft(programId);
  revalidatePath("/panel", "layout");
}

/** Manual upload of the official PDF (when the automatic download is not available). */
export async function uploadProgramAction(provinceCode: string, _prev: FormState, form: FormData) {
  return guarded(async () => {
    await requireAdmin();
    const file = form.get("pdf");
    if (!(file instanceof File) || file.size === 0) throw new ProgramError("Elegí el PDF del programa.");
    if (file.size > 10 * 1024 * 1024) throw new ProgramError("El PDF pesa más de 10 MB.");
    const pdf = new Uint8Array(await file.arrayBuffer());
    if (String.fromCharCode(...pdf.slice(0, 5)) !== "%PDF-") throw new ProgramError("El archivo no es un PDF.");
    const r = await importProgramPdf({ provinceCode, pdf, sourceUrl: null });
    return r.created ? `Borrador creado (${r.draft.days.length} días).` : "Ese PDF ya estaba importado.";
  });
}

/** Province rules for Quiniela: minutes before the draw when betting closes, and max per lottery. */
export async function setQuinielaRulesAction(provinceId: string, _prev: FormState, form: FormData) {
  return guarded(async () => {
    await requireAdmin();
    const rawCutoff = String(form.get("cutoffMinutes") ?? "").trim();
    const rawMax = String(form.get("maxBetAmount") ?? "").trim();
    const cutoffMinutes = rawCutoff === "" ? null : Number(rawCutoff);
    if (cutoffMinutes !== null && (!Number.isInteger(cutoffMinutes) || cutoffMinutes < 0 || cutoffMinutes > 120))
      throw new ProgramError("Los minutos de cierre van de 0 a 120.");
    const max = rawMax === "" ? null : parseMoney(rawMax);
    if (max && (max.isNaN() || max.lte(0))) throw new ProgramError("El máximo tiene que ser un monto mayor a cero.");
    const quiniela = await prisma.gameDefinition.findUniqueOrThrow({ where: { code: "QUINIELA" } });
    await prisma.provinceGameAvailability.update({
      where: { provinceId_gameId: { provinceId, gameId: quiniela.id } },
      data: { cutoffMinutes, maxBetAmount: max },
    });
    return "Reglas guardadas. El cierre se aplica a los programas que se publiquen desde ahora.";
  });
}
