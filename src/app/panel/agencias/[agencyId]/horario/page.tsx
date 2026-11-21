import { notFound } from "next/navigation";
import { agencyRole, canEditAgencyExceptions, canEditAgencyHours, requireAccess } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import {
  WEEKDAYS_UI,
  dateValue,
  formatRanges,
  getDaySchedule,
  getWeek,
  isAgencyOpen,
  todayIn,
  upcomingExceptions,
  upcomingHolidays,
  type ScheduleScope,
} from "@/lib/schedule";
import { WeeklyHoursEditor } from "@/components/schedule/weekly-hours-editor";
import { ExceptionForm } from "@/components/schedule/exception-form";
import {
  CloseAllHolidaysButton,
  ExceptionsList,
  HolidaysList,
  WeekList,
  formatDateRange,
} from "@/components/schedule/schedule-lists";
import { SimpleForm } from "@/components/schedule/simple-form";
import { RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EditableSection } from "@/components/ui/editable-section";
import { PageHeader } from "@/components/ui/page-header";
import { Row, RowList } from "@/components/ui/row-list";
import { SettingsPage, SettingsSection } from "@/components/ui/settings-section";
import { addException, resetAgencyToGeneral, saveAgencyWeek } from "@/app/panel/horarios/actions";

export const metadata = { title: "Horario de la agencia · Laqui" };

const SOURCE_LABEL = {
  AGENCY_EXCEPTION: "excepción de la agencia",
  TEMPLATE_EXCEPTION: "excepción del horario general",
  AGENCY_WEEKLY: "horario de la agencia",
  TEMPLATE_WEEKLY: "horario general",
} as const;

const addDays = (iso: string, n: number) => new Date(dateValue(iso).getTime() + n * 86_400_000).toISOString().slice(0, 10);

export default async function AgencySchedulePage({
  params,
  searchParams,
}: {
  params: Promise<{ agencyId: string }>;
  searchParams: Promise<{ desde?: string; hasta?: string }>;
}) {
  const { agencyId } = await params;
  const { desde, hasta } = await searchParams;
  const access = await requireAccess();
  const role = agencyRole(access, agencyId);
  if (!role) notFound();

  const agency = await prisma.agency.findUnique({
    where: { id: agencyId },
    select: {
      id: true,
      name: true,
      timezone: true,
      customHours: true,
      scheduleTemplate: { select: { id: true, groupId: true } },
    },
  });
  if (!agency) notFound();

  const canHours = canEditAgencyHours(role);
  const canExceptions = canEditAgencyExceptions(role);
  const general = agency.scheduleTemplate;
  const inherits = Boolean(general) && !agency.customHours;
  const today = todayIn(agency.timezone);
  const agencyScope: ScheduleScope = { agencyId };
  const generalScope: ScheduleScope | null = general ? { templateId: general.id } : null;

  const [now, week, ownExceptions, generalExceptions, holidays, next7] = await Promise.all([
    isAgencyOpen(agencyId),
    getWeek(inherits && generalScope ? generalScope : agencyScope),
    upcomingExceptions(agencyScope, today),
    generalScope ? upcomingExceptions(generalScope, today) : Promise.resolve([]),
    upcomingHolidays(generalScope ? [agencyScope, generalScope] : [agencyScope], today),
    Promise.all(Array.from({ length: 7 }, (_, i) => getDaySchedule(agencyId, addDays(today, i)))),
  ]);

  // General exceptions this agency already changed (any own exception overlapping its dates).
  const overridden = new Set(
    generalExceptions
      .filter((g) => ownExceptions.some((o) => o.startDate <= g.endDate && o.endDate >= g.startDate))
      .map((g) => g.id),
  );
  const pendingHolidays = holidays.filter((h) => !h.covered).length;

  return (
    <main className="screen">
      <PageHeader
        back={{ href: `/panel/agencias/${agencyId}`, label: agency.name }}
        title="Horario"
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone={now.open ? "success" : "neutral"}>{now.open ? "Abierta ahora" : "Cerrada ahora"}</Badge>
            <span>
              {now.localTime} hs
              {now.open ? ` · cierra ${now.closesAt}` : now.opensNextAt ? ` · abre ${now.opensNextAt}` : ""}
              {` · ${SOURCE_LABEL[now.source]}`}
              {now.reason ? ` · ${now.reason}` : ""}
            </span>
          </span>
        }
      />

      <SettingsPage>
        <SettingsSection title="Próximos 7 días" description="Cómo va a abrir, con las excepciones y feriados ya aplicados.">
          <RowList>
            {next7.map((d) => (
              <Row
                key={d.date}
                muted={d.closed}
                title={formatDateRange(d.date, d.date)}
                detail={
                  d.holiday ? (
                    <>
                      {d.holiday.name}
                      {d.holidayWithoutException && <span className="text-warning"> · feriado sin excepción</span>}
                    </>
                  ) : undefined
                }
                trailing={<span className={`text-sm ${d.closed ? "text-muted-foreground" : ""}`}>{formatRanges(d.ranges)}</span>}
              />
            ))}
          </RowList>
        </SettingsSection>

        <EditableSection
          title="Horario semanal por defecto"
          description={
            !general
              ? "Los días y horas en que abre habitualmente."
              : inherits
                ? "Lo hereda del horario general del grupo de agencias. Si lo cambiás acá, esta agencia queda personalizada y las demás no cambian."
                : "Esta agencia tiene su propio horario: ya no hereda el del grupo. Las excepciones del horario general se siguen aplicando."
          }
          canEdit={canHours}
          status={
            <Badge tone={inherits ? "neutral" : "success"}>
              {!general ? "Propio" : inherits ? "Heredado del grupo" : "Personalizado"}
            </Badge>
          }
          view={<WeekList week={week} />}
          forms={
            general && !inherits && canHours
              ? [
                  {
                    key: "volver",
                    label: "Volver al general",
                    icon: <RotateCcw key="icon" />,
                    form: (
                      <SimpleForm key="form" footer action={resetAgencyToGeneral.bind(null, agencyId)} submitLabel="Volver al general">
                        <p className="text-sm text-muted-foreground">
                          La agencia vuelve a usar el horario semanal del grupo y se borra su horario propio. Sus
                          excepciones quedan como están.
                        </p>
                      </SimpleForm>
                    ),
                  },
                ]
              : []
          }
        >
          <WeeklyHoursEditor initial={week} action={saveAgencyWeek.bind(null, agencyId)} />
        </EditableSection>

        <EditableSection
          id="agregar"
          title="Excepciones"
          description="Días que abre distinto o cierra: vacaciones, inventario, feriados. Las del horario general valen para todas las agencias, y cada una puede cambiarlas."
          canEdit={canExceptions}
          addLabel="Agregar excepción"
          defaultOpen={Boolean(desde)}
          view={<ExceptionLists />}
        >
          <ExceptionForm
            key={`${desde ?? ""}-${hasta ?? ""}`}
            action={addException.bind(null, "agency", agencyId)}
            today={today}
            defaultStart={desde}
            defaultEnd={hasta}
          />
        </EditableSection>

        <SettingsSection
          title="Próximos feriados"
          description="Los feriados no cierran solos: si no tienen excepción, la agencia abre con su horario normal."
          actions={canExceptions && pendingHolidays > 1 ? <CloseAllHolidaysButton scope={{ kind: "agency", id: agencyId }} /> : undefined}
        >
          <HolidaysList items={holidays} scope={{ kind: "agency", id: agencyId }} canEdit={canExceptions} />
        </SettingsSection>
      </SettingsPage>
    </main>
  );

  // General exceptions this agency already changed are not repeated: its own exception for those
  // dates says what it does instead ("Abre normal (general: …)").
  function ExceptionLists() {
    const inherited = generalExceptions.filter((g) => !overridden.has(g.id));
    if (inherited.length + ownExceptions.length === 0)
      return <p className="text-sm text-muted-foreground">No hay excepciones próximas.</p>;
    return (
      <div className="flex flex-col gap-4">
        {inherited.length > 0 && (
          <div className="flex flex-col gap-1">
            <h3 className="m-0 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Del horario general</h3>
            <ExceptionsList items={inherited} inheritedBy={{ agencyId, canEdit: canExceptions, overridden }} />
          </div>
        )}
        {ownExceptions.length > 0 && (
          <div className="flex flex-col gap-1">
            <h3 className="m-0 text-xs font-semibold tracking-wide text-muted-foreground uppercase">De esta agencia</h3>
            <ExceptionsList items={ownExceptions} canDelete={canExceptions} />
          </div>
        )}
      </div>
    );
  }
}
