"use client";

// Weekly hours form (general schedule and an agency's own): one row per day with an open/closed
// switch and its time ranges (several for split shifts). Ends with the shared FormActions, so
// inside an EditableSection it has Cancelar and closes when saved.
import { useActionState, useState } from "react";
import { Copy, Plus, X } from "lucide-react";
import type { FormState } from "@/app/panel/horarios/actions";
import type { Range, Week } from "@/lib/schedule";
import { Button } from "@/components/ui/button";
import { FormActions } from "@/components/ui/editable-section";
import { Switch } from "@/components/ui/switch";

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

  const update = (day: number, ranges: Range[]) => setWeek((w) => w.map((r, i) => (i === day ? ranges : r)));
  const copyMondayToWeekdays = () =>
    setWeek((w) => w.map((r, i) => (i >= 2 && i <= 5 ? w[1].map((x) => ({ ...x })) : r)));

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="week" value={JSON.stringify(week)} />
      <ul className="m-0 flex list-none flex-col p-0 [&>li+li]:border-0 [&>li+li]:border-t [&>li+li]:border-solid [&>li+li]:border-border">
        {DAYS.map(({ day, label }) => {
          const ranges = week[day];
          const open = ranges.length > 0;
          return (
            <li key={day} className="flex flex-wrap items-start gap-x-4 gap-y-2 py-3">
              <div className="flex w-36 items-center gap-3 pt-1.5">
                <Switch
                  checked={open}
                  label={`${label} abierto`}
                  onChange={(on) => update(day, on ? [{ ...DEFAULT_RANGE }] : [])}
                />
                <span className="font-semibold">{label}</span>
              </div>
              {open ? (
                <div className="flex flex-1 flex-col gap-2">
                  {ranges.map((r, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        type="time"
                        className="input time"
                        aria-label={`${label}: abre`}
                        value={r.opensAt}
                        onChange={(e) => update(day, ranges.map((x, j) => (j === i ? { ...x, opensAt: e.target.value } : x)))}
                        required
                      />
                      <span className="text-sm text-muted-foreground">a</span>
                      <input
                        type="time"
                        className="input time"
                        aria-label={`${label}: cierra`}
                        value={r.closesAt}
                        onChange={(e) => update(day, ranges.map((x, j) => (j === i ? { ...x, closesAt: e.target.value } : x)))}
                        required
                      />
                      <Button
                        variant="quiet"
                        size="icon"
                        aria-label={`Quitar tramo ${r.opensAt}–${r.closesAt}`}
                        title="Quitar tramo"
                        onClick={() => update(day, ranges.filter((_, j) => j !== i))}
                      >
                        <X />
                      </Button>
                    </div>
                  ))}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-fit text-primary"
                    onClick={() => {
                      const last = ranges[ranges.length - 1];
                      update(day, [...ranges, last ? { opensAt: "16:00", closesAt: "20:00" } : { ...DEFAULT_RANGE }]);
                    }}
                  >
                    <Plus /> Agregar tramo (horario cortado)
                  </Button>
                </div>
              ) : (
                <span className="pt-1.5 text-sm text-muted-foreground">Cerrado</span>
              )}
            </li>
          );
        })}
      </ul>
      <Button variant="outline" size="sm" className="w-fit" onClick={copyMondayToWeekdays}>
        <Copy /> Copiar lunes a martes–viernes
      </Button>
      <FormActions state={state} pending={pending} />
    </form>
  );
}
