import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAccess } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { MONTH_LABEL, SLOT_LABEL, drawsOn, provincePrograms } from "@/lib/quiniela/program";
import { todayIn } from "@/lib/schedule";
import { SimpleForm } from "@/components/schedule/simple-form";
import { runJobAction, setQuinielaRulesAction, uploadProgramAction } from "./actions";

export const metadata = { title: "Sorteos de Quiniela · Laqui" };
export const dynamic = "force-dynamic";

const TZ = "America/Argentina/Buenos_Aires";
// Provinces whose program is downloaded by a scheduled job (src/lib/jobs/definitions.ts).
const AUTOMATIC = ["B"];
const hhmm = (d: Date | null) => (d ? d.toISOString().slice(11, 16) : null);
const STATUS = { DRAFT: "borrador", PUBLISHED: "publicado", ARCHIVED: "archivado" } as const;
const LOTTERY_ORDER = ["PROVINCIA", "CIUDAD", "CORDOBA", "SANTA_FE", "ENTRE_RIOS", "MONTEVIDEO"];
const LOTTERY_SHORT: Record<string, string> = {
  PROVINCIA: "Provincia",
  CIUDAD: "Ciudad",
  CORDOBA: "Córdoba",
  SANTA_FE: "Santa Fe",
  ENTRE_RIOS: "Entre Ríos",
  MONTEVIDEO: "Montevideo",
};

// Platform admin: monthly Quiniela programs per province and today's draws.
export default async function QuinielaPage() {
  const access = await requireAccess();
  if (!access.isPlatformAdmin) notFound();
  const today = todayIn(TZ);
  // Provinces with an official program: imported automatically (B) or already loaded.
  const provinces = await prisma.province.findMany({
    where: {
      games: { some: { enabled: true, game: { code: "QUINIELA" } } },
      OR: [{ code: { in: AUTOMATIC } }, { programs: { some: {} } }],
    },
    include: { games: { where: { game: { code: "QUINIELA" } }, select: { cutoffMinutes: true, maxBetAmount: true } } },
    orderBy: { name: "asc" },
  });
  const data = await Promise.all(
    provinces.map(async (p) => ({ province: p, programs: await provincePrograms(p.id), today: await drawsOn(p.id, today) })),
  );

  return (
    <main className="screen">
      <Link href="/panel" className="back">
        ← Panel
      </Link>
      <div className="stack-xs">
        <h1>Sorteos de Quiniela</h1>
        <p className="muted small">El programa mensual de cada provincia define qué sorteos y loterías hay cada día. Se publica después de revisarlo.</p>
      </div>

      {data.map(({ province, programs, today: day }) => {
        const rules = province.games[0];
        const automatic = AUTOMATIC.includes(province.code);
        return (
          <section key={province.id} className="stack-sm">
            <h2>{province.name}</h2>

            <div className="card stack-xs">
              <strong className="small">Hoy</strong>
              {!day ? (
                <span className="small muted">Sin sorteos publicados para hoy.</span>
              ) : (
                day.draws.map((d) => (
                  <span key={d.id} className="small">
                    <strong>{hhmm(d.drawTime)}</strong> {SLOT_LABEL[d.slot]}
                    {d.closeTime ? ` (cierra ${hhmm(d.closeTime)})` : ""} · {[...d.lotteries]
                      .sort((a, b) => LOTTERY_ORDER.indexOf(a.lottery.code) - LOTTERY_ORDER.indexOf(b.lottery.code))
                      .map((l) => LOTTERY_SHORT[l.lottery.code] ?? l.lottery.name)
                      .join(", ")}
                  </span>
                ))
              )}
            </div>

            <div className="card stack-sm">
              <strong className="small">Programas</strong>
              {programs.length === 0 ? (
                <p className="small muted">Todavía no hay programas.</p>
              ) : (
                <ul className="list plain">
                  {programs.map((p) => {
                    const warnings = Array.isArray(p.warnings) ? p.warnings.length : 0;
                    return (
                      <li key={p.id}>
                        <Link href={`/panel/quiniela/${p.id}`} className="row exception-row link">
                          <span className="small">
                            {MONTH_LABEL[p.month - 1]} {p.year} · v{p.version}
                            {warnings ? ` · ${warnings} advertencia(s)` : ""}
                          </span>
                          <span className={`tag ${p.status === "PUBLISHED" ? "ok" : ""}`}>{STATUS[p.status]} ›</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
              {automatic && (
                <SimpleForm action={runJobAction.bind(null, "quiniela-program-B")} submitLabel="Buscar el programa en Lotería ahora" />
              )}
              <details>
                <summary className="small">Subir el PDF a mano</summary>
                <div className="spaced">
                  <SimpleForm action={uploadProgramAction.bind(null, province.code)} submitLabel="Leer PDF">
                    <input type="file" name="pdf" accept="application/pdf" className="input" required />
                  </SimpleForm>
                </div>
              </details>
            </div>

            <details className="card">
              <summary>Reglas de Quiniela en {province.name}</summary>
              <div className="spaced">
                <SimpleForm action={setQuinielaRulesAction.bind(null, province.id)} submitLabel="Guardar reglas">
                  <div className="grid-2">
                    <label className="field">
                      <span className="small muted">Cierre de apuestas (minutos antes del sorteo)</span>
                      <input name="cutoffMinutes" className="input" inputMode="numeric" defaultValue={rules?.cutoffMinutes ?? ""} placeholder="5" />
                    </label>
                    <label className="field">
                      <span className="small muted">Máximo por lotería ($)</span>
                      <input name="maxBetAmount" className="input" inputMode="decimal" defaultValue={rules?.maxBetAmount?.toString() ?? ""} />
                    </label>
                  </div>
                </SimpleForm>
              </div>
            </details>
          </section>
        );
      })}
    </main>
  );
}
