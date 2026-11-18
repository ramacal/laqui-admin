"use server";

// Platform admin: Quiniela programs and scheduled jobs.
import { revalidatePath } from "next/cache";
import { getAccess } from "@/lib/access";
import { JobError, runJob, setJobEnabled } from "@/lib/jobs/runner";
import { parseMoney } from "@/lib/finance";
import { prisma } from "@/lib/prisma";
import { ProgramError, discardDraft, importProgramPdf, publishProgram } from "@/lib/quiniela/program";
import {
  CalendarError,
  SLOT_ORDER,
  type Slot,
  addException,
  deleteException,
  setDrawNumber,
  setDrawTime,
  setLotteryInDraw,
} from "@/lib/quiniela/calendar";
import type { QuinielaExceptionAction } from "@/generated/prisma/enums";
import { resolveResult, unresolveResult } from "@/lib/quiniela/results/store";

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
    if (err instanceof Forbidden || err instanceof ProgramError || err instanceof JobError || err instanceof CalendarError)
      return { ok: false, message: err.message };
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
    const plan = await publishProgram(programId);
    return `Programa publicado: ${plan.ruleChanges.length} cambio(s) en la semana tipo, ${plan.exceptions.length} excepción(es) y ${plan.anchors.length} número(s) de sorteo.`;
  });
}

// ─── Usual week, exceptions and draw numbers ───────────────────

const str = (form: FormData, key: string) => String(form.get(key) ?? "").trim();
const slotOf = (raw: string): Slot | null => (SLOT_ORDER as string[]).includes(raw) ? (raw as Slot) : null;

const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

/**
 * Usual week, from a date: a lottery joins a draw ("add"), leaves it ("remove"), or a draw
 * moves to another time ("time").
 */
export async function changeUsualWeekAction(provinceId: string, _prev: FormState, form: FormData) {
  return guarded(async () => {
    await requireAdmin();
    const kind = str(form, "kind");
    const slot = slotOf(str(form, "slot"));
    if (!slot) throw new CalendarError("Elegí el sorteo.");
    const weekdays = form.getAll("weekday").map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);
    const from = str(form, "from");
    if (kind === "time") {
      await setDrawTime({ provinceId, slot, weekdays, time: str(form, "time"), from });
      return `Listo: desde el ${ddmm(from)} el sorteo es a las ${str(form, "time")}.`;
    }
    const lottery = str(form, "lottery");
    if (!lottery) throw new CalendarError("Elegí la lotería.");
    if (kind !== "add" && kind !== "remove") throw new CalendarError("Elegí qué cambia.");
    await setLotteryInDraw({ provinceId, slot, lottery, weekdays, time: kind === "remove" ? null : str(form, "time"), from });
    return kind === "remove" ? `Listo: deja de jugar desde el ${ddmm(from)}.` : `Listo: juega desde el ${ddmm(from)}.`;
  });
}

// What the admin picks for one day → the stored exception.
const DAY_CHANGE: Record<string, QuinielaExceptionAction> = {
  no_draws: "SKIP",
  skip_draw: "SKIP",
  skip_lottery: "SKIP",
  add_lottery: "ADD",
  time: "TIME",
  expiry: "PRIZE_EXPIRY",
};

/** One day differs from the usual week. */
export async function addExceptionAction(provinceId: string, _prev: FormState, form: FormData) {
  return guarded(async () => {
    await requireAdmin();
    const kind = str(form, "kind");
    const action = DAY_CHANGE[kind];
    if (!action) throw new CalendarError("Elegí qué cambia ese día.");
    const slot = kind === "no_draws" || kind === "expiry" ? null : slotOf(str(form, "slot"));
    if (kind !== "no_draws" && kind !== "expiry" && !slot) throw new CalendarError("Elegí el sorteo.");
    const lottery = kind === "skip_lottery" || kind === "add_lottery" ? str(form, "lottery") || null : null;
    if ((kind === "skip_lottery" || kind === "add_lottery") && !lottery) throw new CalendarError("Elegí la lotería.");
    await addException({
      provinceId,
      date: str(form, "date"),
      action,
      slot,
      lottery,
      time: str(form, "time") || null,
      prizeExpiry: str(form, "prizeExpiry") || null,
      note: str(form, "note") || null,
    });
    return "Cambio guardado para ese día.";
  });
}

// ─── Results ───────────────────────────────────────────────────

/** A draw in conflict: the admin chooses which source's version is right. */
export async function resolveResultAction(resultId: string, readingId: string) {
  const access = await requireAdmin();
  await resolveResult(resultId, readingId, access.user.id);
  revalidatePath("/panel", "layout");
}

export async function unresolveResultAction(resultId: string) {
  await requireAdmin();
  await unresolveResult(resultId);
  revalidatePath("/panel", "layout");
}

export async function deleteExceptionAction(id: string) {
  await requireAdmin();
  await deleteException(id);
  revalidatePath("/panel", "layout");
}

export async function setDrawNumberAction(provinceId: string, _prev: FormState, form: FormData) {
  return guarded(async () => {
    await requireAdmin();
    const slot = slotOf(str(form, "slot"));
    if (!slot) throw new CalendarError("Elegí el sorteo.");
    await setDrawNumber({ provinceId, slot, lottery: str(form, "lottery"), date: str(form, "date"), number: Number(str(form, "number")) });
    return "Número guardado: los demás días se cuentan desde este.";
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
    const rawExpiry = String(form.get("prizeExpiryDays") ?? "").trim();
    const cutoffMinutes = rawCutoff === "" ? null : Number(rawCutoff);
    if (cutoffMinutes !== null && (!Number.isInteger(cutoffMinutes) || cutoffMinutes < 0 || cutoffMinutes > 120))
      throw new ProgramError("Los minutos de cierre van de 0 a 120.");
    const prizeExpiryDays = rawExpiry === "" ? null : Number(rawExpiry);
    if (prizeExpiryDays !== null && (!Number.isInteger(prizeExpiryDays) || prizeExpiryDays < 1 || prizeExpiryDays > 120))
      throw new ProgramError("Los días de caducidad van de 1 a 120.");
    const max = rawMax === "" ? null : parseMoney(rawMax);
    if (max && (max.isNaN() || max.lte(0))) throw new ProgramError("El máximo tiene que ser un monto mayor a cero.");
    const quiniela = await prisma.gameDefinition.findUniqueOrThrow({ where: { code: "QUINIELA" } });
    await prisma.provinceGameAvailability.update({
      where: { provinceId_gameId: { provinceId, gameId: quiniela.id } },
      data: { cutoffMinutes, maxBetAmount: max, prizeExpiryDays },
    });
    return "Reglas guardadas.";
  });
}
