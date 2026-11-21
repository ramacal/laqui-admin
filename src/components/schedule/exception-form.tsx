"use client";

import { useActionState, useState } from "react";
import type { FormState } from "@/app/panel/horarios/actions";
import type { Range } from "@/lib/schedule";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormActions } from "@/components/ui/editable-section";

type Props = {
  action: (prev: FormState, form: FormData) => Promise<FormState>;
  today: string; // YYYY-MM-DD
  defaultStart?: string; // prefill, e.g. when changing an inherited exception
  defaultEnd?: string;
};

export function ExceptionForm({ action, today, defaultStart, defaultEnd }: Props) {
  const [state, formAction, pending] = useActionState(action, null);
  const [kind, setKind] = useState<"CLOSED" | "SPECIAL_HOURS">(defaultStart ? "SPECIAL_HOURS" : "CLOSED");
  const [startDate, setStartDate] = useState(defaultStart ?? today);
  const [slots, setSlots] = useState<Range[]>([{ opensAt: "08:00", closesAt: "12:00" }]);

  return (
    <form action={formAction} className="stack-sm">
      <input type="hidden" name="slots" value={JSON.stringify(slots)} />
      <div className="grid-2">
        <label className="field">
          <span className="small muted">Desde</span>
          <input
            type="date"
            name="startDate"
            className="input"
            min={today}
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            required
          />
        </label>
        <label className="field">
          <span className="small muted">Hasta (opcional)</span>
          <input type="date" name="endDate" className="input" min={startDate} defaultValue={defaultEnd} />
        </label>
      </div>

      <fieldset className="segmented">
        <legend className="small muted">Ese período la agencia está</legend>
        <label>
          <input type="radio" name="kind" value="CLOSED" checked={kind === "CLOSED"} onChange={() => setKind("CLOSED")} />
          <span>Cerrada</span>
        </label>
        <label>
          <input
            type="radio"
            name="kind"
            value="SPECIAL_HOURS"
            checked={kind === "SPECIAL_HOURS"}
            onChange={() => setKind("SPECIAL_HOURS")}
          />
          <span>Horario especial</span>
        </label>
      </fieldset>

      {kind === "SPECIAL_HOURS" && (
        <div className="stack-xs">
          {slots.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="time"
                className="input time"
                aria-label="Abre"
                value={s.opensAt}
                onChange={(e) => setSlots(slots.map((x, j) => (j === i ? { ...x, opensAt: e.target.value } : x)))}
                required
              />
              <span className="muted">a</span>
              <input
                type="time"
                className="input time"
                aria-label="Cierra"
                value={s.closesAt}
                onChange={(e) => setSlots(slots.map((x, j) => (j === i ? { ...x, closesAt: e.target.value } : x)))}
                required
              />
              {slots.length > 1 && (
                <Button variant="quiet" size="icon" aria-label="Quitar tramo" title="Quitar tramo" onClick={() => setSlots(slots.filter((_, j) => j !== i))}>
                  <X />
                </Button>
              )}
            </div>
          ))}
          <Button variant="ghost" size="sm" className="w-fit text-primary" onClick={() => setSlots([...slots, { opensAt: "17:00", closesAt: "20:00" }])}>
            <Plus /> Agregar tramo
          </Button>
        </div>
      )}

      <label className="field">
        <span className="small muted">Motivo (opcional)</span>
        <input name="reason" className="input" placeholder="Vacaciones, inventario, duelo…" maxLength={120} />
      </label>

      <FormActions state={state} pending={pending} submitLabel="Agregar" />
    </form>
  );
}
