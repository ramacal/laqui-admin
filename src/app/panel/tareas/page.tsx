import Link from "next/link";
import { notFound } from "next/navigation";
import type { JobType } from "@/generated/prisma/enums";
import { requireAccess } from "@/lib/access";
import { ensureJobs } from "@/lib/jobs/runner";
import { JOB_TYPES } from "@/lib/jobs/definitions";
import { cronText } from "@/lib/jobs/cron-text";
import { prisma } from "@/lib/prisma";
import { RUN_STATUS, fmtDateTime } from "./run-status";

export const metadata = { title: "Tareas programadas · Laqui" };
export const dynamic = "force-dynamic";

// Platform admin: background jobs as a list (type, province, when, last and next run).
// Each one opens its detail with the run history.
export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string }>;
}) {
  const access = await requireAccess();
  if (!access.isPlatformAdmin) notFound();
  const { tipo } = await searchParams;
  const type = tipo && tipo in JOB_TYPES ? (tipo as JobType) : null;
  await ensureJobs();
  const jobs = await prisma.scheduledJob.findMany({
    where: type ? { type } : {},
    include: { province: { select: { name: true } } },
    orderBy: [{ type: "asc" }, { name: "asc" }],
  });
  const counts = await prisma.scheduledJob.groupBy({
    by: ["type"],
    _count: true,
  });
  const count = (t: JobType) => counts.find((c) => c.type === t)?._count ?? 0;

  return (
    <main className="screen">
      <div className="stack-xs">
        <h1>Tareas programadas</h1>
        <p className="muted small">
          Las corre el worker (<code>npm run worker</code>) en hora de Buenos
          Aires. Cada tarea tiene un tipo y, si es de una provincia, de qué web
          lee.
        </p>
      </div>

      <nav className="filter-chips" aria-label="Filtrar por tipo">
        <Link href="?" className={`chip ${type ? "" : "on"}`}>
          Todas
        </Link>
        {(Object.keys(JOB_TYPES) as JobType[]).map((t) => (
          <Link
            key={t}
            href={`?tipo=${t}`}
            className={`chip ${type === t ? "on" : ""}`}
          >
            {JOB_TYPES[t].label} <span className="muted">{count(t)}</span>
          </Link>
        ))}
      </nav>

      {jobs.length === 0 ? (
        <p className="card small muted">
          {type === "QUINIELA_RESULTS"
            ? "Todavía no hay tareas de resultados: falta definir de qué páginas se leen los extractos."
            : "No hay tareas de este tipo."}
        </p>
      ) : (
        <ul className="list rows card job-list">
          {jobs.map((job) => {
            const status = job.lastStatus ? RUN_STATUS[job.lastStatus] : null;
            return (
              <li key={job.id}>
                <Link
                  href={`/panel/tareas/${job.id}`}
                  className="job-row list-row"
                >
                  <span
                    className={`dot ${job.enabled ? (status?.tone ?? "") : "off"}`}
                    aria-hidden="true"
                  />
                  <span className="stack-xs job-what">
                    <strong>{JOB_TYPES[job.type].label}</strong>
                    <span className="small muted">
                      {job.province ? job.province.name : "Todo el país"}
                    </span>
                  </span>
                  <span className="small job-when">
                    {job.enabled ? (
                      cronText(job.schedule)
                    ) : (
                      <span className="muted">Pausada</span>
                    )}
                  </span>
                  <span className="stack-xs small job-last">
                    <span className="muted">Última</span>
                    <span>
                      {fmtDateTime(job.lastRunAt)}{" "}
                      {status && (
                        <span className={`status-chip ${status.tone}`}>
                          {status.label}
                        </span>
                      )}
                    </span>
                  </span>
                  <span className="stack-xs small job-next">
                    <span className="muted">Próxima</span>
                    <span>
                      {job.enabled ? fmtDateTime(job.nextRunAt) : "—"}
                    </span>
                  </span>
                  <span className="chevron" aria-hidden="true">
                    ›
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
