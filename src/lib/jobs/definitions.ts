// Scheduled jobs (admin "Tareas programadas"). A job has a TYPE (Quiniela program, Quiniela
// results, holidays) and, for province-level types, a PROVINCE and a SOURCE (the website it
// reads). The handler is chosen by type + source, so another province or a second website is
// one more job row, not new code per job. Handlers return a one-line summary; WARNING means it
// ran fine but someone has to look at something (e.g. a new program draft to publish).
import type { JobType } from "@/generated/prisma/enums";
import { syncHolidayYear } from "@/lib/holidays-sync";
import { prisma } from "@/lib/prisma";
import { MONTH_LABEL, importProgramPdf } from "@/lib/quiniela/program";
import { RESULT_SOURCES as RESULT_READERS, saveReadings, unconfirmedDraws } from "@/lib/quiniela/results/store";
import {
  downloadPdf,
  fetchGamesPage,
  PBA_GAMES_URL,
} from "@/lib/quiniela/web-schedule";

export type JobResult = {
  status: "OK" | "WARNING";
  summary: string;
  details?: Record<string, unknown>;
};
export type JobProvince = { id: string; code: string; name: string };
export type JobConfig = {
  type: JobType;
  source: string | null;
  province: JobProvince | null;
};

export class JobConfigError extends Error {}

const monthName = (year: number, month: number) =>
  `${MONTH_LABEL[month - 1]} ${year}`;

// ─── Sources: one reader per website ───────────────────────────

type Source = {
  label: string;
  url: string;
  run: (ctx: { province: JobProvince | null; runId: string }) => Promise<JobResult>;
};

/** Official monthly Quiniela programs, by source website. */
const PROGRAM_SOURCES: Record<string, Source> = {
  // Lotería de la Provincia publishes the next month's program near the end of each month.
  "loteria-gba": {
    label: "Lotería de la Provincia",
    url: PBA_GAMES_URL,
    run: async ({ province }) => {
      if (!province) throw new JobConfigError("Programa de Quiniela: falta la provincia.");
      const web = await fetchGamesPage();
      if (!web.programPdfUrl)
        return {
          status: "WARNING",
          summary:
            "No encontré el link «Programa Mensual de Quiniela» en la web de Lotería.",
        };
      const pdf = await downloadPdf(web.programPdfUrl);
      const result = await importProgramPdf({
        provinceCode: province.code,
        pdf,
        sourceUrl: web.programPdfUrl,
        web,
      });
      const p = result.program;
      const month = monthName(p.year, p.month);
      if (result.created) {
        const days = result.draft.days.length;
        const draws = result.draft.days.reduce((a, d) => a + d.draws.length, 0);
        return {
          status: "WARNING",
          summary: `Nuevo borrador de ${month}: ${days} días, ${draws} sorteos${result.warnings.length ? `, ${result.warnings.length} advertencia(s)` : ""}. Revisalo y publicalo.`,
          details: {
            programId: p.id,
            warnings: result.warnings,
            webMonth: web.monthLabel,
          },
        };
      }
      // Same PDF as before: remind if the month in it is still waiting to be published.
      const published = await prisma.provinceQuinielaMonthlyProgram.count({
        where: {
          provinceId: p.provinceId,
          year: p.year,
          month: p.month,
          status: "PUBLISHED",
        },
      });
      return published
        ? {
            status: "OK",
            summary: `Sin cambios: el programa de ${month} ya está publicado.`,
          }
        : {
            status: "WARNING",
            summary: `El programa de ${month} está en borrador: falta publicarlo.`,
            details: { programId: p.id },
          };
    },
  },
};

/** Quiniela results: one job per source website (spec: quiniela-results). */
const yesterdayAR = () => {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });
  return new Date(Date.parse(`${today}T12:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
};

const RESULT_SOURCES: Record<string, Source> = Object.fromEntries(
  Object.values(RESULT_READERS).map((reader) => [
    reader.key,
    {
      label: reader.label,
      url: reader.url,
      run: async ({ runId }) => {
        // notitimba only answers by date: ask for yesterday's draws still not confirmed.
        let opts = {};
        if (reader.key === "notitimba") {
          const date = yesterdayAR();
          const only = await unconfirmedDraws(date);
          if (!only.length) return { status: "OK" as const, summary: `Nada que consultar: los sorteos del ${date} ya están confirmados.` };
          opts = { date, only };
        }
        const readings = await reader.read(opts);
        if (!readings.length) return { status: "OK" as const, summary: "Todavía no hay resultados publicados." };
        const r = await saveReadings(reader, readings, runId);
        const dates = [...new Set(readings.map((x) => x.date))].sort().join(", ");
        const parts = [`${r.read} sorteo(s) del ${dates}`, `${r.changed} nuevo(s) o cambiado(s)`, `${r.confirmed} confirmado(s)`];
        if (r.pending) parts.push(`${r.pending} pendiente(s)`);
        if (r.conflicts) parts.push(`${r.conflicts} en conflicto: revisalos`);
        return { status: r.conflicts ? ("WARNING" as const) : ("OK" as const), summary: `${parts.join(" · ")}.`, details: r };
      },
    } satisfies Source,
  ]),
);

async function holidaysSync(): Promise<JobResult> {
  const year = new Date().getUTCFullYear();
  const results = [
    await syncHolidayYear(year),
    await syncHolidayYear(year + 1),
  ];
  return {
    status: "OK",
    summary: results
      .map(
        (r) =>
          `${r.year}: ${r.count} feriados${r.removed ? ` (${r.removed} eliminados)` : ""}`,
      )
      .join(" · "),
  };
}

// ─── Types ─────────────────────────────────────────────────────

export const JOB_TYPES: Record<
  JobType,
  {
    label: string;
    perProvince: boolean;
    sources: Record<string, Source> | null;
    description: string;
  }
> = {
  QUINIELA_PROGRAM: {
    label: "Programa de Quiniela",
    perProvince: true,
    sources: PROGRAM_SOURCES,
    description:
      "Baja el programa mensual oficial y deja un borrador para revisar cuando cambia. Lo compara con los horarios de la web.",
  },
  QUINIELA_RESULTS: {
    label: "Resultados de Quiniela",
    perProvince: false,
    sources: RESULT_SOURCES,
    description:
      "Lee los extractos (los 20 premios) desde la web de la fuente y los compara con las demás: coinciden, quedan confirmados.",
  },
  HOLIDAYS: {
    label: "Feriados",
    perProvince: false,
    sources: null,
    description:
      "Actualiza los feriados del año actual y el próximo desde ArgentinaDatos (solo referencia: no cierran agencias).",
  },
};

export function sourceInfo(job: Pick<JobConfig, "type" | "source">) {
  return job.source
    ? (JOB_TYPES[job.type].sources?.[job.source] ?? null)
    : null;
}

export function jobName(job: JobConfig) {
  const where = job.province?.name ?? (job.type === "QUINIELA_RESULTS" ? sourceInfo(job)?.label : null);
  return `${JOB_TYPES[job.type].label}${where ? ` · ${where}` : ""}`;
}

/** The handler of a job, from its type and source. */
export function handlerFor(job: JobConfig): (ctx: { runId: string }) => Promise<JobResult> {
  if (job.type === "HOLIDAYS") return holidaysSync;
  const type = JOB_TYPES[job.type];
  if (type.perProvince && !job.province) throw new JobConfigError(`${type.label}: falta la provincia.`);
  const source = sourceInfo(job);
  if (!source) throw new JobConfigError(`${type.label}: todavía no hay un lector para la fuente «${job.source ?? "sin fuente"}».`);
  const province = job.province;
  return ({ runId }) => source.run({ province, runId });
}

// ─── Jobs that always exist (created if missing) ───────────────

export const DEFAULT_JOBS: {
  key: string;
  type: JobType;
  provinceCode?: string;
  source?: string;
  schedule: string;
}[] = [
  {
    key: "quiniela-program-B",
    type: "QUINIELA_PROGRAM",
    provinceCode: "B",
    source: "loteria-gba",
    schedule: "0 8,14 * * *",
  },
  { key: "holidays-sync", type: "HOLIDAYS", schedule: "0 6 * * 1" },
  // Results: about an hour after each draw (10:15, 12, 15, 18, 21), Monday to Saturday…
  { key: "results-loteria-gba", type: "QUINIELA_RESULTS", source: "loteria-gba", schedule: "10 11,13,16,19,22 * * 1-6" },
  { key: "results-loteria-santafe", type: "QUINIELA_RESULTS", source: "loteria-santafe", schedule: "15 11,13,16,19,22 * * 1-6" },
  { key: "results-jugandoonline", type: "QUINIELA_RESULTS", source: "jugandoonline", schedule: "20 11,13,16,19,22 * * 1-6" },
  // …and notitimba at night, as its robots.txt asks, only for what is still not confirmed.
  { key: "results-notitimba", type: "QUINIELA_RESULTS", source: "notitimba", schedule: "0 3 * * *" },
];
