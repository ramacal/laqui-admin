import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAccess } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { MONTH_LABEL, ProgramError, type ProgramPlan, SLOT_LABEL, SLOT_ORDER, checkProgram, planProgram } from "@/lib/quiniela/program";
import { LOTTERY_SHORT } from "@/lib/quiniela/calendar";
import type { ProgramDraft } from "@/lib/quiniela/program-pdf";
import { SimpleForm } from "@/components/schedule/simple-form";
import { discardDraftAction, publishProgramAction } from "../actions";

export const metadata = { title: "Programa de Quiniela · Laqui" };

const SHORT: Record<string, string> = { PROVINCIA: "P", CIUDAD: "LC", CORDOBA: "CBA", SANTA_FE: "SF", ENTRE_RIOS: "ER", MONTEVIDEO: "MVD" };
const fmtDay = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("es-AR", { timeZone: "UTC", weekday: "short", day: "2-digit" });
const fmtDate = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const WD = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const ACTION = { SKIP: "sin sorteo", ADD: "se suma", TIME: "otro horario", PRIZE_EXPIRY: "otra caducidad" } as const;

/** Rule changes grouped by draw, lottery, date and time: "Matutina · Montevideo: juega Lun a Vie a las 15:00 desde 01/11". */
function groupChanges(plan: ProgramPlan) {
  const groups = new Map<string, { label: string; weekdays: number[] }>();
  for (const c of plan.ruleChanges) {
    const what = c.time ? `juega a las ${c.time}${c.previous ? ` (antes ${c.previous})` : ""}` : "deja de jugar";
    const label = `${SLOT_LABEL[c.slot]} · ${LOTTERY_SHORT[c.lottery] ?? c.lottery}: ${what} desde el ${fmtDate(c.from)}`;
    const g = groups.get(label) ?? { label, weekdays: [] };
    g.weekdays.push(c.weekday);
    groups.set(label, g);
  }
  return [...groups.values()].map((g) => `${g.label} · ${g.weekdays.sort((a, b) => a - b).map((w) => WD[w]).join(", ")}`);
}

// One monthly program: the draft to review (or what was published), day by day.
export default async function ProgramPage({ params }: { params: Promise<{ programId: string }> }) {
  const { programId } = await params;
  const access = await requireAccess();
  if (!access.isPlatformAdmin) notFound();
  const program = await prisma.provinceQuinielaMonthlyProgram.findUnique({
    where: { id: programId },
    include: { province: { select: { name: true } } },
  });
  if (!program) notFound();
  const draft = program.draft as unknown as ProgramDraft | null;
  const warnings = (program.warnings as string[] | null) ?? [];
  const draws = draft?.days.reduce((a, d) => a + d.draws.length, 0) ?? 0;
  const status = { DRAFT: "Borrador", PUBLISHED: "Publicado", ARCHIVED: "Archivado" }[program.status];
  let plan: ProgramPlan | null = null;
  let planError: string | null = null;
  if (program.status === "DRAFT")
    try {
      plan = await planProgram(program.id);
    } catch (err) {
      if (!(err instanceof ProgramError)) throw err;
      planError = err.message;
    }
  const check = program.status === "PUBLISHED" ? await checkProgram(program.id) : null;

  return (
    <main className="screen">
      <Link href="/panel/quiniela" className="back">
        ← Sorteos de Quiniela
      </Link>
      <div className="stack-xs">
        <h1>
          Programa de {MONTH_LABEL[program.month - 1]} {program.year}
        </h1>
        <p className="muted small">
          {program.province.name} · versión {program.version} · {status}
          {draft ? ` · ${draft.days.length} días, ${draws} sorteos` : ""}
          {draft?.rules.minBet ? ` · mínimo $${draft.rules.minBet}` : ""}
          {draft?.rules.maxBetPerLottery ? ` · máximo $${draft.rules.maxBetPerLottery.toLocaleString("es-AR")} por lotería` : ""}
        </p>
        {program.sourceUrl && (
          <a href={program.sourceUrl} target="_blank" rel="noreferrer" className="link small">
            Ver el PDF original de Lotería
          </a>
        )}
      </div>

      <section className={`card stack-xs ${warnings.length ? "" : "status is-open"}`}>
        <strong className={`small ${warnings.length ? "warn" : ""}`}>
          {warnings.length ? `${warnings.length} advertencia(s) al leerlo` : "Leído sin advertencias y coincide con los horarios de la web"}
        </strong>
        {warnings.map((w) => (
          <span key={w} className="small">
            · {w}
          </span>
        ))}
      </section>

      {program.status === "DRAFT" && (
        <section className="card stack-sm">
          <h2>Qué cambia al publicar</h2>
          <p className="small muted">
            El programa no se copia: se compara con la semana tipo y solo se guarda lo distinto. Si había otro publicado de este mes, queda archivado y
            se reemplazan sus excepciones.
          </p>
          {planError && <p className="small error">{planError}</p>}
          {plan && (
            <div className="stack-xs">
              <strong className="small">Semana tipo: {plan.ruleChanges.length ? `${groupChanges(plan).length} cambio(s)` : "sin cambios"}</strong>
              {groupChanges(plan).map((c) => (
                <span key={c} className="small">
                  · {c}
                </span>
              ))}
              <strong className="small">Excepciones de fecha: {plan.exceptions.length || "ninguna"}</strong>
              {plan.exceptions.map((e, i) => (
                <span key={i} className="small">
                  · {fmtDate(e.date)} {ACTION[e.action]}
                  {e.slot ? ` · ${SLOT_LABEL[e.slot]}` : e.action === "SKIP" ? " · todo el día" : ""}
                  {e.lottery ? ` · ${LOTTERY_SHORT[e.lottery] ?? e.lottery}` : ""}
                  {e.time ? ` · ${e.time}` : ""}
                  {e.prizeExpiry ? ` · caduca ${fmtDate(e.prizeExpiry)}` : ""}
                  {e.note ? ` (${e.note})` : ""}
                </span>
              ))}
              <strong className="small">Números de sorteo: se guarda el primero del mes de {plan.anchors.length} sorteo(s)/lotería(s).</strong>
              {plan.notes.map((n) => (
                <span key={n} className="small warn">
                  · {n}
                </span>
              ))}
              {plan.mismatches.length > 0 && (
                <>
                  <strong className="small warn">Después de publicar, igual quedaría distinto del programa:</strong>
                  {plan.mismatches.map((m) => (
                    <span key={m} className="small">
                      · {m}
                    </span>
                  ))}
                </>
              )}
            </div>
          )}
          <SimpleForm action={publishProgramAction.bind(null, program.id)} submitLabel="Publicar programa" />
          <form action={discardDraftAction.bind(null, program.id)}>
            <button type="submit" className="btn btn-secondary btn-sm">
              Descartar borrador
            </button>
          </form>
        </section>
      )}

      {check && (
        <section className={`card stack-xs ${check.length ? "" : "status is-open"}`}>
          <strong className={`small ${check.length ? "warn" : ""}`}>
            {check.length ? `El calendario difiere del programa en ${check.length} punto(s)` : "El calendario de este mes coincide con el programa oficial"}
          </strong>
          {check.map((m) => (
            <span key={m} className="small">
              · {m}
            </span>
          ))}
        </section>
      )}

      <section className="card stack-sm">
        <h2>Programa oficial, día por día</h2>
        <p className="small muted">P Provincia · LC Ciudad · CBA Córdoba · SF Santa Fe · ER Entre Ríos · MVD Montevideo. Entre paréntesis, el n.º de sorteo.</p>
        {!draft ? (
          <p className="small muted">Sin datos.</p>
        ) : (
          <div className="table-scroll">
            <table className="program-table small">
              <thead>
                <tr>
                  <th>Día</th>
                  {SLOT_ORDER.map((s) => (
                    <th key={s}>{SLOT_LABEL[s]}</th>
                  ))}
                  <th>Caduca</th>
                </tr>
              </thead>
              <tbody>
                {draft.days.map((day) => (
                  <tr key={day.date}>
                    <td>{fmtDay(day.date)}</td>
                    {SLOT_ORDER.map((slot) => {
                      const draw = day.draws.find((d) => d.slot === slot);
                      if (!draw) return <td key={slot} className="muted">—</td>;
                      const main = draw.lotteries.filter((l) => l.code !== "MONTEVIDEO");
                      const mvd = draw.lotteries.find((l) => l.code === "MONTEVIDEO");
                      return (
                        <td key={slot}>
                          <strong>{draw.time}</strong>
                          <br />
                          {main.map((l) => SHORT[l.code] ?? l.code).join(" ")}
                          {main[0]?.drawNumber ? ` (${main[0].drawNumber})` : ""}
                          {mvd && (
                            <>
                              <br />
                              MVD{mvd.drawNumber ? ` (${mvd.drawNumber})` : ""}
                            </>
                          )}
                        </td>
                      );
                    })}
                    <td>{day.prizeExpiry ? fmtDate(day.prizeExpiry) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
