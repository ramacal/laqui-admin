import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAccess } from "@/lib/access";
import { ensureJobs } from "@/lib/jobs/runner";
import { prisma } from "@/lib/prisma";
import { SimpleForm } from "@/components/schedule/simple-form";
import { runJobAction, setJobEnabledAction } from "@/app/panel/quiniela/actions";

export const metadata = { title: "Tareas programadas · Laqui" };
export const dynamic = "force-dynamic";

const fmt = (d: Date | null) =>
  d ? d.toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";
const STATUS = { RUNNING: "corriendo", OK: "ok", WARNING: "revisar", ERROR: "error" } as const;
const STATUS_CLASS = { RUNNING: "", OK: "ok-text", WARNING: "warn", ERROR: "error" } as const;

// Platform admin: background jobs, when they run and what they did.
export default async function JobsPage() {
  const access = await requireAccess();
  if (!access.isPlatformAdmin) notFound();
  await ensureJobs();
  const [jobs, runs] = await Promise.all([
    prisma.scheduledJob.findMany({ orderBy: { name: "asc" } }),
    prisma.jobRun.findMany({
      orderBy: { startedAt: "desc" },
      take: 30,
      include: { job: { select: { name: true } }, triggeredBy: { select: { name: true } } },
    }),
  ]);
  const lastRun = new Map<string, (typeof runs)[number]>();
  for (const r of runs) if (!lastRun.has(r.jobId)) lastRun.set(r.jobId, r);

  return (
    <main className="screen">
      <Link href="/panel" className="back">
        ← Panel
      </Link>
      <div className="stack-xs">
        <h1>Tareas programadas</h1>
        <p className="muted small">
          Las corre el worker (<code>npm run worker</code>) según su horario, en hora de Buenos Aires. También se pueden correr a mano.
        </p>
      </div>

      <ul className="list">
        {jobs.map((job) => {
          const last = lastRun.get(job.id);
          return (
            <li key={job.id} className="card stack-sm">
              <div className="row">
                <div className="stack-xs">
                  <strong className={job.enabled ? "" : "muted"}>{job.name}</strong>
                  <span className="small muted">{job.description}</span>
                </div>
                {job.lastStatus && <span className={`tag ${job.lastStatus === "OK" ? "ok" : ""}`}>{STATUS[job.lastStatus]}</span>}
              </div>
              <span className="small muted">
                Horario <code>{job.schedule}</code> · última {fmt(job.lastRunAt)} · próxima {job.enabled ? fmt(job.nextRunAt) : "pausada"}
              </span>
              {last && (
                <p className={`small ${STATUS_CLASS[last.status]}`}>
                  {last.status === "ERROR" ? `Error: ${last.error}` : last.summary}
                </p>
              )}
              <div className="row-actions">
                <SimpleForm action={runJobAction.bind(null, job.key)} submitLabel="Correr ahora" />
                <form action={setJobEnabledAction.bind(null, job.key, !job.enabled)}>
                  <button type="submit" className="btn btn-secondary btn-sm">
                    {job.enabled ? "Pausar" : "Reactivar"}
                  </button>
                </form>
              </div>
            </li>
          );
        })}
      </ul>

      <section className="card stack-sm">
        <h2>Últimas ejecuciones</h2>
        {runs.length === 0 ? (
          <p className="muted small">Todavía no corrió ninguna.</p>
        ) : (
          <ul className="list plain">
            {runs.map((r) => (
              <li key={r.id} className="row exception-row">
                <div className="stack-xs">
                  <strong className="small">
                    {fmt(r.startedAt)} · {r.job.name}
                  </strong>
                  <span className="small muted">
                    {r.trigger === "MANUAL" ? `a mano${r.triggeredBy ? ` (${r.triggeredBy.name})` : ""}` : "programada"}
                    {r.finishedAt ? ` · ${Math.max(1, Math.round((r.finishedAt.getTime() - r.startedAt.getTime()) / 1000))} s` : ""}
                    {" · "}
                    {r.status === "ERROR" ? r.error : r.summary}
                  </span>
                </div>
                <strong className={`small ${STATUS_CLASS[r.status]}`}>{STATUS[r.status]}</strong>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
