"use client";

import { useActionState, type ReactNode } from "react";
import type { FormState } from "@/app/panel/horarios/actions";
import { FormActions } from "@/components/ui/editable-section";

/** Small form wrapper that shows the action's result message under its fields. */
export function SimpleForm({
  action,
  children,
  submitLabel,
  className = "stack-sm",
  buttonClassName = "btn btn-primary",
  footer = false,
  danger = false,
}: {
  action: (prev: FormState, form: FormData) => Promise<FormState>;
  children?: ReactNode;
  submitLabel: string;
  className?: string;
  buttonClassName?: string;
  footer?: boolean; // the unified footer (FormActions): Cancelar inside an EditableSection + submit
  danger?: boolean; // with footer: the submit is a destructive action
}) {
  const [state, formAction, pending] = useActionState(action, null);
  if (footer) {
    return (
      <form action={formAction} className={className}>
        {children}
        <FormActions state={state} pending={pending} submitLabel={submitLabel} danger={danger} />
      </form>
    );
  }
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
