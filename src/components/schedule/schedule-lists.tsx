// Server components shared by the template and agency schedule screens.
import { closeOnAllHolidays, closeOnHoliday, deleteException } from "@/app/panel/horarios/actions";
import { formatRanges, type Range } from "@/lib/schedule";

const fmt = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("es-AR", {
    timeZone: "UTC",
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });

export const formatDateRange = (start: string, end: string) => (start === end ? fmt(start) : `${fmt(start)} → ${fmt(end)}`);

const HOLIDAY_KIND = { FIXED: "inamovible", MOVABLE: "trasladable", BRIDGE: "puente" } as const;

type ExceptionRow = {
  id: string;
  startDate: string;
  endDate: string;
  kind: "CLOSED" | "SPECIAL_HOURS";
  reason: string | null;
  slots: Range[];
};

export function ExceptionsList({
  items,
  canDelete,
  origin,
}: {
  items: ExceptionRow[];
  canDelete: boolean;
  origin?: string; // label for inherited exceptions, e.g. "de la plantilla"
}) {
  if (items.length === 0) return <p className="muted small">No hay excepciones cargadas.</p>;
  return (
    <ul className="list plain">
      {items.map((e) => (
        <li key={e.id} className="row exception-row">
          <div className="stack-xs">
            <strong className="small">{formatDateRange(e.startDate, e.endDate)}</strong>
            <span className="small muted">
              {e.kind === "CLOSED" ? "Cerrado" : formatRanges(e.slots)}
              {e.reason ? ` · ${e.reason}` : ""}
              {origin ? ` · ${origin}` : ""}
            </span>
          </div>
          {canDelete && (
            <form action={deleteException.bind(null, e.id)}>
              <button type="submit" className="icon-btn" aria-label={`Eliminar excepción del ${e.startDate}`}>
                ×
              </button>
            </form>
          )}
        </li>
      ))}
    </ul>
  );
}

type HolidayRow = { id: string; date: string; name: string; kind: keyof typeof HOLIDAY_KIND; covered: boolean };

export function HolidaysList({
  items,
  scope,
  canEdit,
}: {
  items: HolidayRow[];
  scope: { kind: "agency" | "template"; id: string };
  canEdit: boolean;
}) {
  if (items.length === 0) return <p className="muted small">No hay feriados cargados para los próximos meses.</p>;
  const pending = items.filter((h) => !h.covered).length;
  return (
    <div className="stack-sm">
      <ul className="list plain">
        {items.map((h) => (
          <li key={h.id} className="row exception-row">
            <div className="stack-xs">
              <strong className="small">
                {fmt(h.date)} · {h.name}
              </strong>
              <span className="small muted">
                {HOLIDAY_KIND[h.kind]}
                {h.covered ? " · ya tiene excepción" : " · se abre con horario normal"}
              </span>
            </div>
            {canEdit && !h.covered && (
              <form action={closeOnHoliday.bind(null, scope.kind, scope.id, h.id)}>
                <button type="submit" className="btn btn-secondary btn-sm">
                  Cerrar
                </button>
              </form>
            )}
          </li>
        ))}
      </ul>
      {canEdit && pending > 1 && (
        <form action={closeOnAllHolidays.bind(null, scope.kind, scope.id)}>
          <button type="submit" className="btn btn-secondary">
            Cerrar en todos los feriados del próximo año
          </button>
        </form>
      )}
    </div>
  );
}
