// Scheduled jobs (admin "Tareas programadas"). Each job has a key, a default cron schedule
// (Buenos Aires time) and a handler that returns a one-line summary. WARNING means it ran fine
// but someone has to look at something (e.g. a new program draft to publish).
import { syncHolidayYear } from "@/lib/holidays-sync";
import { prisma } from "@/lib/prisma";
import { MONTH_LABEL, importProgramPdf } from "@/lib/quiniela/program";
import { downloadPdf, fetchGamesPage } from "@/lib/quiniela/web-schedule";

export type JobResult = { status: "OK" | "WARNING"; summary: string; details?: Record<string, unknown> };
export type JobDefinition = {
  key: string;
  name: string;
  description: string;
  schedule: string;
  run: () => Promise<JobResult>;
};

const monthName = (year: number, month: number) => `${MONTH_LABEL[month - 1]} ${year}`;

/** Lotería de la Provincia publishes the next month's program near the end of each month. */
async function quinielaProgramPBA(): Promise<JobResult> {
  const web = await fetchGamesPage();
  if (!web.programPdfUrl) return { status: "WARNING", summary: "No encontré el link «Programa Mensual de Quiniela» en la web de Lotería." };
  const pdf = await downloadPdf(web.programPdfUrl);
  const result = await importProgramPdf({ provinceCode: "B", pdf, sourceUrl: web.programPdfUrl, web });
  const p = result.program;
  const month = monthName(p.year, p.month);
  if (result.created) {
    const days = result.draft.days.length;
    const draws = result.draft.days.reduce((a, d) => a + d.draws.length, 0);
    return {
      status: "WARNING",
      summary: `Nuevo borrador de ${month}: ${days} días, ${draws} sorteos${result.warnings.length ? `, ${result.warnings.length} advertencia(s)` : ""}. Revisalo y publicalo.`,
      details: { programId: p.id, warnings: result.warnings, webMonth: web.monthLabel },
    };
  }
  // Same PDF as before: remind if the month in it is still waiting to be published.
  const published = await prisma.provinceQuinielaMonthlyProgram.count({
    where: { provinceId: p.provinceId, year: p.year, month: p.month, status: "PUBLISHED" },
  });
  return published
    ? { status: "OK", summary: `Sin cambios: el programa de ${month} ya está publicado.` }
    : { status: "WARNING", summary: `El programa de ${month} está en borrador: falta publicarlo.`, details: { programId: p.id } };
}

async function holidaysSync(): Promise<JobResult> {
  const year = new Date().getUTCFullYear();
  const results = [await syncHolidayYear(year), await syncHolidayYear(year + 1)];
  return {
    status: "OK",
    summary: results.map((r) => `${r.year}: ${r.count} feriados${r.removed ? ` (${r.removed} eliminados)` : ""}`).join(" · "),
  };
}

export const JOBS: JobDefinition[] = [
  {
    key: "quiniela-program-B",
    name: "Programa de Quiniela · Provincia de Buenos Aires",
    description:
      "Lee la web de Lotería de la Provincia, baja el PDF del programa mensual, lo lee y deja un borrador para revisar si cambió. Lo compara con los horarios publicados en la web.",
    schedule: "0 8,14 * * *",
    run: quinielaProgramPBA,
  },
  {
    key: "holidays-sync",
    name: "Feriados nacionales",
    description: "Actualiza los feriados del año actual y el próximo desde ArgentinaDatos (solo referencia: no cierran agencias).",
    schedule: "0 6 * * 1",
    run: holidaysSync,
  },
];

export const jobDefinition = (key: string) => JOBS.find((j) => j.key === key);
