import Link from "next/link";
import { currentGroupId, requireAccess } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { agenciesOfGroup, getWeek, todayIn, upcomingExceptions, upcomingHolidays, type Week } from "@/lib/schedule";
import { WeeklyHoursEditor } from "@/components/schedule/weekly-hours-editor";
import { ExceptionForm } from "@/components/schedule/exception-form";
import { ExceptionsList, HolidaysList } from "@/components/schedule/schedule-lists";
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
        <Link href="/panel" className="back">
          ← Panel
        </Link>
        <h1>Horario general</h1>
        <p className="card muted">El horario general es para los dueños de un grupo de agencias.</p>
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

  return (
    <main className="screen">
      <Link href="/panel" className="back">
        ← Panel
      </Link>
      <div className="stack-xs">
        <h1>Horario general</h1>
        <p className="muted small">
          Lo heredan todas tus agencias. Si cambiás el horario de una agencia en particular, esa queda personalizada y el
          resto sigue usando este.
        </p>
      </div>

      <section className="stack-sm">
        <h2>Horario semanal</h2>
        <WeeklyHoursEditor initial={week} action={saveGeneralWeek.bind(null, groupId)} />
      </section>

      <section className="card stack-sm">
        <h2>Agencias</h2>
        <ul className="list plain">
          {agencies.map((a) => {
            const inherits = Boolean(general && a.scheduleTemplateId === general.id && !a.customHours);
            return (
              <li key={a.id} className="row exception-row">
                <Link href={`/panel/agencias/${a.id}/horario`} className="link small">
                  {a.name}
                </Link>
                <span className={`small ${inherits ? "muted" : "warn"}`}>
                  {!general ? "Sin horario general" : inherits ? "Usa el horario general" : "Personalizado"}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="card stack-sm">
        <h2>Excepciones</h2>
        <p className="muted small">Valen para todas tus agencias. Cada agencia puede cambiarlas o agregar las suyas.</p>
        <ExceptionsList items={exceptions} canDelete />
        <details>
          <summary>Agregar excepción</summary>
          <div className="spaced">
            <ExceptionForm action={addException.bind(null, "general", groupId)} today={today} />
          </div>
        </details>
      </section>

      <section className="card stack-sm">
        <h2>Próximos feriados</h2>
        <p className="muted small">Los feriados no cierran solos: elegí en cuáles cierran tus agencias.</p>
        <HolidaysList items={holidays} scope={{ kind: "general", id: groupId }} canEdit />
      </section>
    </main>
  );
}
