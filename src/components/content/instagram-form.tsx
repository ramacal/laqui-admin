"use client";

import { useActionState } from "react";
import type { SocialState } from "@/app/panel/agencias/[agencyId]/redes/actions";

type Props = {
  handle: string | null;
  email: string | null;
  canEdit: boolean;
  action: (prev: SocialState, form: FormData) => Promise<SocialState>;
};

export function InstagramForm({ handle, email, canEdit, action }: Props) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form action={formAction} className="stack-sm">
      <div className="grid-2">
        <label className="field">
          <span className="label">Cuenta de Instagram</span>
          <input name="handle" className="input" defaultValue={handle ? `@${handle}` : ""} placeholder="@tuagencia" autoComplete="off" disabled={!canEdit} />
        </label>
        <label className="field">
          <span className="label">Email de la cuenta</span>
          <input name="email" type="email" inputMode="email" className="input" defaultValue={email ?? ""} placeholder="redes@tuagencia.com" autoComplete="off" disabled={!canEdit} />
        </label>
      </div>
      {canEdit && (
        <div className="row">
          <p className={`small ${state ? (state.ok ? "ok-text" : "error") : "muted"}`} role="status">
            {state?.message ?? "La cuenta aparece en las imágenes. No guardamos contraseñas."}
          </p>
          <button type="submit" className="btn btn-primary" disabled={pending}>
            {pending ? "Guardando…" : "Guardar"}
          </button>
        </div>
      )}
    </form>
  );
}
