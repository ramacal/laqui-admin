// Shared pieces for price management (server components).
import { SimpleForm } from "@/components/schedule/simple-form";
import type { FormState } from "@/app/panel/productos/actions";

export const KIND_LABEL = {
  QUINIELA: "Monto libre por renglón",
  NUMBER_PICK: "Números a precio fijo",
  UNIT: "Venta por unidad",
} as const;

/** "$1.500" or "$1.234,50": cents only when there are any, always with two digits. */
export const money = (amount: string | number) => {
  const n = Number(amount);
  const digits = Number.isInteger(n) ? 0 : 2;
  return "$" + n.toLocaleString("es-AR", { minimumFractionDigits: digits, maximumFractionDigits: 2 });
};

const fmtDate = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("es-AR", { timeZone: "UTC", day: "2-digit", month: "2-digit", year: "numeric" });

type PriceRow = { id: string; amount: string; validFrom: string; note: string | null };

/** Price history, newest first, marking the one in effect and scheduled ones. */
export function PriceHistory({
  rows,
  today,
  deleteAction,
}: {
  rows: PriceRow[];
  today: string;
  deleteAction?: (priceId: string) => Promise<void>;
}) {
  if (rows.length === 0) return <p className="muted small">Sin precios cargados: no se ofrece.</p>;
  const sorted = [...rows].sort((a, b) => b.validFrom.localeCompare(a.validFrom));
  const currentId = sorted.find((r) => r.validFrom <= today)?.id;
  return (
    <ul className="list plain">
      {sorted.map((r) => {
        const scheduled = r.validFrom > today;
        const label = scheduled ? "programado" : r.id === currentId ? "vigente" : "anterior";
        return (
          <li key={r.id} className="row exception-row">
            <div className="stack-xs">
              <strong className={`small ${label === "anterior" ? "muted" : ""}`}>
                {money(r.amount)} <span className={`tag ${label === "vigente" ? "ok" : ""}`}>{label}</span>
              </strong>
              <span className="small muted">
                desde {fmtDate(r.validFrom)}
                {r.note ? ` · ${r.note}` : ""}
              </span>
            </div>
            {scheduled && deleteAction && (
              <form action={deleteAction.bind(null, r.id)}>
                <button type="submit" className="icon-btn" aria-label={`Cancelar precio programado del ${r.validFrom}`}>
                  ×
                </button>
              </form>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** New price from a date (today = change now; future date = scheduled change). */
export function PriceForm({
  action,
  today,
  amountLabel = "Precio",
  footer = false,
  children,
}: {
  action: (prev: FormState, form: FormData) => Promise<FormState>;
  today: string;
  amountLabel?: string;
  footer?: boolean; // inside a panel: Cancelar + Guardar (FormActions)
  children?: React.ReactNode; // extra fields (e.g. a province picker or hidden inputs)
}) {
  return (
    <SimpleForm action={action} submitLabel="Guardar precio" footer={footer}>
      {children}
      <div className="grid-2">
        <label className="field">
          <span className="small muted">{amountLabel} ($)</span>
          <input name="amount" className="input" inputMode="decimal" placeholder="2500" required />
        </label>
        <label className="field">
          <span className="small muted">Vale desde</span>
          <input type="date" name="validFrom" className="input" defaultValue={today} required />
        </label>
      </div>
      <label className="field">
        <span className="small muted">Nota (opcional)</span>
        <input name="note" className="input" placeholder="Aumento de noviembre" maxLength={120} />
      </label>
    </SimpleForm>
  );
}

/**
 * Read-only price history for a panel's data: newest first, each with its state (programado,
 * vigente, anterior) and since when. Older ones are dimmed.
 */
export function PriceTimeline({ rows, today }: { rows: PriceRow[]; today: string }) {
  if (rows.length === 0) return <span className="text-warning">Sin precios cargados</span>;
  const sorted = [...rows].sort((a, b) => b.validFrom.localeCompare(a.validFrom));
  const currentId = sorted.find((r) => r.validFrom <= today)?.id;
  return (
    <ol className="m-0 flex list-none flex-col gap-1 p-0">
      {sorted.map((r) => {
        const state = r.validFrom > today ? "programado" : r.id === currentId ? "vigente" : "anterior";
        return (
          <li key={r.id} className={`flex flex-wrap items-baseline gap-x-2 text-sm ${state === "anterior" ? "text-muted-foreground" : ""}`}>
            <span className="min-w-16 font-semibold">{money(r.amount)}</span>
            <span
              className={`rounded-full px-2 text-xs font-semibold ${
                state === "vigente" ? "bg-success-soft text-success" : state === "programado" ? "bg-accent text-accent-foreground" : "bg-muted"
              }`}
            >
              {state}
            </span>
            <span className="text-muted-foreground">
              desde {fmtDate(r.validFrom)}
              {r.note ? ` · ${r.note}` : ""}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
