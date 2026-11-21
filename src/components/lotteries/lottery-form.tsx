"use client";

// Create/edit an official lottery: country → jurisdiction → organism, brand and Quiniela flag.
import { useActionState, useState } from "react";
import type { FormState } from "@/app/panel/loterias/actions";

type Country = { id: string; name: string };
type Province = { id: string; name: string; countryId: string; taken: boolean };

export type LotteryValues = {
  code: string;
  name: string;
  fullName: string | null;
  countryId: string;
  provinceId: string | null;
  website: string | null;
  brandPrimaryColor: string | null;
  brandSecondaryColor: string | null;
  quinielaDraws: boolean;
  active: boolean;
};

type Props = {
  action: (prev: FormState, form: FormData) => Promise<FormState>;
  countries: Country[];
  provinces: Province[];
  values: LotteryValues;
  submitLabel: string;
  hasLogo: boolean;
};

export function LotteryForm({ action, countries, provinces, values, submitLabel, hasLogo }: Props) {
  const [state, formAction, pending] = useActionState(action, null);
  const [countryId, setCountryId] = useState(values.countryId);
  const inCountry = provinces.filter((p) => p.countryId === countryId);

  return (
    <form action={formAction} className="stack-sm">
      <div className="grid-2">
        <label className="field">
          <span className="label">País</span>
          <select name="countryId" className="input" value={countryId} onChange={(e) => setCountryId(e.target.value)} required>
            {countries.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="label">Provincia / jurisdicción</span>
          <select key={countryId} name="provinceId" className="input" defaultValue={values.provinceId ?? ""}>
            <option value="">Nacional (sin jurisdicción)</option>
            {inCountry.map((p) => (
              <option key={p.id} value={p.id} disabled={p.taken}>
                {p.name}
                {p.taken ? " · ya tiene lotería" : ""}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="field">
        <span className="label">Organismo oficial</span>
        <input name="fullName" className="input" defaultValue={values.fullName ?? ""} placeholder="Instituto Provincial de Lotería y Casinos" />
      </label>

      <div className="grid-2">
        <label className="field">
          <span className="label">Nombre en la Quiniela</span>
          <input name="name" className="input" defaultValue={values.name} placeholder="Provincia" required />
        </label>
        <label className="field">
          <span className="label">Código</span>
          <input name="code" className="input" defaultValue={values.code} placeholder="PROVINCIA" required autoCapitalize="characters" />
        </label>
      </div>

      <label className="field">
        <span className="label">Web oficial</span>
        <input name="website" className="input" type="url" inputMode="url" defaultValue={values.website ?? ""} placeholder="https://" />
      </label>

      <div className="fields-3">
        <label className="field">
          <span className="label">{hasLogo ? "Cambiar logo" : "Logo"}</span>
          <input type="file" name="logo" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="input file" />
        </label>
        <label className="field">
          <span className="label">Color principal</span>
          <input name="primary" className="input" defaultValue={values.brandPrimaryColor ?? ""} placeholder="#000096" />
        </label>
        <label className="field">
          <span className="label">Color de acento</span>
          <input name="secondary" className="input" defaultValue={values.brandSecondaryColor ?? ""} placeholder="#F5C400" />
        </label>
      </div>

      <label className="check">
        <input type="checkbox" name="quinielaDraws" defaultChecked={values.quinielaDraws} />
        <span>Sus sorteos de Quiniela se ofrecen en Laqui (programa, resultados, jugadas)</span>
      </label>
      <label className="check">
        <input type="checkbox" name="active" defaultChecked={values.active} />
        <span>Activa</span>
      </label>

      <div className="row">
        <p className={`small ${state ? (state.ok ? "ok-text" : "error") : "muted"}`} role="status">
          {state?.message ?? "El logo y los colores se usan en las imágenes para redes de las agencias de esa provincia."}
        </p>
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "Guardando…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
