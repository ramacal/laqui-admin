"use client";

import { useActionState, type ReactNode } from "react";
import type { FormState } from "@/app/panel/horarios/actions";

/** Small form wrapper that shows the action's result message under its fields. */
export function SimpleForm({
  action,
  children,
  submitLabel,
  className = "stack-sm",
  buttonClassName = "btn btn-primary",
}: {
  action: (prev: FormState, form: FormData) => Promise<FormState>;
  children?: ReactNode;
  submitLabel: string;
  className?: string;
  buttonClassName?: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form action={formAction} className={className}>
      {children}
      <button type="submit" className={buttonClassName} disabled={pending}>
        {pending ? "Guardando…" : submitLabel}
      </button>
      {state && (
        <p className={`small ${state.ok ? "ok-text" : "error"}`} role="status">
          {state.message}
        </p>
      )}
    </form>
  );
}
