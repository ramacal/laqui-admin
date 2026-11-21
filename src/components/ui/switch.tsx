"use client";

// On/off switch that submits the form it sits in (a server action per toggle). Shows the new
// state right away while the server saves; `label` is what the switch turns on, for screen readers.
import { useFormStatus } from "react-dom";
import { cn } from "@/lib/utils";

export function SubmitSwitch({ checked, label, disabled = false }: { checked: boolean; label: string; disabled?: boolean }) {
  const { pending } = useFormStatus();
  const on = pending ? !checked : checked;
  return (
    <button
      type="submit"
      role="switch"
      aria-checked={on}
      aria-label={label}
      title={label}
      disabled={disabled || pending}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-0 p-0 transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50",
        on ? "bg-primary" : "bg-input",
        pending && "cursor-progress",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "inline-block size-5 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.25)] transition-transform",
          on ? "translate-x-[22px]" : "translate-x-0.5",
        )}
      />
    </button>
  );
}

/** Plain on/off switch for client forms (no submit): e.g. a weekday open or closed. */
export function Switch({
  checked,
  onChange,
  label,
  disabled = false,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-0 p-0 transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "bg-primary" : "bg-input",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "inline-block size-5 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.25)] transition-transform",
          checked ? "translate-x-[22px]" : "translate-x-0.5",
        )}
      />
    </button>
  );
}
