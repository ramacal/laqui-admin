"use client";

// A row action that needs a second look (remove someone, delete something): the button turns into
// a short question with "Sí, …" and "Cancelar" right where it was. The action returns FormState,
// shown under it when it fails.
import { useActionState, useState, type ReactNode } from "react";
import type { FormState } from "@/app/panel/horarios/actions";
import { Button } from "@/components/ui/button";

export function ConfirmAction({
  label,
  icon,
  question,
  confirmLabel,
  action,
}: {
  label: string; // "Sacar"
  icon?: ReactNode;
  question: ReactNode; // "Deja de ver las agencias del grupo."
  confirmLabel: string; // "Sí, sacar"
  action: (prev: FormState, form: FormData) => Promise<FormState | void>; // void: plain server actions
}) {
  const [asking, setAsking] = useState(false);
  const [state, formAction, pending] = useActionState(async (prev: FormState, form: FormData) => (await action(prev, form)) ?? null, null);

  if (!asking)
    return (
      <Button variant="destructive-outline" size="sm" onClick={() => setAsking(true)}>
        {icon} {label}
      </Button>
    );
  return (
    <form action={formAction} className="flex max-w-80 flex-col items-end gap-2 text-right">
      <p className="text-sm text-muted-foreground">{question}</p>
      <div className="flex gap-2">
        <Button variant="ghost" size="sm" onClick={() => setAsking(false)} disabled={pending}>
          Cancelar
        </Button>
        <Button type="submit" variant="destructive" size="sm" disabled={pending}>
          {pending ? "Guardando…" : confirmLabel}
        </Button>
      </div>
      {state && !state.ok && <p className="text-sm text-destructive">{state.message}</p>}
    </form>
  );
}
