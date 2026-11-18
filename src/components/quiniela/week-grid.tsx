// A province's Quiniela week as a grid: draws (with their time) down the left, days across the
// top, and in each cell the lotteries drawn, as pills. Differences with the usual week are marked
// in the cell: a lottery that does not play is struck through, one that joins is highlighted,
// and a different time is written in.
import {
  type Day,
  type HeldDraw,
  LOTTERY_SHORT,
  type Rule,
  SLOT_LABEL,
  SLOT_ORDER,
  type Slot,
  byLottery,
  describeException,
  weekAt,
} from "@/lib/quiniela/calendar";

export type GridDay = Day & { usual: HeldDraw[] };

const WD = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const head = (iso: string) =>
  `${WD[new Date(`${iso}T12:00:00Z`).getUTCDay()]} ${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const SHORT: Record<string, string> = {
  ...LOTTERY_SHORT,
  ENTRE_RIOS: "E. Ríos",
  MONTEVIDEO: "Montevideo",
};

/** The usual time of each draw this week (the most frequent). */
function rowTimes(days: GridDay[]) {
  const counts = new Map<Slot, Map<string, number>>();
  for (const d of days)
    for (const h of d.usual) {
      const m = counts.get(h.slot) ?? new Map<string, number>();
      m.set(h.time, (m.get(h.time) ?? 0) + 1);
      counts.set(h.slot, m);
    }
  const out = new Map<Slot, string | null>();
  for (const slot of SLOT_ORDER) {
    const m = counts.get(slot);
    const actual = days.flatMap((d) => d.draws).find((x) => x.slot === slot);
    if (!m && !actual) continue;
    out.set(
      slot,
      m
        ? [...m.entries()].sort((a, b) => b[1] - a[1])[0][0]
        : (actual?.time ?? null),
    );
  }
  return out;
}

export function WeekGrid({ days, today }: { days: GridDay[]; today: string }) {
  const rows = rowTimes(days);
  if (!rows.size)
    return (
      <p className="small muted">No hay sorteos cargados para esta semana.</p>
    );
  const pills = (d: GridDay, slot: Slot, time: string | null) => {
    const actual = d.draws.find((x) => x.slot === slot);
    const usual = d.usual.find((x) => x.slot === slot);
    const codes = [
      ...new Set([
        ...(actual?.lotteries.map((l) => l.code) ?? []),
        ...(usual?.lotteries ?? []),
      ]),
    ].sort(byLottery);
    if (!codes.length) return null;
    return (
      <div className="pills">
        {actual && actual.time !== time && (
          <span className="time-change">{actual.time}</span>
        )}
        {codes.map((code) => {
          const plays = actual?.lotteries.some((l) => l.code === code) ?? false;
          const usually = usual?.lotteries.includes(code) ?? false;
          const cls = plays && !usually ? "added" : !plays ? "removed" : "";
          return (
            <span
              key={code}
              className={`pill ${cls} ${code === "MONTEVIDEO" ? "mvd" : ""}`}
            >
              {SHORT[code] ?? code}
            </span>
          );
        })}
      </div>
    );
  };
  return (
    <>
      {/* Narrow screens: one card per day. */}
      <div className="week-days">
        {days.map((d) => {
          const notes = d.exceptions.map(describeException);
          return (
            <div
              key={d.date}
              className={`week-day ${d.date === today ? "is-today" : ""}`}
            >
              <div className="row">
                <strong>
                  {head(d.date)}
                  {d.date === today ? " · hoy" : ""}
                </strong>
                <span className={`source ${d.confirmed ? "official" : ""}`}>
                  {d.confirmed ? "oficial" : "habitual"}
                </span>
              </div>
              {!d.draws.length && !d.usual.length && (
                <span className="small muted">Sin sorteos</span>
              )}
              {[...rows.entries()].map(([slot, time]) => {
                const content = pills(d, slot, time);
                if (!content) return null;
                return (
                  <div key={slot} className="week-day-draw">
                    <span className="small">
                      <strong>{SLOT_LABEL[slot]}</strong>
                      <br />
                      <span className="muted">{time}</span>
                    </span>
                    {content}
                  </div>
                );
              })}
              {notes.length > 0 && (
                <span className="small warn">{notes.join(" · ")}</span>
              )}
            </div>
          );
        })}
      </div>
      <div className="table-scroll week-grid-wrap">
        <table className="week-grid small">
          <thead>
            <tr>
              <th />
              {days.map((d) => (
                <th key={d.date} className={d.date === today ? "is-today" : ""}>
                  {head(d.date)}
                  <span className={`source ${d.confirmed ? "official" : ""}`}>
                    {d.confirmed ? "oficial" : "habitual"}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...rows.entries()].map(([slot, time]) => (
              <tr key={slot}>
                <th scope="row">
                  {SLOT_LABEL[slot]}
                  <span className="time">{time}</span>
                </th>
                {days.map((d) => {
                  const notes = d.exceptions
                    .filter(
                      (e) =>
                        e.slot === slot || (e.action === "SKIP" && !e.slot),
                    )
                    .map(describeException);
                  return (
                    <td
                      key={d.date}
                      className={d.date === today ? "is-today" : ""}
                      title={notes.join(" · ") || undefined}
                    >
                      {pills(d, slot, time) ?? <span className="muted">—</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/** The base configuration (usual week in force on a date): draws × weekdays, no dates. */
export function BaseWeekGrid({ rules, at }: { rules: Rule[]; at: string }) {
  const week = weekAt(at, rules);
  const order = [1, 2, 3, 4, 5, 6, 0];
  const slots = SLOT_ORDER.filter((s) => week.some((w) => w.slots.has(s)));
  if (!slots.length)
    return (
      <p className="small muted">
        Todavía no hay configuración base. Se arma sola al publicar el primer
        programa oficial.
      </p>
    );
  return (
    <div className="table-scroll">
      <table className="week-grid small">
        <thead>
          <tr>
            <th />
            {order.map((w) => (
              <th key={w}>{WD[w]}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {slots.map((slot) => {
            const times = new Map<string, number>();
            for (const w of week) {
              const t = w.slots.get(slot)?.time;
              if (t) times.set(t, (times.get(t) ?? 0) + 1);
            }
            const time = [...times.entries()].sort((a, b) => b[1] - a[1])[0][0];
            return (
              <tr key={slot}>
                <th scope="row">
                  {SLOT_LABEL[slot]}
                  <span className="time">{time}</span>
                </th>
                {order.map((w) => {
                  const s = week[w].slots.get(slot);
                  return (
                    <td key={w}>
                      {!s ? (
                        <span className="muted">—</span>
                      ) : (
                        <div className="pills">
                          {s.time !== time && (
                            <span className="time-change">{s.time}</span>
                          )}
                          {[...s.lotteries].sort(byLottery).map((code) => (
                            <span
                              key={code}
                              className={`pill ${code === "MONTEVIDEO" ? "mvd" : ""}`}
                            >
                              {SHORT[code] ?? code}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function WeekGridLegend() {
  return (
    <p className="small muted grid-legend">
      <span className="pill">Habitual</span>{" "}
      <span className="pill added">Se suma ese día</span>{" "}
      <span className="pill removed">No juega ese día</span> ·{" "}
      <span className="source official">oficial</span> según el programa de
      Lotería · <span className="source">habitual</span> todavía sin programa
      oficial
    </p>
  );
}
