"use client";

// Admin forms for the Quiniela week: change one day, or change the usual week from a date.
// They only show the fields that the chosen change needs.
import { useState } from "react";
import type { FormState } from "@/app/panel/horarios/actions";
import { SimpleForm } from "@/components/schedule/simple-form";

type Option = { value: string; label: string };
type Action = (prev: FormState, form: FormData) => Promise<FormState>;

const DAY_KINDS: Option[] = [
  { value: "no_draws", label: "No hay sorteos en todo el día" },
  { value: "skip_draw", label: "No se hace un sorteo" },
  { value: "skip_lottery", label: "Una lotería no juega en un sorteo" },
  { value: "add_lottery", label: "Una lotería se suma a un sorteo" },
  { value: "time", label: "Un sorteo cambia de horario" },
  { value: "expiry", label: "Los premios caducan otro día" },
];

function Select({ name, options, placeholder }: { name: string; options: Option[]; placeholder: string }) {
  return (
    <select name={name} className="input" required defaultValue="">
      <option value="" disabled>
        {placeholder}
      </option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

/** Change for a single date (an exception to the usual week). */
export function DayChangeForm({ action, date, slots, lotteries }: { action: Action; date: string; slots: Option[]; lotteries: Option[] }) {
  const [kind, setKind] = useState("no_draws");
  const needsSlot = kind !== "no_draws" && kind !== "expiry";
  const needsLottery = kind === "skip_lottery" || kind === "add_lottery";
  const needsTime = kind === "add_lottery" || kind === "time";
  return (
    <SimpleForm action={action} submitLabel="Guardar cambio de este día">
      <input type="hidden" name="date" value={date} />
      <label className="field">
        <span className="small muted">¿Qué pasa ese día?</span>
        <select name="kind" className="input" value={kind} onChange={(e) => setKind(e.target.value)}>
          {DAY_KINDS.map((k) => (
            <option key={k.value} value={k.value}>
              {k.label}
            </option>
          ))}
        </select>
      </label>
      {(needsSlot || needsLottery) && (
        <div className="grid-2">
          {needsSlot && <Select name="slot" options={slots} placeholder="Sorteo" />}
          {needsLottery && <Select name="lottery" options={lotteries} placeholder="Lotería" />}
        </div>
      )}
      {needsTime && (
        <label className="field">
          <span className="small muted">Horario</span>
          <input type="time" name="time" className="input" required />
        </label>
      )}
      {kind === "expiry" && (
        <label className="field">
          <span className="small muted">Caducan el</span>
          <input type="date" name="prizeExpiry" className="input" required />
        </label>
      )}
      <input name="note" className="input" placeholder="Motivo (opcional), ej.: feriado" />
    </SimpleForm>
  );
}

const WEEK_KINDS: Option[] = [
  { value: "add", label: "Una lotería empieza a jugar en un sorteo" },
  { value: "remove", label: "Una lotería deja de jugar en un sorteo" },
  { value: "time", label: "Un sorteo cambia de horario" },
];
const WEEKDAYS = [
  { value: 1, label: "Lun" },
  { value: 2, label: "Mar" },
  { value: 3, label: "Mié" },
  { value: 4, label: "Jue" },
  { value: 5, label: "Vie" },
  { value: 6, label: "Sáb" },
  { value: 0, label: "Dom" },
];

/** Change to the usual week from a date on (earlier dates keep what they had). */
export function UsualWeekForm({ action, today, slots, lotteries }: { action: Action; today: string; slots: Option[]; lotteries: Option[] }) {
  const [kind, setKind] = useState("add");
  return (
    <SimpleForm action={action} submitLabel="Guardar cambio">
      <label className="field">
        <span className="small muted">¿Qué cambia?</span>
        <select name="kind" className="input" value={kind} onChange={(e) => setKind(e.target.value)}>
          {WEEK_KINDS.map((k) => (
            <option key={k.value} value={k.value}>
              {k.label}
            </option>
          ))}
        </select>
      </label>
      <div className="grid-2">
        <Select name="slot" options={slots} placeholder="Sorteo" />
        {kind !== "time" && <Select name="lottery" options={lotteries} placeholder="Lotería" />}
      </div>
      <div className="stack-xs">
        <span className="small muted">Qué días</span>
        <div className="tags">
          {WEEKDAYS.map((w) => (
            <label key={w.value} className="check">
              <input type="checkbox" name="weekday" value={w.value} defaultChecked={w.value !== 0} />
              <span className="small">{w.label}</span>
            </label>
          ))}
        </div>
      </div>
      <div className="grid-2">
        <label className="field">
          <span className="small muted">Desde el</span>
          <input type="date" name="from" className="input" required defaultValue={today} />
        </label>
        {kind !== "remove" && (
          <label className="field">
            <span className="small muted">{kind === "time" ? "Nuevo horario" : "Horario"}</span>
            <input type="time" name="time" className="input" required />
          </label>
        )}
      </div>
    </SimpleForm>
  );
}
