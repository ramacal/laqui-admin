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
      scheduleTemplate: { select: { id: true, ownerUserId: true } },
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
  const generalLink =
    general && (access.isPlatformAdmin || general.ownerUserId === access.user.id)
      ? `/panel/horarios${general.ownerUserId === access.user.id ? "" : `?owner=${general.ownerUserId}`}`
      : null;

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
        <div className="row">
          <h2>Horario semanal</h2>
          <span className={`badge ${inherits ? "neutral" : ""}`}>
            {!general ? "Propio" : inherits ? "Horario general" : "Personalizado"}
          </span>
        </div>

        {inherits && (
          <p className="muted small">
            Usa el horario general.{" "}
            {generalLink && (
              <Link href={generalLink} className="link">
                Ver horario general
              </Link>
            )}
            {canHours && " Si lo cambiás acá, esta agencia queda personalizada y el resto no cambia."}
          </p>
        )}
        {general && !inherits && canHours && (
          <div className="card stack-xs">
            <p className="small">Esta agencia tiene su propio horario semanal. Las excepciones del general se siguen aplicando.</p>
            <SimpleForm action={resetAgencyToGeneral.bind(null, agencyId)} submitLabel="Volver al horario general" />
          </div>
        )}

        {canHours ? (
          <WeeklyHoursEditor initial={week} action={saveAgencyWeek.bind(null, agencyId)} />
        ) : (
          <div className="card">
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
        <h2>Excepciones</h2>
        {generalExceptions.length > 0 && (
          <>
            <h3 className="small muted">Del horario general</h3>
            <ExceptionsList
              items={generalExceptions}
              inheritedBy={{ agencyId, canEdit: canExceptions, overridden }}
            />
            <h3 className="small muted">De esta agencia</h3>
          </>
        )}
        <ExceptionsList items={ownExceptions} canDelete={canExceptions} />
        {canExceptions && (
          <details id="agregar" open={Boolean(desde)}>
            <summary>{desde ? "Horario especial para esta agencia" : "Agregar excepción"}</summary>
            <div className="spaced">
              <ExceptionForm
                key={`${desde ?? ""}-${hasta ?? ""}`}
                action={addException.bind(null, "agency", agencyId)}
                today={today}
                defaultStart={desde}
                defaultEnd={hasta}
              />
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
