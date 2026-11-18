import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAccess } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import {
  LOTTERY_SHORT,
  type Rule,
  SLOT_LABEL,
  SLOT_ORDER,
  addDays,
  byLottery,
  describeException,
  loadAnchors,
  loadCalendar,
  loadRules,
  usualWeek,
  weekdayOf,
  weekdaysText,
} from "@/lib/quiniela/calendar";
import { todayIn } from "@/lib/schedule";
import { SimpleForm } from "@/components/schedule/simple-form";
import {
  DayChangeForm,
  UsualWeekForm,
} from "@/components/quiniela/change-forms";
import { BaseWeekGrid } from "@/components/quiniela/week-grid";
import {
  addExceptionAction,
  changeUsualWeekAction,
  deleteExceptionAction,
  setDrawNumberAction,
} from "../../actions";

export const metadata = { title: "Semana de Quiniela · Laqui" };
export const dynamic = "force-dynamic";

const TZ = "America/Argentina/Buenos_Aires";
const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const ddmmyyyy = (iso: string) => `${ddmm(iso)}/${iso.slice(0, 4)}`;
const dayName = (iso: string) => {
  const s = new Date(`${iso}T12:00:00Z`).toLocaleDateString("es-AR", {
    timeZone: "UTC",
    weekday: "long",
  });
  return `${s[0].toUpperCase()}${s.slice(1)} ${ddmm(iso)}`;
};
const mondayOf = (iso: string) => addDays(iso, -((weekdayOf(iso) + 6) % 7));
const lot = (code: string) => LOTTERY_SHORT[code] ?? code;

/** Usual-week rows grouped into periods: lottery, draw, days, time, from, until. */
function periods(rules: Rule[]) {
  const groups = new Map<
    string,
    {
      slot: Rule["slot"];
      lottery: string;
      time: string;
      from: string;
      to: string | null;
      weekdays: number[];
    }
  >();
  for (const r of rules) {
    const k = `${r.slot}|${r.lottery}|${r.time}|${r.from}|${r.to}`;
    const g = groups.get(k) ?? {
      slot: r.slot,
      lottery: r.lottery,
      time: r.time,
      from: r.from,
      to: r.to,
      weekdays: [],
    };
    g.weekdays.push(r.weekday);
    groups.set(k, g);
  }
  return [...groups.values()];
}

// Platform admin: a province's Quiniela week. The usual week is the default; a day that is
// different gets a change for that day only.
export default async function ProvinceQuinielaPage({
  params,
  searchParams,
}: {
  params: Promise<{ provinceId: string }>;
  searchParams: Promise<{ semana?: string }>;
}) {
  const { provinceId } = await params;
  const { semana } = await searchParams;
  const access = await requireAccess();
  if (!access.isPlatformAdmin) notFound();
  const province = await prisma.province.findUnique({
    where: { id: provinceId },
    include: {
      lotteries: {
        where: { enabled: true },
        include: { lottery: { select: { code: true } } },
      },
    },
  });
  if (!province) notFound();

  const today = todayIn(TZ);
  const monday = mondayOf(
    semana && /^\d{4}-\d{2}-\d{2}$/.test(semana) ? semana : today,
  );
  const sunday = addDays(monday, 6);
  const [rules, anchors, calendar] = await Promise.all([
    loadRules(provinceId),
    loadAnchors(provinceId),
    loadCalendar(provinceId, monday, sunday),
  ]);
  const days = calendar.days(monday, sunday);
  const usual = usualWeek(today, rules);

  const slots = SLOT_ORDER.map((s) => ({ value: s, label: SLOT_LABEL[s] }));
  const lotteries = province.lotteries
    .map((l) => l.lottery.code)
    .sort(byLottery)
    .map((c) => ({ value: c, label: lot(c) }));

  // Changes to the usual week that start or end after today.
  const all = periods(rules);
  const upcoming = [
    ...all
      .filter((p) => p.from > today)
      .map((p) => ({
        date: p.from,
        text: `${lot(p.lottery)} juega en ${SLOT_LABEL[p.slot]} a las ${p.time} (${weekdaysText(p.weekdays)})`,
      })),
    ...all
      .filter(
        (p) =>
          p.to !== null &&
          p.to >= today &&
          !all.some(
            (q) =>
              q !== p &&
              q.slot === p.slot &&
              q.lottery === p.lottery &&
              q.from === addDays(p.to!, 1),
          ),
      )
      .map((p) => ({
        date: addDays(p.to!, 1),
        text: `${lot(p.lottery)} deja de jugar en ${SLOT_LABEL[p.slot]} (${weekdaysText(p.weekdays)})`,
      })),
  ].sort((a, b) => a.date.localeCompare(b.date));

  const latest = new Map<string, (typeof anchors)[number]>();
  for (const a of anchors) latest.set(`${a.slot}|${a.lottery}`, a);
  const projected = days.some((d) => !d.confirmed);

  return (
    <main className="screen">
      <Link href="/panel/quiniela" className="back">
        ← Sorteos de Quiniela
      </Link>
      <div className="stack-xs">
        <h1>Cargar cambios</h1>
        <p className="muted small">
          Quiniela en {province.name}. Todas las semanas son iguales a la semana
          habitual; si un día es distinto (un feriado, un sorteo que no se
          hace), el cambio se carga solo en ese día.
        </p>
      </div>

      {/* ── The week, day by day ── */}
      <section className="stack-sm">
        <div className="row week-bar">
          <div className="week-nav">
            <Link
              href={`?semana=${addDays(monday, -7)}`}
              className="icon-link"
              aria-label="Semana anterior"
            >
              ‹
            </Link>
            <strong>
              Semana del {ddmm(monday)} al {ddmm(sunday)}
            </strong>
            <Link
              href={`?semana=${addDays(monday, 7)}`}
              className="icon-link"
              aria-label="Semana siguiente"
            >
              ›
            </Link>
            {monday !== mondayOf(today) && (
              <Link href="?" className="link small">
                Hoy
              </Link>
            )}
          </div>
          {projected && (
            <span className="status-chip warn">
              Algunos días todavía sin programa oficial
            </span>
          )}
        </div>
        <ul className="list day-grid">
          {days.map((day) => {
            const changes = day.exceptions;
            const status = !day.draws.length
              ? "Sin sorteos"
              : changes.length
                ? "Con cambios"
                : "Normal";
            return (
              <li
                key={day.date}
                className={`card day-card ${day.date === today ? "is-today" : ""}`}
              >
                <div className="row">
                  <strong>
                    {dayName(day.date)}
                    {day.date === today ? " · hoy" : ""}
                  </strong>
                  <span
                    className={`status-chip ${status === "Normal" ? "ok" : "warn"}`}
                  >
                    {status}
                  </span>
                </div>
                {day.draws.length > 0 && (
                  <ul className="draw-lines">
                    {day.draws.map((d) => (
                      <li key={d.slot}>
                        <span className="draw-time">{d.time}</span>
                        <span>{SLOT_LABEL[d.slot]}</span>
                        {d.lotteries.some((l) => l.code === "MONTEVIDEO") && (
                          <span className="pill mvd">MVD</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                {changes.map((e) => (
                  <div key={e.id} className="row">
                    <span className="small warn">
                      {describeException(e)}
                      {e.note ? ` · ${e.note}` : ""}
                      <span className="muted">
                        {" "}
                        ·{" "}
                        {e.source === "PROGRAM"
                          ? "según el programa oficial"
                          : "cargado a mano"}
                      </span>
                    </span>
                    {e.source === "MANUAL" && (
                      <form action={deleteExceptionAction.bind(null, e.id!)}>
                        <button
                          type="submit"
                          className="btn btn-secondary btn-sm"
                        >
                          Quitar
                        </button>
                      </form>
                    )}
                  </div>
                ))}
                <details>
                  <summary className="small">Cambiar este día</summary>
                  <div className="spaced">
                    <DayChangeForm
                      action={addExceptionAction.bind(null, provinceId)}
                      date={day.date}
                      slots={slots}
                      lotteries={lotteries}
                    />
                  </div>
                </details>
              </li>
            );
          })}
        </ul>
      </section>

      {/* ── The usual week ── */}
      <section className="card stack-sm" id="semana-habitual">
        <h2>Semana habitual</h2>
        {!usual.length ? (
          <p className="small muted">
            Todavía no está cargada. Se arma sola al publicar el primer programa
            oficial, o se carga con «Cambiar la semana habitual».
          </p>
        ) : (
          <BaseWeekGrid rules={rules} at={today} />
        )}
        {upcoming.length > 0 && (
          <div className="stack-xs">
            <strong className="small">
              Cambios ya cargados para más adelante
            </strong>
            {upcoming.map((u) => (
              <span key={`${u.date}${u.text}`} className="small">
                Desde el {ddmm(u.date)}: {u.text}
              </span>
            ))}
          </div>
        )}
        <details>
          <summary className="small">Cambiar la semana habitual</summary>
          <div className="spaced stack-xs">
            <p className="small muted">
              Para algo que pasa de acá en adelante. Lo anterior a la fecha
              queda como estaba.
            </p>
            <UsualWeekForm
              action={changeUsualWeekAction.bind(null, provinceId)}
              today={today}
              slots={slots}
              lotteries={lotteries}
            />
          </div>
        </details>
        <details>
          <summary className="small">Historial de la semana habitual</summary>
          <ul className="list plain spaced">
            {all
              .sort(
                (a, b) =>
                  SLOT_ORDER.indexOf(a.slot) - SLOT_ORDER.indexOf(b.slot) ||
                  byLottery(a.lottery, b.lottery) ||
                  a.from.localeCompare(b.from),
              )
              .map((p) => (
                <li
                  key={`${p.slot}${p.lottery}${p.time}${p.from}`}
                  className={`small ${p.to && p.to < today ? "muted" : ""}`}
                >
                  {SLOT_LABEL[p.slot]} · {lot(p.lottery)} ·{" "}
                  {weekdaysText(p.weekdays)} · {p.time} · desde{" "}
                  {ddmmyyyy(p.from)}
                  {p.to ? ` hasta ${ddmmyyyy(p.to)}` : ""}
                </li>
              ))}
          </ul>
        </details>
      </section>

      {/* ── Draw numbers (advanced) ── */}
      <details className="card">
        <summary>Números de sorteo</summary>
        <div className="spaced stack-sm">
          <p className="small muted">
            Se calculan solos: cada sorteo suma 1 desde el último número
            conocido. Al publicar el programa oficial se guarda el primero de
            cada mes. Solo hace falta tocarlos si alguno salió mal.
          </p>
          {latest.size === 0 ? (
            <p className="small muted">Todavía no hay números conocidos.</p>
          ) : (
            <ul className="list plain">
              {[...latest.values()]
                .sort(
                  (a, b) =>
                    SLOT_ORDER.indexOf(a.slot) - SLOT_ORDER.indexOf(b.slot) ||
                    byLottery(a.lottery, b.lottery),
                )
                .map((a) => (
                  <li key={`${a.slot}${a.lottery}`} className="small">
                    {SLOT_LABEL[a.slot]} · {lot(a.lottery)}: n.º {a.number} el{" "}
                    {ddmmyyyy(a.date)}
                  </li>
                ))}
            </ul>
          )}
          <SimpleForm
            action={setDrawNumberAction.bind(null, provinceId)}
            submitLabel="Corregir número"
          >
            <div className="grid-2">
              <select name="slot" className="input" required defaultValue="">
                <option value="" disabled>
                  Sorteo
                </option>
                {slots.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
              <select name="lottery" className="input" required defaultValue="">
                <option value="" disabled>
                  Lotería
                </option>
                {lotteries.map((l) => (
                  <option key={l.value} value={l.value}>
                    {l.label}
                  </option>
                ))}
              </select>
              <input
                type="date"
                name="date"
                className="input"
                required
                defaultValue={today}
                aria-label="Fecha"
              />
              <input
                name="number"
                className="input"
                inputMode="numeric"
                required
                placeholder="N.º de sorteo"
              />
            </div>
          </SimpleForm>
        </div>
      </details>
    </main>
  );
}
