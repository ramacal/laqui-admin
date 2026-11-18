import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAccess } from "@/lib/access";
import { JOB_TYPES, sourceInfo } from "@/lib/jobs/definitions";
import { cronText } from "@/lib/jobs/cron-text";
import { prisma } from "@/lib/prisma";
import { SimpleForm } from "@/components/schedule/simple-form";
import {
  runJobAction,
  setJobEnabledAction,
} from "@/app/panel/quiniela/actions";
import { RUN_STATUS, fmtDateTime } from "../run-status";

export const metadata = { title: "Tarea programada · Laqui" };
export const dynamic = "force-dynamic";

const PAGE = 50;

const duration = (start: Date, end: Date | null) => {
  if (!end) return null;
  const s = Math.max(1, Math.round((end.getTime() - start.getTime()) / 1000));
  return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${s % 60} s`;
};

/** The parts of a run's details worth showing: warnings, a link to the draft, the rest as data. */
function RunDetails({ details }: { details: unknown }) {
  if (!details || typeof details !== "object") return null;
  const d = details as Record<string, unknown>;
  const warnings = Array.isArray(d.warnings) ? (d.warnings as string[]) : [];
  const rest = Object.fromEntries(
    Object.entries(d).filter(([k]) => k !== "warnings" && k !== "programId"),
  );
  return (
    <div className="stack-xs">
      {typeof d.programId === "string" && (
        <Link href={`/panel/quiniela/${d.programId}`} className="link small">
          Ver el programa ›
        </Link>
      )}
      {warnings.length > 0 && (
        <>
          <strong className="small">Advertencias</strong>
          <ul className="small plain-list">
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </>
      )}
      {Object.keys(rest).length > 0 && (
        <pre className="code-block">{JSON.stringify(rest, null, 2)}</pre>
      )}
    </div>
  );
}

// Platform admin: one scheduled job: its configuration, actions and run history.
export default async function JobPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = await params;
  const access = await requireAccess();
  if (!access.isPlatformAdmin) notFound();
  const job = await prisma.scheduledJob.findUnique({
    where: { id: jobId },
    include: {
      province: { select: { name: true } },
      runs: {
        orderBy: { startedAt: "desc" },
        take: PAGE,
        include: { triggeredBy: { select: { name: true } } },
      },
      _count: { select: { runs: true } },
    },
  });
  if (!job) notFound();
  const type = JOB_TYPES[job.type];
  const source = sourceInfo(job);
  const last = job.lastStatus ? RUN_STATUS[job.lastStatus] : null;

  return (
    <main className="screen">
      <Link href="/panel/tareas" className="back">
        ← Tareas programadas
      </Link>

      <div className="row page-head">
        <div className="stack-xs">
          <div className="row-start">
            <h1>{type.label}</h1>
            {job.enabled ? (
              <span className="status-chip ok">Activa</span>
            ) : (
              <span className="status-chip">Pausada</span>
            )}
          </div>
          <span className="muted">
            {job.province ? job.province.name : "Todo el país"}
          </span>
        </div>
        <div className="row-actions">
          <SimpleForm
            action={runJobAction.bind(null, job.key)}
            submitLabel="Correr ahora"
            className="inline-form"
          />
          <form action={setJobEnabledAction.bind(null, job.key, !job.enabled)}>
            <button type="submit" className="btn btn-secondary">
              {job.enabled ? "Pausar" : "Reactivar"}
            </button>
          </form>
        </div>
      </div>

      <section className="card">
        <dl className="facts facts-grid">
          <div>
            <dt>Qué hace</dt>
            <dd>{type.description}</dd>
          </div>
          <div>
            <dt>Fuente</dt>
            <dd>
              {source ? (
                <a
                  href={source.url}
                  target="_blank"
                  rel="noreferrer"
                  className="link"
                >
                  {source.label}
                </a>
              ) : (
                (job.source ?? "—")
              )}
            </dd>
          </div>
          <div>
            <dt>Cuándo corre</dt>
            <dd>
              {cronText(job.schedule)}{" "}
              <code className="small">{job.schedule}</code>
            </dd>
          </div>
          <div>
            <dt>Última ejecución</dt>
            <dd>
              {fmtDateTime(job.lastRunAt)}{" "}
              {last && (
                <span className={`status-chip ${last.tone}`}>{last.label}</span>
              )}
            </dd>
          </div>
          <div>
            <dt>Próxima</dt>
            <dd>{job.enabled ? fmtDateTime(job.nextRunAt) : "Pausada"}</dd>
          </div>
          <div>
            <dt>Clave interna</dt>
            <dd>
              <code className="small">{job.key}</code>
            </dd>
          </div>
        </dl>
      </section>

      <section className="stack-sm">
        <h2>
          Ejecuciones <span className="count">{job._count.runs}</span>
        </h2>
        {job.runs.length === 0 ? (
          <p className="card small muted">Todavía no corrió.</p>
        ) : (
          <ul className="list rows card run-list">
            {job.runs.map((r) => {
              const s = RUN_STATUS[r.status];
              const hasMore =
                r.error ||
                (r.details &&
                  typeof r.details === "object" &&
                  Object.keys(r.details).length > 0);
              const line = (
                <span className="run-row">
                  <span className="run-when small">
                    <strong>{fmtDateTime(r.startedAt)}</strong>
                    <span className="muted">
                      {r.trigger === "MANUAL"
                        ? `A mano${r.triggeredBy ? ` · ${r.triggeredBy.name}` : ""}`
                        : "Programada"}
                      {duration(r.startedAt, r.finishedAt)
                        ? ` · ${duration(r.startedAt, r.finishedAt)}`
                        : ""}
                    </span>
                  </span>
                  <span className={`status-chip ${s.tone}`}>{s.label}</span>
                  <span
                    className={`small run-summary ${r.status === "ERROR" ? "error" : ""}`}
                  >
                    {r.status === "ERROR"
                      ? (r.error?.split("\n")[0] ?? "Error")
                      : (r.summary ?? "")}
                  </span>
                </span>
              );
              return (
                <li key={r.id}>
                  {hasMore ? (
                    <details className="run-item">
                      <summary className="list-row">{line}</summary>
                      <div className="run-more">
                        {r.error && (
                          <pre className="code-block error">{r.error}</pre>
                        )}
                        <RunDetails details={r.details} />
                      </div>
                    </details>
                  ) : (
                    <div className="list-row">{line}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {job._count.runs > PAGE && (
          <p className="small muted">Se muestran las últimas {PAGE}.</p>
        )}
      </section>
    </main>
  );
}
