// Server components shared by the general schedule and agency schedule screens: the week, the
// exceptions and the holidays, as compact rows (RowList) with their actions on the right.
import Link from "next/link";
import { CalendarClock, Lock, Trash2 } from "lucide-react";
import type { ScheduleExceptionKind } from "@/generated/prisma/enums";
import {
  closeOnAllHolidays,
  closeOnHoliday,
  deleteException,
  openNormallyHere,
  type ScopeKind,
} from "@/app/panel/horarios/actions";
import { WEEKDAYS_UI, describeException, formatRanges, type Range, type Week } from "@/lib/schedule";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Row, RowList } from "@/components/ui/row-list";

const fmt = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("es-AR", {
    timeZone: "UTC",
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });

export const formatDateRange = (start: string, end: string) => (start === end ? fmt(start) : `${fmt(start)} → ${fmt(end)}`);

const HOLIDAY_KIND = { FIXED: "inamovible", MOVABLE: "trasladable", BRIDGE: "puente" } as const;

/** The usual week, read-only: one row per day, Monday first. */
export function WeekList({ week }: { week: Week }) {
  return (
    <RowList>
      {WEEKDAYS_UI.map(({ day, label }) => (
        <Row
          key={day}
          muted={week[day].length === 0}
          title={label}
          trailing={
            <span className={`text-sm ${week[day].length ? "" : "text-muted-foreground"}`}>{formatRanges(week[day])}</span>
          }
        />
      ))}
    </RowList>
  );
}

type ExceptionRow = {
  id: string;
  startDate: string;
  endDate: string;
  kind: ScheduleExceptionKind;
  reason: string | null;
  slots: Range[];
};

/** Exceptions of one scope. `canDelete` for its own; `inheritedBy` for general ones shown in an agency. */
export function ExceptionsList({
  items,
  canDelete = false,
  inheritedBy,
  empty = "No hay excepciones cargadas.",
}: {
  items: ExceptionRow[];
  canDelete?: boolean;
  inheritedBy?: { agencyId: string; canEdit: boolean; overridden: Set<string> };
  empty?: string;
}) {
  if (items.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <RowList>
      {items.map((e) => {
        const overridden = inheritedBy?.overridden.has(e.id);
        return (
          <Row
            key={e.id}
            muted={overridden}
            title={<span className={overridden ? "line-through" : ""}>{formatDateRange(e.startDate, e.endDate)}</span>}
            badge={overridden ? <Badge>Cambiada en esta agencia</Badge> : undefined}
            detail={`${describeException(e)}${e.reason ? ` · ${e.reason}` : ""}`}
            trailing={
              canDelete ? (
                <form action={deleteException.bind(null, e.id)} className="flex">
                  <Button
                    type="submit"
                    variant="quiet"
                    size="icon"
                    aria-label={`Eliminar excepción del ${e.startDate}`}
                    title="Eliminar"
                  >
                    <Trash2 />
                  </Button>
                </form>
              ) : inheritedBy?.canEdit && !overridden ? (
                <div className="flex flex-wrap justify-end gap-2">
                  <form action={openNormallyHere.bind(null, inheritedBy.agencyId, e.id)} className="flex">
                    <Button type="submit" variant="outline" size="sm">
                      Abrir normal
                    </Button>
                  </form>
                  <Link
                    href={`?desde=${e.startDate}&hasta=${e.endDate}#agregar`}
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                    scroll={false}
                  >
                    <CalendarClock /> Horario especial
                  </Link>
                </div>
              ) : undefined
            }
          />
        );
      })}
    </RowList>
  );
}

type HolidayRow = { id: string; date: string; name: string; kind: keyof typeof HOLIDAY_KIND; covered: boolean };

export function HolidaysList({
  items,
  scope,
  canEdit,
}: {
  items: HolidayRow[];
  scope: { kind: ScopeKind; id: string };
  canEdit: boolean;
}) {
  if (items.length === 0) return <p className="text-sm text-muted-foreground">No hay feriados cargados para los próximos meses.</p>;
  return (
    <RowList>
      {items.map((h) => (
        <Row
          key={h.id}
          title={`${fmt(h.date)} · ${h.name}`}
          detail={`${HOLIDAY_KIND[h.kind]} · ${h.covered ? "ya tiene excepción" : "se abre con horario normal"}`}
          trailing={
            canEdit && !h.covered ? (
              <form action={closeOnHoliday.bind(null, scope.kind, scope.id, h.id)} className="flex">
                <Button type="submit" variant="outline" size="sm">
                  <Lock /> Cerrar
                </Button>
              </form>
            ) : undefined
          }
        />
      ))}
    </RowList>
  );
}

/** "Cerrar en todos los feriados del próximo año", for a section's actions column. */
export function CloseAllHolidaysButton({ scope }: { scope: { kind: ScopeKind; id: string } }) {
  return (
    <form action={closeOnAllHolidays.bind(null, scope.kind, scope.id)} className="flex">
      <Button type="submit" variant="outline" size="sm" className="flex-1 lg:justify-start">
        <Lock /> Cerrar en todos
      </Button>
    </form>
  );
}
