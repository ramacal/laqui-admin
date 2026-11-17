"use client";

import { useActionState, useState } from "react";
import type { FormState } from "@/app/panel/productos/actions";

type Province = { id: string; name: string; agencies: number };

/** Platform admin: register a new official game (base product). */
export function NewGameForm({
  action,
  provinces,
  today,
}: {
  action: (prev: FormState, form: FormData) => Promise<FormState>;
  provinces: Province[];
  today: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const [kind, setKind] = useState<"NUMBER_PICK" | "QUINIELA">("NUMBER_PICK");
  const [hasExtra, setHasExtra] = useState(false);

  return (
    <form action={formAction} className="stack-sm">
      <label className="field">
        <span className="small muted">Nombre</span>
        <input name="name" className="input" placeholder="Brinco" required maxLength={60} />
      </label>

      <fieldset className="segmented">
        <legend className="small muted">Cómo se juega</legend>
        <label>
          <input type="radio" name="kind" value="NUMBER_PICK" checked={kind === "NUMBER_PICK"} onChange={() => setKind("NUMBER_PICK")} />
          <span>Números a precio fijo</span>
        </label>
        <label>
          <input type="radio" name="kind" value="QUINIELA" checked={kind === "QUINIELA"} onChange={() => setKind("QUINIELA")} />
          <span>Monto libre por renglón</span>
        </label>
      </fieldset>

      {kind === "NUMBER_PICK" ? (
        <div className="stack-sm">
          <div className="grid-3">
            <label className="field">
              <span className="small muted">Cuántos números</span>
              <input name="pickCount" className="input" inputMode="numeric" defaultValue={6} required />
            </label>
            <label className="field">
              <span className="small muted">Desde</span>
              <input name="minNumber" className="input" inputMode="numeric" defaultValue={0} required />
            </label>
            <label className="field">
              <span className="small muted">Hasta</span>
              <input name="maxNumber" className="input" inputMode="numeric" defaultValue={45} required />
            </label>
          </div>
          <label className="check">
            <input type="checkbox" name="hasExtra" checked={hasExtra} onChange={(e) => setHasExtra(e.target.checked)} />
            <span>Tiene número extra (como el plus de Loto Plus)</span>
          </label>
          {hasExtra && (
            <div className="grid-2">
              <label className="field">
                <span className="small muted">Extra desde</span>
                <input name="extraMin" className="input" inputMode="numeric" defaultValue={0} required />
              </label>
              <label className="field">
                <span className="small muted">Extra hasta</span>
                <input name="extraMax" className="input" inputMode="numeric" defaultValue={9} required />
              </label>
            </div>
          )}
        </div>
      ) : (
        <label className="field">
          <span className="small muted">Cifras máximas por número</span>
          <input name="maxDigits" className="input" inputMode="numeric" defaultValue={4} required />
        </label>
      )}

      <label className="field">
        <span className="small muted">Modalidades (opcional, separadas por coma)</span>
        <input name="modalities" className="input" placeholder="Tradicional, Revancha" maxLength={200} />
      </label>

      <div className="grid-2">
        <label className="field">
          <span className="small muted">{kind === "QUINIELA" ? "Mínimo por renglón ($)" : "Precio nacional ($)"}</span>
          <input name="amount" className="input" inputMode="decimal" placeholder="1500" required />
        </label>
        <label className="field">
          <span className="small muted">Vale desde</span>
          <input type="date" name="validFrom" className="input" defaultValue={today} required />
        </label>
      </div>

      <fieldset className="stack-xs">
        <legend className="small muted">Se ofrece en</legend>
        <div className="tags">
          {provinces.map((p) => (
            <label key={p.id} className="chip-check">
              <input type="checkbox" name="provinceId" value={p.id} defaultChecked={p.agencies > 0} />
              <span>{p.name}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <button type="submit" className="btn btn-primary" disabled={pending}>
        {pending ? "Creando…" : "Crear juego"}
      </button>
      {state && (
        <p className={`small ${state.ok ? "ok-text" : "error"}`} role="status">
          {state.message}
        </p>
      )}
    </form>
  );
}
