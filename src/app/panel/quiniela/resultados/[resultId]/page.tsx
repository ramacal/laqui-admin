import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAccess } from "@/lib/access";
import { LOTTERY_SHORT, SLOT_LABEL, isoDate } from "@/lib/quiniela/calendar";
import {
  RESULT_SOURCES,
  readingsOf,
  resultDetail,
  sourceLabel,
} from "@/lib/quiniela/results/store";
import { RESULT_STATUS } from "@/components/quiniela/results-grid";
import { resolveResultAction, unresolveResultAction } from "../../actions";

export const metadata = { title: "Resultado de Quiniela · Laqui" };
export const dynamic = "force-dynamic";

const TZ = "America/Argentina/Buenos_Aires";
const ddmmyyyy = (iso: string) =>
  `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
const when = (d: Date) =>
  d.toLocaleString("es-AR", {
    timeZone: TZ,
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

/** The 20 prizes in two columns (1–10, 11–20), like the official extracts. */
function Prizes({
  numbers,
  highlight = [],
}: {
  numbers: string[];
  highlight?: number[];
}) {
  return (
    <ol className="prizes">
      {numbers.map((n, i) => (
        <li
          key={i}
          className={`${i === 0 ? "is-head" : ""} ${highlight.includes(i) ? "is-diff" : ""}`}
        >
          <span className="pos">{String(i + 1).padStart(2, "0")}</span>
          <span className="num">{n}</span>
        </li>
      ))}
    </ol>
  );
}

// Platform admin: one draw's result, what every source published, and (in conflict) the choice.
export default async function ResultPage({
  params,
}: {
  params: Promise<{ resultId: string }>;
}) {
  const { resultId } = await params;
  const access = await requireAccess();
  if (!access.isPlatformAdmin) notFound();
  const result = await resultDetail(resultId);
  if (!result) notFound();
  const readings = await readingsOf(result);
  const date = isoDate(result.date);
  const status = RESULT_STATUS[result.status];
  const numbers = result.numbers.map((n) => n.number);
  const versions = readings.map((r) => ({ ...r, list: r.numbers.split(",") }));
  // Positions where the sources disagree.
  const diff = Array.from({ length: 20 }, (_, i) => i).filter(
    (i) => new Set(versions.map((v) => v.list[i])).size > 1,
  );

  return (
    <main className="screen">
      <Link
        href={`/panel/quiniela?vista=resultados&fecha=${date}`}
        className="back"
      >
        ← Resultados del {ddmmyyyy(date)}
      </Link>

      <div className="row page-head">
        <div className="stack-xs">
          <div className="row-start">
            <h1>
              {SLOT_LABEL[result.slot]} ·{" "}
              {LOTTERY_SHORT[result.lottery.code] ?? result.lottery.name}
            </h1>
            <span className={`status-chip ${status.tone}`}>{status.label}</span>
          </div>
          <span className="muted">
            {ddmmyyyy(date)} · {result.sources} fuente(s) coinciden
            {result.letters ? ` · letras ${result.letters}` : ""}
          </span>
        </div>
      </div>

      {result.resolvedBy && (
        <div className="card row">
          <span className="small">
            Elegido a mano por <strong>{result.resolvedBy.name}</strong>
            {result.resolvedAt ? ` el ${when(result.resolvedAt)}` : ""}: estos
            números quedan aunque las fuentes no coincidan.
          </span>
          <form action={unresolveResultAction.bind(null, result.id)}>
            <button type="submit" className="btn btn-secondary btn-sm">
              Volver a lo que dicen las fuentes
            </button>
          </form>
        </div>
      )}

      {result.status === "CONFLICT" && !result.resolvedBy ? (
        <section className="card stack-sm">
          <h2>Las fuentes no coinciden</h2>
          <p className="small muted">
            Difieren en {diff.length} posición(es), marcadas en rojo. Elegí la
            versión correcta (en lo posible, la de la lotería oficial).
          </p>
          <div className="versions">
            {versions.map((v) => (
              <div key={v.id} className="version stack-sm">
                <div className="row">
                  <strong>
                    {sourceLabel(v.source)}{" "}
                    {v.official && (
                      <span className="status-chip ok">oficial</span>
                    )}
                  </strong>
                  <span className="small muted">{when(v.readAt)}</span>
                </div>
                <Prizes numbers={v.list} highlight={diff} />
                <form action={resolveResultAction.bind(null, result.id, v.id)}>
                  <button type="submit" className="btn btn-primary btn-sm">
                    Usar esta versión
                  </button>
                </form>
              </div>
            ))}
          </div>
        </section>
      ) : (
        <section className="card stack-sm">
          <h2>Extracto</h2>
          {numbers.length === 20 ? (
            <Prizes numbers={numbers} />
          ) : (
            <p className="small muted">Todavía sin números.</p>
          )}
        </section>
      )}

      <section className="card stack-sm">
        <h2>Qué publicó cada fuente</h2>
        <ul className="list rows">
          {versions.map((v) => {
            const agrees =
              numbers.length === 20 && v.numbers === numbers.join(",");
            const src = RESULT_SOURCES[v.source];
            return (
              <li key={v.id} className="list-row row">
                <span className="stack-xs">
                  <strong className="small">
                    {src ? (
                      <a
                        href={src.url}
                        target="_blank"
                        rel="noreferrer"
                        className="link"
                      >
                        {src.label}
                      </a>
                    ) : (
                      v.source
                    )}{" "}
                    {v.official && (
                      <span className="status-chip ok">oficial</span>
                    )}
                  </strong>
                  <span className="small muted">
                    Leído {when(v.readAt)}
                    {v.changedAt.getTime() !== v.readAt.getTime()
                      ? ` · cambió ${when(v.changedAt)}`
                      : ""}
                    {v.letters ? ` · letras ${v.letters}` : ""}
                  </span>
                </span>
                <span
                  className={`status-chip ${numbers.length !== 20 ? "" : agrees ? "ok" : "error"}`}
                >
                  {numbers.length !== 20
                    ? `cabeza ${v.list[0]}`
                    : agrees
                      ? "coincide"
                      : "no coincide"}
                </span>
              </li>
            );
          })}
        </ul>
        {versions.length < 2 && (
          <p className="small muted">
            Con una sola fuente queda pendiente hasta que otra publique lo mismo
            (salvo que sea la lotería oficial).
          </p>
        )}
      </section>
    </main>
  );
}
