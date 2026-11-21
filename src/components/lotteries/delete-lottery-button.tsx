"use client";

import { useActionState } from "react";
import type { FormState } from "@/app/panel/loterias/actions";

export function DeleteLotteryButton({ action, name }: { action: (prev: FormState) => Promise<FormState>; name: string }) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form
      action={formAction}
      className="stack-xs"
      onSubmit={(e) => {
        if (!confirm(`¿Eliminar la lotería de ${name}? No se puede deshacer.`)) e.preventDefault();
      }}
    >
      <button type="submit" className="btn btn-danger btn-sm" disabled={pending}>
        {pending ? "Eliminando…" : "Eliminar lotería"}
      </button>
      {state && !state.ok && (
        <p className="small error" role="status">
          {state.message}
        </p>
      )}
    </form>
  );
}
