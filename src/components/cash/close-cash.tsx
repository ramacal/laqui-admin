"use client";

// "Cerrar caja": a button that opens the closing form in place. While the counted cash is typed
// it shows the expected cash and the difference (faltante / sobrante), as on the paper sheet.
import { useActionState, useState } from "react";
import { Lock } from "lucide-react";
import type { FormState } from "@/app/panel/caja/actions";
import { money } from "@/components/products/price-parts";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Same reading as lib/finance parseMoney: "1.500" and "1.500,50" are Argentine amounts.
function parse(raw: string): number | null {
  let s = raw.replace(/[\s$]/g, "");
  if (!s) return null;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if (!/^\d+(\.\d{1,2})?$/.test(s)) s = s.replace(/\./g, "");
  return /^\d+(\.\d+)?$/.test(s) ? Number(s) : null;
}

export function CloseCash({
  expected,
  missing,
  action,
}: {
  expected: string; // expected cash, as a decimal string
  missing?: string; // what has to be loaded before closing (e.g. the online sale)
  action: (prev: FormState, form: FormData) => Promise<FormState>;
}) {
  const [open, setOpen] = useState(false);
  const [counted, setCounted] = useState("");
  const [state, formAction, pending] = useActionState(action, null);
  const value = parse(counted);
  const diff = value === null ? null : Math.round((value - Number(expected)) * 100) / 100;

  if (!open)
    return (
      <div className="flex flex-col items-stretch gap-2 sm:items-end">
        <Button onClick={() => setOpen(true)} disabled={Boolean(missing)}>
          <Lock /> Cerrar caja
        </Button>
        {missing && <p className="text-sm text-warning">{missing}</p>}
      </div>
    );

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-lg border border-solid border-primary bg-card p-4 ring-4 ring-accent">
      <h3 className="m-0 text-base font-bold">Cerrar caja</h3>
      <div className="grid-2">
        <label className="field">
          <span className="small muted">Efectivo contado: lo que queda en la caja ($)</span>
          <input
            name="countedCash"
            className="input"
            inputMode="decimal"
            required
            autoFocus
            value={counted}
            onChange={(e) => setCounted(e.target.value)}
          />
        </label>
        <label className="field">
          <span className="small muted">Nota (opcional)</span>
          <input name="notes" className="input" maxLength={200} />
        </label>
      </div>
      <p className="text-sm text-muted-foreground">
        Efectivo esperado <strong className="text-foreground">{money(expected)}</strong>
        {diff !== null && (
          <>
            {" · "}
            <strong className={cn(diff === 0 ? "text-success" : "text-destructive")}>
              {diff === 0 ? "Sin diferencia" : `${diff < 0 ? "Faltante" : "Sobrante"} ${money(Math.abs(diff))}`}
            </strong>
          </>
        )}
      </p>
      <div className="flex flex-wrap items-center justify-end gap-2 border-0 border-t border-solid border-border pt-4">
        {state && !state.ok && <p className="mr-auto text-sm text-destructive">{state.message}</p>}
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={pending}>
          Cancelar
        </Button>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Guardando…" : "Cerrar caja"}
        </Button>
      </div>
    </form>
  );
}
