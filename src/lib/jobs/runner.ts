// Runs scheduled jobs and keeps their history (ScheduledJob / JobRun). Used by the worker
// (scripts/worker.ts, on schedule) and by the admin's "Correr ahora" button.
import { CronExpressionParser } from "cron-parser";
import type { JobTrigger } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import {
  DEFAULT_JOBS,
  JOB_TYPES,
  JobConfigError,
  handlerFor,
  jobName,
  sourceInfo,
} from "@/lib/jobs/definitions";

const TZ = "America/Argentina/Buenos_Aires";
const STALE_MS = 30 * 60_000; // a RUNNING run older than this is considered dead (worker crashed)

export class JobError extends Error {}

export function nextRun(schedule: string, from = new Date()) {
  return CronExpressionParser.parse(schedule, { tz: TZ, currentDate: from })
    .next()
    .toDate();
}

const withProvince = {
  province: { select: { id: true, code: true, name: true } },
} as const;

/** Name and description of a job, from its type, province and source. */
function labels(job: Parameters<typeof jobName>[0]) {
  const source = sourceInfo(job);
  return {
    name: jobName(job),
    description: `${JOB_TYPES[job.type].description}${source ? ` Fuente: ${source.label}.` : ""}`,
  };
}

/** Creates the default jobs that are missing, and refreshes every job's name and description. */
export async function ensureJobs() {
  for (const def of DEFAULT_JOBS) {
    if (await prisma.scheduledJob.findUnique({ where: { key: def.key } }))
      continue;
    const province = def.provinceCode
      ? await prisma.province.findUnique({ where: { code: def.provinceCode } })
      : null;
    if (def.provinceCode && !province) continue; // reference data not loaded yet
    await prisma.scheduledJob.create({
      data: {
        key: def.key,
        type: def.type,
        provinceId: province?.id ?? null,
        source: def.source ?? null,
        name: def.key,
        schedule: def.schedule,
        nextRunAt: nextRun(def.schedule),
      },
    });
  }
  for (const job of await prisma.scheduledJob.findMany({
    include: withProvince,
  })) {
    const l = labels(job);
    if (job.name !== l.name || job.description !== l.description)
      await prisma.scheduledJob.update({ where: { id: job.id }, data: l });
  }
}

/** Runs one job now and records the run. Throws JobError if it is already running. */
export async function runJob(
  key: string,
  trigger: JobTrigger,
  userId?: string | null,
) {
  await ensureJobs();
  const job = await prisma.scheduledJob.findUnique({
    where: { key },
    include: withProvince,
  });
  if (!job) throw new JobError(`No hay una tarea «${key}».`);
  let handler: ReturnType<typeof handlerFor>;
  try {
    handler = handlerFor(job);
  } catch (err) {
    if (err instanceof JobConfigError) throw new JobError(err.message);
    throw err;
  }
  const running = await prisma.jobRun.findFirst({
    where: { jobId: job.id, status: "RUNNING" },
    orderBy: { startedAt: "desc" },
  });
  if (running && Date.now() - running.startedAt.getTime() < STALE_MS)
    throw new JobError("La tarea ya se está ejecutando.");
  if (running)
    await prisma.jobRun.update({
      where: { id: running.id },
      data: {
        status: "ERROR",
        finishedAt: new Date(),
        error: "Interrumpida (el proceso se detuvo).",
      },
    });

  const run = await prisma.jobRun.create({
    data: { jobId: job.id, trigger, triggeredById: userId ?? null },
  });
  await prisma.scheduledJob.update({
    where: { id: job.id },
    data: { lastRunAt: run.startedAt, lastStatus: "RUNNING" },
  });
  let status: "OK" | "WARNING" | "ERROR";
  try {
    const result = await handler({ runId: run.id });
    status = result.status;
    await prisma.jobRun.update({
      where: { id: run.id },
      data: {
        status,
        finishedAt: new Date(),
        summary: result.summary,
        details: (result.details ?? undefined) as object | undefined,
      },
    });
  } catch (err) {
    status = "ERROR";
    const message = err instanceof Error ? err.message : String(err);
    await prisma.jobRun.update({
      where: { id: run.id },
      data: { status, finishedAt: new Date(), error: message.slice(0, 5000) },
    });
  }
  await prisma.scheduledJob.update({
    where: { id: job.id },
    data: {
      lastStatus: status,
      ...(trigger === "SCHEDULE" ? { nextRunAt: nextRun(job.schedule) } : {}),
    },
  });
  return prisma.jobRun.findUniqueOrThrow({ where: { id: run.id } });
}

/** Runs every enabled job whose time has come (one after the other). */
export async function runDueJobs(now = new Date()) {
  const due = await prisma.scheduledJob.findMany({
    where: { enabled: true, nextRunAt: { lte: now } },
    orderBy: { nextRunAt: "asc" },
  });
  const runs = [];
  for (const job of due) {
    try {
      runs.push(await runJob(job.key, "SCHEDULE"));
    } catch (err) {
      if (!(err instanceof JobError)) throw err;
      // Already running elsewhere: try again on the next schedule.
      await prisma.scheduledJob.update({
        where: { id: job.id },
        data: { nextRunAt: nextRun(job.schedule) },
      });
    }
  }
  return runs;
}

export async function setJobEnabled(key: string, enabled: boolean) {
  const job = await prisma.scheduledJob.findUniqueOrThrow({ where: { key } });
  await prisma.scheduledJob.update({
    where: { key },
    data: { enabled, nextRunAt: enabled ? nextRun(job.schedule) : null },
  });
}
