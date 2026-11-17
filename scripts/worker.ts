// Background worker: runs the scheduled jobs (src/lib/jobs) when they are due.
//   npm run worker            -> keeps running, checks every 30 seconds
//   npm run worker -- --once  -> runs what is due now and exits (for a system cron)
// It shares the database and the code with the web app; it can run on the same machine
// or apart. Only one worker should run at a time (a running job is not started twice).
import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { ensureJobs, runDueJobs } from "../src/lib/jobs/runner";

const INTERVAL_MS = 30_000;
let stopping = false;

async function tick() {
  const runs = await runDueJobs();
  for (const r of runs) console.log(`[${new Date().toISOString()}] ${r.status} ${r.summary ?? r.error ?? ""}`);
}

async function main() {
  await ensureJobs();
  const jobs = await prisma.scheduledJob.findMany({ orderBy: { name: "asc" } });
  for (const j of jobs) console.log(`· ${j.name} (${j.schedule})${j.enabled ? "" : " — pausada"} → próxima: ${j.nextRunAt?.toISOString() ?? "-"}`);
  if (process.argv.includes("--once")) return tick();
  console.log("Worker andando. Ctrl+C para detenerlo.");
  while (!stopping) {
    try {
      await tick();
    } catch (err) {
      console.error(err);
    }
    await new Promise((r) => setTimeout(r, INTERVAL_MS));
  }
}

process.on("SIGINT", () => (stopping = true));
process.on("SIGTERM", () => (stopping = true));
main().finally(() => prisma.$disconnect());
