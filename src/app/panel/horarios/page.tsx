import { currentGroupId, requireAccess } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { agenciesOfGroup, getWeek, todayIn, upcomingExceptions, upcomingHolidays, type Week } from "@/lib/schedule";
import { WeeklyHoursEditor } from "@/components/schedule/weekly-hours-editor";
import { ExceptionForm } from "@/components/schedule/exception-form";
import { CloseAllHolidaysButton, ExceptionsList, HolidaysList, WeekList } from "@/components/schedule/schedule-lists";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { EditableSection } from "@/components/ui/editable-section";
import { PageHeader } from "@/components/ui/page-header";
import { SettingsPage, SettingsSection } from "@/components/ui/settings-section";
import { addException, saveGeneralWeek } from "./actions";

export const metadata = { title: "Horario general · Laqui" };
const TZ = "America/Argentina/Buenos_Aires";
const EMPTY_WEEK: Week = [[], [], [], [], [], [], []];

// One "Horario general" per group (spec agency-groups). Owners of several groups, and platform
// admins, open another group's with ?group=<groupId>.
export default async function GeneralSchedulePage({ searchParams }: { searchParams: Promise<{ group?: string }> }) {
  const access = await requireAccess();
  const { group } = await searchParams;
  const groupId = currentGroupId(access, group);
  const agencies = groupId ? await agenciesOfGroup(groupId) : [];

  if (!groupId || agencies.length === 0) {
    return (
      <main className="screen">
        <PageHeader title="Horario general" subtitle="El horario general es para los dueños de un grupo de agencias." />
      </main>
    );
  }

  const today = todayIn(TZ);
  const general = await prisma.scheduleTemplate.findUnique({ where: { groupId } });
  const scope = general ? { templateId: general.id } : null;
  const [week, exceptions, holidays] = await Promise.all([
    scope ? getWeek(scope) : Promise.resolve(EMPTY_WEEK),
    scope ? upcomingExceptions(scope, today) : Promise.resolve([]),
    upcomingHolidays(scope ? [scope] : [], today),
  ]);
  const pendingHolidays = holidays.filter((h) => !h.covered).length;
  const empty = week.every((d) => d.length === 0);
  const own = agencies.filter((a) => !(general && a.scheduleTemplateId === general.id && !a.customHours));
  const users = agencies.length - own.length;

  return (
    <main className="screen">
      <PageHeader
        title="Horario general"
        subtitle={`El horario del grupo de agencias: lo heredan ${agencies.length === 1 ? "tu agencia" : `tus ${agencies.length} agencias`}.`}
      />

      <SettingsPage>
        <EditableSection
          title="Horario semanal por defecto"
          description={
            <>
              Los días y horas en que abren tus agencias habitualmente. Si cambiás el horario de una agencia en
              particular, esa queda personalizada y las demás siguen usando este.
              {own.length > 0 && (
                <>
                  {" "}
                  Con horario propio:{" "}
                  {own.map((a, i) => (
                    <span key={a.id}>
                      {i > 0 && ", "}
                      <Link href={`/panel/agencias/${a.id}/horario`} className="font-semibold text-primary hover:underline">
                        {a.name}
                      </Link>
                    </span>
                  ))}
                  .
                </>
              )}
            </>
          }
          empty={empty}
          status={
            <Badge tone={own.length === 0 ? "success" : "warning"}>
              {users === agencies.length
                ? agencies.length === 1
                  ? "Lo usa tu agencia"
                  : `Lo usan las ${agencies.length} agencias`
                : `Lo usan ${users} de ${agencies.length} agencias`}
            </Badge>
          }
          view={<WeekList week={week} />}
        >
          <WeeklyHoursEditor initial={week} action={saveGeneralWeek.bind(null, groupId)} />
        </EditableSection>

        <EditableSection
          title="Excepciones"
          description="Valen para todas tus agencias. Cada agencia puede cambiarlas o agregar las suyas."
          addLabel="Agregar excepción"
          view={<ExceptionsList items={exceptions} canDelete empty="No hay excepciones próximas." />}
        >
          <ExceptionForm action={addException.bind(null, "general", groupId)} today={today} />
        </EditableSection>

        <SettingsSection
          title="Próximos feriados"
          description="Los feriados no cierran solos: elegí en cuáles cierran tus agencias."
          actions={pendingHolidays > 1 ? <CloseAllHolidaysButton scope={{ kind: "general", id: groupId }} /> : undefined}
        >
          <HolidaysList items={holidays} scope={{ kind: "general", id: groupId }} canEdit />
        </SettingsSection>
      </SettingsPage>
    </main>
  );
}
