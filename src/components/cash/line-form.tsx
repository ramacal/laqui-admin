"use client";

import { useActionState, useState } from "react";
import type { FormState } from "@/app/panel/caja/actions";
import { FormActions } from "@/components/ui/editable-section";

const LINES = [
  { value: "CASH_IN", label: "Ingreso de efectivo" },
  { value: "PRIZE_QUINIELA", label: "Acierto quiniela" },
  { value: "PRIZE_SCRATCH", label: "Acierto raspaditas" },
  { value: "PRIZE_OTHER", label: "Otros aciertos" },
  { value: "WITHDRAWAL", label: "Retiro" },
  { value: "EXPENSE", label: "Gasto" },
  { value: "TRANSFER", label: "Transferencia de un cliente" },
];

/** One line of the sheet. A transfer asks for the account the money landed in. */
export function LineForm({
  action,
  accounts,
}: {
  action: (prev: FormState, form: FormData) => Promise<FormState>;
  accounts: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const [line, setLine] = useState("PRIZE_QUINIELA");
  return (
    <form action={formAction} className="stack-sm">
      <div className="grid-2">
        <label className="field">
          <span className="small muted">Qué</span>
          <select name="line" className="input" value={line} onChange={(e) => setLine(e.target.value)}>
            {LINES.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="small muted">Monto ($)</span>
          <input name="amount" className="input" inputMode="decimal" placeholder="1.500" required autoFocus />
        </label>
      </div>
      {line === "TRANSFER" && accounts.length === 0 && (
        <p className="text-sm text-warning">
          No hay cuentas para recibir transferencias. Agregá una en Configuración › Medios de cobro (la cuenta del legajo
          es solo para Lotería).
        </p>
      )}
      {line === "TRANSFER" && accounts.length > 0 && (
        <label className="field">
          <span className="small muted">¿A qué cuenta transfirió?</span>
          <select name="fundId" className="input" required>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="field">
        <span className="small muted">Detalle (opcional)</span>
        <input name="description" className="input" maxLength={120} placeholder={line === "EXPENSE" ? "Artículos de limpieza" : ""} />
      </label>
      <FormActions state={state} pending={pending} submitLabel="Cargar" />
    </form>
  );
}
