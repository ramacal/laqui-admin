"use client";

import { useActionState, useState } from "react";
import type { FormState } from "@/app/panel/horarios/actions";
import type { Range, Week } from "@/lib/schedule";

// Monday first (Argentina). Index = JS weekday (0 = Sunday).
const DAYS = [
  { day: 1, label: "Lunes" },
  { day: 2, label: "Martes" },
  { day: 3, label: "Miércoles" },
  { day: 4, label: "Jueves" },
  { day: 5, label: "Viernes" },
  { day: 6, label: "Sábado" },
  { day: 0, label: "Domingo" },
];
const DEFAULT_RANGE: Range = { opensAt: "08:00", closesAt: "13:00" };

type Props = {
  initial: Week;
  action: (prev: FormState, form: FormData) => Promise<FormState>;
};

export function WeeklyHoursEditor({ initial, action }: Props) {
  const [week, setWeek] = useState<Week>(initial);
  const [state, formAction, pending] = useActionState(action, null);
  const [dirty, setDirty] = useState(false);

  const update = (day: number, ranges: Range[]) => {
    setWeek((w) => w.map((r, i) => (i === day ? ranges : r)));
    setDirty(true);
  };

  const copyMondayToWeekdays = () => {
    setWeek((w) => w.map((r, i) => (i >= 2 && i <= 5 ? w[1].map((x) => ({ ...x })) : r)));
    setDirty(true);
  };

  return (
    <form action={formAction} className="stack-sm" onSubmit={() => setDirty(false)}>
      <input type="hidden" name="week" value={JSON.stringify(week)} />
      <ul className="list">
        {DAYS.map(({ day, label }) => {
          const ranges = week[day];
          const open = ranges.length > 0;
          return (
            <li key={day} className="card day-row">
              <div className="row">
                <strong>{label}</strong>
                <label className="switch">
                  <input
                    type="checkbox"
                    aria-label={`${label} abierto`}
                    checked={open}
                    onChange={(e) => update(day, e.target.checked ? [{ ...DEFAULT_RANGE }] : [])}
                  />
                  <span>{open ? "Abierto" : "Cerrado"}</span>
                </label>
              </div>
              {open && (
                <div className="stack-xs ranges">
                  {ranges.map((r, i) => (
                    <div key={i} className="range-row">
                      <input
                        type="time"
                        className="input time"
                        aria-label={`${label}: abre`}
                        value={r.opensAt}
                        onChange={(e) => update(day, ranges.map((x, j) => (j === i ? { ...x, opensAt: e.target.value } : x)))}
                        required
                      />
                      <span className="muted">a</span>
                      <input
                        type="time"
                        className="input time"
                        aria-label={`${label}: cierra`}
                        value={r.closesAt}
                        onChange={(e) => update(day, ranges.map((x, j) => (j === i ? { ...x, closesAt: e.target.value } : x)))}
                        required
                      />
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label={`Quitar tramo ${r.opensAt}–${r.closesAt}`}
                        onClick={() => update(day, ranges.filter((_, j) => j !== i))}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    className="link-btn"
                    onClick={() => {
                      const last = ranges[ranges.length - 1];
                      update(day, [...ranges, last ? { opensAt: "16:00", closesAt: "20:00" } : { ...DEFAULT_RANGE }]);
                    }}
                  >
                    + Agregar tramo (horario cortado)
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <div className="row actions">
        <button type="button" className="btn btn-secondary" onClick={copyMondayToWeekdays}>
          Copiar lunes a martes–viernes
        </button>
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "Guardando…" : "Guardar horario"}
        </button>
      </div>
      <p className={`small ${state ? (state.ok ? "ok-text" : "error") : "muted"}`} role="status">
        {state?.message ?? (dirty ? "Tenés cambios sin guardar." : "")}
      </p>
    </form>
  );
}
