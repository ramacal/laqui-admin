import Link from "next/link";
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
import { ExceptionsList, HolidaysList, formatDateRange } from "@/components/schedule/schedule-lists";
import { SimpleForm } from "@/components/schedule/simple-form";
import { addException, saveWeek, setAgencyMode } from "@/app/panel/horarios/actions";

export const metadata = { title: "Horario de la agencia · Laqui" };

const SOURCE_LABEL = {
  AGENCY_EXCEPTION: "excepción de la agencia",
  TEMPLATE_EXCEPTION: "excepción de la plantilla",
  AGENCY_WEEKLY: "horario propio",
  TEMPLATE_WEEKLY: "plantilla",
} as const;

const addDays = (iso: string, n: number) => new Date(dateValue(iso).getTime() + n * 86_400_000).toISOString().slice(0, 10);

export default async function AgencySchedulePage({ params }: { params: Promise<{ agencyId: string }> }) {
  const { agencyId } = await params;
  const access = await requireAccess();
  const role = agencyRole(access, agencyId);
  if (!role) notFound();

  const agency = await prisma.agency.findUnique({
    where: { id: agencyId },
    select: { id: true, name: true, timezone: true, scheduleTemplate: { select: { id: true, name: true, ownerUserId: true } } },
  });
  if (!agency) notFound();

  const canHours = canEditAgencyHours(role);
  const canExceptions = canEditAgencyExceptions(role);
  const template = agency.scheduleTemplate;
  const canEditTemplate = Boolean(template && (access.isPlatformAdmin || template.ownerUserId === access.user.id));
  const today = todayIn(agency.timezone);
  const agencyScope: ScheduleScope = { agencyId };
  const scopes: ScheduleScope[] = template ? [agencyScope, { templateId: template.id }] : [agencyScope];

  const [now, week, ownExceptions, templateExceptions, holidays, next7, templates] = await Promise.all([
    isAgencyOpen(agencyId),
    getWeek(template ? { templateId: template.id } : agencyScope),
    upcomingExceptions(agencyScope, today),
    template ? upcomingExceptions({ templateId: template.id }, today) : Promise.resolve([]),
    upcomingHolidays(scopes, today),
    Promise.all(Array.from({ length: 7 }, (_, i) => getDaySchedule(agencyId, addDays(today, i)))),
    canHours
      ? prisma.scheduleTemplate.findMany({
          where: access.isPlatformAdmin ? {} : { ownerUserId: access.user.id },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
  ]);

  return (
    <main className="screen">
      <Link href={`/panel/agencias/${agencyId}`} className="back">
        ← {agency.name}
      </Link>
      <h1>Horario</h1>

      <section className={`card stack-xs status ${now.open ? "is-open" : "is-closed"}`}>
        <strong>{now.open ? `Abierta ahora · cierra ${now.closesAt}` : "Cerrada ahora"}</strong>
        <span className="small">
          {now.localTime} hs · {SOURCE_LABEL[now.source]}
          {now.reason ? ` · ${now.reason}` : ""}
          {!now.open && now.opensNextAt ? ` · abre ${now.opensNextAt}` : ""}
        </span>
      </section>

      <section className="card stack-sm">
        <h2>Próximos 7 días</h2>
        <ul className="list plain">
          {next7.map((d) => (
            <li key={d.date} className="row exception-row">
              <span className="small">
                <strong>{formatDateRange(d.date, d.date)}</strong>
                {d.holiday ? <span className="muted"> · {d.holiday.name}</span> : null}
              </span>
              <span className={`small ${d.closed ? "muted" : ""}`}>
                {formatRanges(d.ranges)}
                {d.holidayWithoutException ? <span className="warn"> · feriado sin excepción</span> : null}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="stack-sm">
        <h2>Horario semanal</h2>
        {canHours && (
          <div className="card">
            <SimpleForm action={setAgencyMode.bind(null, agencyId)} submitLabel="Aplicar">
              <fieldset className="stack-xs">
                <legend className="small muted">Esta agencia usa</legend>
                {templates.map((t) => (
                  <label key={t.id} className="check">
                    <input type="radio" name="mode" value={`template:${t.id}`} defaultChecked={template?.id === t.id} />
                    <span>Plantilla «{t.name}»</span>
                  </label>
                ))}
                <label className="check">
                  <input type="radio" name="mode" value="custom" defaultChecked={!template} />
                  <span>Horario propio</span>
                </label>
              </fieldset>
              {templates.length === 0 && (
                <p className="muted small">
                  <Link href="/panel/horarios" className="link">
                    Creá una plantilla
                  </Link>{" "}
                  para compartir el horario entre tus agencias.
                </p>
              )}
            </SimpleForm>
          </div>
        )}

        {!template && canHours ? (
          <WeeklyHoursEditor initial={week} action={saveWeek.bind(null, "agency", agencyId)} />
        ) : (
          <div className="card stack-xs">
            {template && (
              <p className="small muted">
                Sigue la plantilla «{template.name}».{" "}
                {canEditTemplate && (
                  <Link href={`/panel/horarios/${template.id}`} className="link">
                    Editar plantilla
                  </Link>
                )}
              </p>
            )}
            <ul className="list plain">
              {WEEKDAYS_UI.map(({ day, label }) => (
                <li key={day} className="row exception-row">
                  <span className="small">{label}</span>
                  <span className={`small ${week[day].length ? "" : "muted"}`}>{formatRanges(week[day])}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="card stack-sm">
        <h2>Excepciones de esta agencia</h2>
        <ExceptionsList items={ownExceptions} canDelete={canExceptions} />
        {template && templateExceptions.length > 0 && (
          <>
            <h3 className="small muted">Heredadas de la plantilla</h3>
            <ExceptionsList items={templateExceptions} canDelete={false} origin="plantilla" />
          </>
        )}
        {canExceptions && (
          <details>
            <summary>Agregar excepción</summary>
            <div className="spaced">
              <ExceptionForm action={addException.bind(null, "agency", agencyId)} today={today} />
            </div>
          </details>
        )}
      </section>

      <section className="card stack-sm">
        <h2>Próximos feriados</h2>
        <HolidaysList items={holidays} scope={{ kind: "agency", id: agencyId }} canEdit={canExceptions} />
      </section>
    </main>
  );
}
