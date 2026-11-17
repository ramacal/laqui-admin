// Runs scheduled jobs and keeps their history (ScheduledJob / JobRun). Used by the worker
// (scripts/worker.ts, on schedule) and by the admin's "Correr ahora" button.
import { CronExpressionParser } from "cron-parser";
import type { JobTrigger } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { JOBS, jobDefinition } from "@/lib/jobs/definitions";

const TZ = "America/Argentina/Buenos_Aires";
const STALE_MS = 30 * 60_000; // a RUNNING run older than this is considered dead (worker crashed)

export class JobError extends Error {}

export function nextRun(schedule: string, from = new Date()) {
  return CronExpressionParser.parse(schedule, { tz: TZ, currentDate: from }).next().toDate();
}

/** Creates the jobs defined in code that are missing, and refreshes their names. */
export async function ensureJobs() {
  for (const def of JOBS) {
    const existing = await prisma.scheduledJob.findUnique({ where: { key: def.key } });
    if (!existing)
      await prisma.scheduledJob.create({
        data: { key: def.key, name: def.name, description: def.description, schedule: def.schedule, nextRunAt: nextRun(def.schedule) },
      });
    else if (existing.name !== def.name || existing.description !== def.description)
      await prisma.scheduledJob.update({ where: { key: def.key }, data: { name: def.name, description: def.description } });
  }
}

/** Runs one job now and records the run. Throws JobError if it is already running. */
export async function runJob(key: string, trigger: JobTrigger, userId?: string | null) {
  const def = jobDefinition(key);
  if (!def) throw new JobError(`No hay una tarea «${key}».`);
  await ensureJobs();
  const job = await prisma.scheduledJob.findUniqueOrThrow({ where: { key } });
  const running = await prisma.jobRun.findFirst({ where: { jobId: job.id, status: "RUNNING" }, orderBy: { startedAt: "desc" } });
  if (running && Date.now() - running.startedAt.getTime() < STALE_MS) throw new JobError("La tarea ya se está ejecutando.");
  if (running) await prisma.jobRun.update({ where: { id: running.id }, data: { status: "ERROR", finishedAt: new Date(), error: "Interrumpida (el proceso se detuvo)." } });

  const run = await prisma.jobRun.create({ data: { jobId: job.id, trigger, triggeredById: userId ?? null } });
  await prisma.scheduledJob.update({ where: { id: job.id }, data: { lastRunAt: run.startedAt, lastStatus: "RUNNING" } });
  let status: "OK" | "WARNING" | "ERROR";
  try {
    const result = await def.run();
    status = result.status;
    await prisma.jobRun.update({
      where: { id: run.id },
      data: { status, finishedAt: new Date(), summary: result.summary, details: (result.details ?? undefined) as object | undefined },
    });
  } catch (err) {
    status = "ERROR";
    const message = err instanceof Error ? err.message : String(err);
    await prisma.jobRun.update({ where: { id: run.id }, data: { status, finishedAt: new Date(), error: message.slice(0, 5000) } });
  }
  await prisma.scheduledJob.update({
    where: { id: job.id },
    data: { lastStatus: status, ...(trigger === "SCHEDULE" ? { nextRunAt: nextRun(job.schedule) } : {}) },
  });
  return prisma.jobRun.findUniqueOrThrow({ where: { id: run.id } });
}

/** Runs every enabled job whose time has come (one after the other). */
export async function runDueJobs(now = new Date()) {
  const due = await prisma.scheduledJob.findMany({ where: { enabled: true, nextRunAt: { lte: now } }, orderBy: { nextRunAt: "asc" } });
  const runs = [];
  for (const job of due) {
    try {
      runs.push(await runJob(job.key, "SCHEDULE"));
    } catch (err) {
      if (!(err instanceof JobError)) throw err;
      // Already running elsewhere: try again on the next schedule.
      await prisma.scheduledJob.update({ where: { id: job.id }, data: { nextRunAt: nextRun(job.schedule) } });
    }
  }
  return runs;
}

export async function setJobEnabled(key: string, enabled: boolean) {
  const job = await prisma.scheduledJob.findUniqueOrThrow({ where: { key } });
  await prisma.scheduledJob.update({ where: { key }, data: { enabled, nextRunAt: enabled ? nextRun(job.schedule) : null } });
}
