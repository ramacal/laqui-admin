import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAccess } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { MONTH_LABEL, provincePrograms } from "@/lib/quiniela/program";
import {
  addDays,
  heldOn,
  loadCalendar,
  weekdayOf,
} from "@/lib/quiniela/calendar";
import { todayIn } from "@/lib/schedule";
import { lastResultDate, resultsOn } from "@/lib/quiniela/results/store";
import { ResultsGrid } from "@/components/quiniela/results-grid";
import { SimpleForm } from "@/components/schedule/simple-form";
import {
  BaseWeekGrid,
  WeekGrid,
  WeekGridLegend,
} from "@/components/quiniela/week-grid";
import {
  runJobAction,
  setQuinielaRulesAction,
  uploadProgramAction,
} from "./actions";

export const metadata = { title: "Sorteos de Quiniela · Laqui" };
export const dynamic = "force-dynamic";

const TZ = "America/Argentina/Buenos_Aires";
// Provinces whose program is downloaded by a scheduled job (src/lib/jobs/definitions.ts).
const AUTOMATIC = ["B"];
const STATUS = {
  DRAFT: "Borrador",
  PUBLISHED: "Publicado",
  ARCHIVED: "Archivado",
} as const;
const TABS = [
  { key: "semana", label: "Esta semana" },
  { key: "resultados", label: "Resultados" },
  { key: "habitual", label: "Semana habitual" },
  { key: "programa", label: "Programa oficial" },
  { key: "reglas", label: "Reglas" },
] as const;
type Tab = (typeof TABS)[number]["key"];

const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const mondayOf = (iso: string) => addDays(iso, -((weekdayOf(iso) + 6) % 7));
const cap = (s: string) => `${s[0].toUpperCase()}${s.slice(1)}`;
const dayLabel = (iso: string) =>
  cap(new Date(`${iso}T12:00:00Z`).toLocaleDateString("es-AR", { timeZone: "UTC", weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" }));
const ISO = /^\d{4}-\d{2}-\d{2}$/;

// Platform admin: Quiniela per province, in tabs: this week (grid), the usual week, the official
// monthly programs and the province rules.
export default async function QuinielaPage({
  searchParams,
}: {
  searchParams: Promise<{ semana?: string; vista?: string; fecha?: string }>;
}) {
  const access = await requireAccess();
  if (!access.isPlatformAdmin) notFound();
  const { semana, vista, fecha } = await searchParams;
  const tab: Tab = TABS.some((t) => t.key === vista)
    ? (vista as Tab)
    : "semana";
  const today = todayIn(TZ);
  const monday = mondayOf(semana && ISO.test(semana) ? semana : today);
  const sunday = addDays(monday, 6);
  // Results tab: the requested day, or the latest one with results.
  const resultDate =
    fecha && ISO.test(fecha) ? fecha : ((await lastResultDate(today)) ?? today);
  const dayResults = tab === "resultados" ? await resultsOn(resultDate) : [];
  const nowMinutes = (() => {
    const t = new Date().toLocaleTimeString("en-GB", {
      timeZone: TZ,
      hour: "2-digit",
      minute: "2-digit",
    });
    return Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  })();
  const months = [...new Set([monday.slice(0, 7), sunday.slice(0, 7)])];
  const href = (params: { vista?: Tab; semana?: string }) => {
    const q = new URLSearchParams();
    const v = params.vista ?? tab;
    if (v !== "semana") q.set("vista", v);
    const s =
      params.semana ?? (monday !== mondayOf(today) ? monday : undefined);
    if (s && v === "semana") q.set("semana", s);
    return `?${q.toString()}`;
  };

  // Provinces with an official program: imported automatically (B) or already loaded.
  const provinces = await prisma.province.findMany({
    where: {
      games: { some: { enabled: true, game: { code: "QUINIELA" } } },
      OR: [{ code: { in: AUTOMATIC } }, { programs: { some: {} } }],
    },
    include: {
      games: {
        where: { game: { code: "QUINIELA" } },
        select: {
          cutoffMinutes: true,
          maxBetAmount: true,
          prizeExpiryDays: true,
        },
      },
    },
    orderBy: { name: "asc" },
  });
  const data = await Promise.all(
    provinces.map(async (p) => {
      const [programs, calendar] = await Promise.all([
        provincePrograms(p.id),
        loadCalendar(p.id, monday, sunday),
      ]);
      const resultCal =
        tab === "resultados"
          ? await loadCalendar(p.id, resultDate, resultDate)
          : null;
      const held = resultCal ? resultCal.heldOn(resultDate) : [];
      const days = calendar
        .days(monday, sunday)
        .map((d) => ({ ...d, usual: heldOn(d.date, calendar.data.rules, []) }));
      return { province: p, programs, days, rules: calendar.data.rules, held };
    }),
  );

  return (
    <main className="screen">
      <div className="stack-xs">
        <h1>Sorteos de Quiniela</h1>
        <p className="muted small">
          Cada provincia tiene una semana habitual; los días distintos se marcan
          solos con el programa oficial de Lotería.
        </p>
      </div>

      {data.map(({ province, programs, days, rules: weekRules, held }) => {
        const rules = province.games[0];
        const automatic = AUTOMATIC.includes(province.code);
        const thisMonth = programs.find(
          (p) =>
            `${p.year}-${String(p.month).padStart(2, "0")}` ===
              today.slice(0, 7) && p.status === "PUBLISHED",
        );
        const drafts = programs.filter((p) => p.status === "DRAFT");
        return (
          <section key={province.id} className="card province-box">
            {/* Header: province, how this month is covered, the main action. */}
            <div className="box-head">
              <div className="stack-xs">
                <h2>{province.name}</h2>
                <div className="row-start">
                  {thisMonth ? (
                    <span className="status-chip ok">
                      Programa de {MONTH_LABEL[thisMonth.month - 1]} publicado
                    </span>
                  ) : (
                    <span className="status-chip warn">
                      Sin programa oficial este mes
                    </span>
                  )}
                  {drafts.length > 0 && (
                    <Link
                      href={`/panel/quiniela/${drafts[0].id}`}
                      className="status-chip warn"
                    >
                      {drafts.length} borrador(es) para revisar ›
                    </Link>
                  )}
                </div>
              </div>
              <Link
                href={`/panel/quiniela/provincia/${province.id}?semana=${monday}`}
                className="btn btn-primary btn-sm"
              >
                Cargar cambios
              </Link>
            </div>

            <nav className="tabs" aria-label={`Quiniela en ${province.name}`}>
              {TABS.map((t) => (
                <Link
                  key={t.key}
                  href={href({ vista: t.key })}
                  className={`tab ${tab === t.key ? "is-active" : ""}`}
                  aria-current={tab === t.key ? "page" : undefined}
                >
                  {t.label}
                </Link>
              ))}
            </nav>

            <div className="box-body stack-sm">
              {tab === "semana" && (
                <>
                  <div className="row week-bar">
                    <div className="week-nav">
                      <Link
                        href={href({ semana: addDays(monday, -7) })}
                        className="icon-link"
                        aria-label="Semana anterior"
                      >
                        ‹
                      </Link>
                      <strong>
                        {ddmm(monday)} al {ddmm(sunday)}
                      </strong>
                      <Link
                        href={href({ semana: addDays(monday, 7) })}
                        className="icon-link"
                        aria-label="Semana siguiente"
                      >
                        ›
                      </Link>
                      {monday !== mondayOf(today) && (
                        <Link
                          href={href({ semana: mondayOf(today) })}
                          className="link small"
                        >
                          Hoy
                        </Link>
                      )}
                    </div>
                    <div className="source-line">
                      {months.map((m) => {
                        const [y, mo] = m.split("-").map(Number);
                        const published = programs.find(
                          (p) =>
                            p.year === y &&
                            p.month === mo &&
                            p.status === "PUBLISHED",
                        );
                        return published ? (
                          <span key={m} className="small">
                            <span className="source official">✓ oficial</span>{" "}
                            {cap(MONTH_LABEL[mo - 1])} ·{" "}
                            <Link
                              href={`/panel/quiniela/${published.id}`}
                              className="link"
                            >
                              programa
                            </Link>
                            {published.sourceUrl && (
                              <>
                                {" · "}
                                <a
                                  href={published.sourceUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="link"
                                >
                                  PDF
                                </a>
                              </>
                            )}
                          </span>
                        ) : (
                          <span key={m} className="small">
                            <span className="source">habitual</span>{" "}
                            {cap(MONTH_LABEL[mo - 1])}: sin programa oficial
                            todavía
                          </span>
                        );
                      })}
                    </div>
                  </div>
                  <WeekGrid days={days} today={today} />
                  <WeekGridLegend />
                </>
              )}

              {tab === "resultados" && (
                <>
                  <div className="row week-bar">
                    <div className="week-nav">
                      <Link
                        href={`?vista=resultados&fecha=${addDays(resultDate, -1)}`}
                        className="icon-link"
                        aria-label="Día anterior"
                      >
                        ‹
                      </Link>
                      <strong>{dayLabel(resultDate)}</strong>
                      <Link
                        href={`?vista=resultados&fecha=${addDays(resultDate, 1)}`}
                        className="icon-link"
                        aria-label="Día siguiente"
                      >
                        ›
                      </Link>
                      {resultDate !== today && (
                        <Link
                          href={`?vista=resultados&fecha=${today}`}
                          className="link small"
                        >
                          Hoy
                        </Link>
                      )}
                    </div>
                    <Link
                      href="/panel/tareas?tipo=QUINIELA_RESULTS"
                      className="link small"
                    >
                      Fuentes y lecturas ›
                    </Link>
                  </div>
                  <ResultsGrid
                    held={held}
                    results={dayResults.map((r) => ({
                      id: r.id,
                      slot: r.slot,
                      lottery: r.lottery.code,
                      status: r.status,
                      head: r.numbers[0]?.number ?? null,
                      sources: r.sources,
                    }))}
                    isPast={(time) =>
                      resultDate < today ||
                      (resultDate === today &&
                        Number(time.slice(0, 2)) * 60 +
                          Number(time.slice(3, 5)) <=
                          nowMinutes)
                    }
                  />
                  <p className="small muted">
                    ✓ confirmado: coinciden dos o más fuentes, o lo publicó la
                    lotería oficial. Pendiente: lo leyó una sola fuente. En
                    conflicto: las fuentes no coinciden y hay que elegir.
                  </p>
                </>
              )}

              {tab === "habitual" && (
                <>
                  <div className="row page-head">
                    <p className="small muted">
                      La semana que se repite siempre. Cada semana arranca de
                      acá y solo se marcan los días distintos.
                    </p>
                    <Link
                      href={`/panel/quiniela/provincia/${province.id}#semana-habitual`}
                      className="btn btn-secondary btn-sm"
                    >
                      Cambiar semana habitual
                    </Link>
                  </div>
                  <BaseWeekGrid rules={weekRules} at={today} />
                </>
              )}

              {tab === "programa" && (
                <>
                  <p className="small muted">
                    Se baja solo de la web de Lotería. Al publicarlo se compara
                    con la semana habitual y se cargan los cambios de cada día.
                  </p>
                  {programs.length === 0 ? (
                    <p className="small muted">Todavía no hay programas.</p>
                  ) : (
                    <ul className="list rows">
                      {programs.map((p) => {
                        const warnings = Array.isArray(p.warnings)
                          ? p.warnings.length
                          : 0;
                        return (
                          <li key={p.id}>
                            <Link
                              href={`/panel/quiniela/${p.id}`}
                              className="row list-row"
                            >
                              <span>
                                <strong>
                                  {cap(MONTH_LABEL[p.month - 1])} {p.year}
                                </strong>{" "}
                                <span className="muted small">
                                  versión {p.version}
                                </span>
                                {warnings > 0 && (
                                  <span className="small warn">
                                    {" "}
                                    · {warnings} advertencia(s)
                                  </span>
                                )}
                              </span>
                              <span className="row-start">
                                <span
                                  className={`status-chip ${p.status === "PUBLISHED" ? "ok" : p.status === "DRAFT" ? "warn" : ""}`}
                                >
                                  {STATUS[p.status]}
                                </span>
                                <span className="chevron" aria-hidden="true">
                                  ›
                                </span>
                              </span>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  <div className="row-start">
                    {automatic && (
                      <SimpleForm
                        action={runJobAction.bind(null, "quiniela-program-B")}
                        submitLabel="Buscar el programa en Lotería"
                        className="inline-form"
                      />
                    )}
                  </div>
                  <details>
                    <summary className="small">Subir el PDF a mano</summary>
                    <div className="spaced">
                      <SimpleForm
                        action={uploadProgramAction.bind(null, province.code)}
                        submitLabel="Leer PDF"
                        className="inline-form"
                      >
                        <input
                          type="file"
                          name="pdf"
                          accept="application/pdf"
                          className="input file"
                          required
                        />
                      </SimpleForm>
                    </div>
                  </details>
                </>
              )}

              {tab === "reglas" && (
                <SimpleForm
                  action={setQuinielaRulesAction.bind(null, province.id)}
                  submitLabel="Guardar reglas"
                >
                  <div className="fields-3">
                    <label className="field">
                      <span className="small muted">Cierre de apuestas</span>
                      <span className="input-suffix">
                        <input
                          name="cutoffMinutes"
                          className="input"
                          inputMode="numeric"
                          defaultValue={rules?.cutoffMinutes ?? ""}
                          placeholder="5"
                        />
                        <span>min antes</span>
                      </span>
                    </label>
                    <label className="field">
                      <span className="small muted">Máximo por lotería</span>
                      <span className="input-suffix prefix">
                        <span>$</span>
                        <input
                          name="maxBetAmount"
                          className="input"
                          inputMode="decimal"
                          defaultValue={rules?.maxBetAmount?.toString() ?? ""}
                        />
                      </span>
                    </label>
                    <label className="field">
                      <span className="small muted">Caducidad de premios</span>
                      <span className="input-suffix">
                        <input
                          name="prizeExpiryDays"
                          className="input"
                          inputMode="numeric"
                          defaultValue={rules?.prizeExpiryDays ?? ""}
                          placeholder="10"
                        />
                        <span>días</span>
                      </span>
                    </label>
                  </div>
                  <p className="small muted">
                    La caducidad pasa al siguiente día hábil si cae en fin de
                    semana o feriado.
                  </p>
                </SimpleForm>
              )}
            </div>
          </section>
        );
      })}
    </main>
  );
}
