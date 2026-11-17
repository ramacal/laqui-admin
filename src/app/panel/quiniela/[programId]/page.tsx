import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAccess } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { MONTH_LABEL, SLOT_LABEL, SLOT_ORDER } from "@/lib/quiniela/program";
import type { ProgramDraft } from "@/lib/quiniela/program-pdf";
import { SimpleForm } from "@/components/schedule/simple-form";
import { discardDraftAction, publishProgramAction } from "../actions";

export const metadata = { title: "Programa de Quiniela · Laqui" };

const SHORT: Record<string, string> = { PROVINCIA: "P", CIUDAD: "LC", CORDOBA: "CBA", SANTA_FE: "SF", ENTRE_RIOS: "ER", MONTEVIDEO: "MVD" };
const fmtDay = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("es-AR", { timeZone: "UTC", weekday: "short", day: "2-digit" });
const fmtDate = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

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
          <h2>Publicar</h2>
          <p className="small muted">Al publicarlo, define qué sorteos y loterías se pueden jugar cada día del mes. Si había otro publicado de este mes, queda archivado.</p>
          <SimpleForm action={publishProgramAction.bind(null, program.id)} submitLabel="Publicar programa" />
          <form action={discardDraftAction.bind(null, program.id)}>
            <button type="submit" className="btn btn-secondary btn-sm">
              Descartar borrador
            </button>
          </form>
        </section>
      )}

      <section className="card stack-sm">
        <h2>Día por día</h2>
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
