"use client";

import { useActionState } from "react";
import type { OwnerEmailState } from "@/app/panel/agencias/[agencyId]/actions";

type Props = {
  currentEmail: string | null;
  action: (prev: OwnerEmailState, form: FormData) => Promise<OwnerEmailState>;
};

export function OwnerEmailForm({ currentEmail, action }: Props) {
  const [state, formAction, pending] = useActionState(action, null);

  return (
    <form action={formAction} className="stack-sm">
      <label htmlFor="owner-email" className="small muted">
        Email de Google del dueño
      </label>
      <div className="inline-form">
        <input
          id="owner-email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="off"
          required
          defaultValue={currentEmail ?? ""}
          placeholder="titular@gmail.com"
          className="input"
          aria-describedby="owner-email-msg"
        />
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "Guardando…" : "Guardar"}
        </button>
      </div>
      <p id="owner-email-msg" className={`small ${state ? (state.ok ? "ok-text" : "error") : "muted"}`} role="status">
        {state?.message ?? "Con este email el dueño entra con Google y ve la agencia."}
      </p>
    </form>
  );
}
