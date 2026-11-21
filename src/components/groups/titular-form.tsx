"use client";

// Titular of the agency (spec agency-groups). The access question shows only when the email typed
// is not already an owner of the group, and it has no default: the person decides.
import { useActionState, useState } from "react";
import type { FormState } from "@/app/panel/horarios/actions";
import { FormActions } from "@/components/ui/editable-section";

const CHOICES = [
  { value: "OWNER", label: "Dueño del grupo", hint: "Ve y maneja todas las agencias del grupo" },
  { value: "ADMIN", label: "Administrador de esta agencia", hint: "Solo esta agencia" },
  { value: "NONE", label: "Sin acceso", hint: "Queda como dato legal" },
] as const;

export function TitularForm({
  action,
  values,
  ownerEmails,
}: {
  action: (prev: FormState, form: FormData) => Promise<FormState>;
  values: { firstName: string; lastName: string; cuil: string; email: string };
  ownerEmails: string[];
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const [email, setEmail] = useState(values.email);
  const typed = email.trim().toLowerCase();
  const asks = typed.includes("@") && !ownerEmails.includes(typed) && typed !== values.email.toLowerCase();

  return (
    <form action={formAction} className="stack-sm">
      <div className="grid-2">
        <label className="field">
          <span className="small muted">Nombres</span>
          <input name="firstName" className="input" defaultValue={values.firstName} required />
        </label>
        <label className="field">
          <span className="small muted">Apellido</span>
          <input name="lastName" className="input" defaultValue={values.lastName} required />
        </label>
        <label className="field">
          <span className="small muted">CUIL (opcional)</span>
          <input name="cuil" className="input" inputMode="numeric" defaultValue={values.cuil} placeholder="20-30123456-3" />
        </label>
        <label className="field">
          <span className="small muted">Email de Google (opcional)</span>
          <input
            name="email"
            type="email"
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="nombre@gmail.com"
            autoComplete="off"
          />
        </label>
      </div>

      {asks && (
        <fieldset className="choice-group">
          <legend className="small">¿Qué acceso le das?</legend>
          {CHOICES.map((c) => (
            <label key={c.value} className="choice">
              <input type="radio" name="access" value={c.value} required />
              <span className="stack-xs">
                <strong className="small">{c.label}</strong>
                <span className="muted small">{c.hint}</span>
              </span>
            </label>
          ))}
        </fieldset>
      )}
      {typed && ownerEmails.includes(typed) && <p className="small muted">Ese email ya es de un dueño del grupo.</p>}

      <FormActions state={state} pending={pending} />
    </form>
  );
}
