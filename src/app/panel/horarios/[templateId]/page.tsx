import Link from "next/link";
import { notFound } from "next/navigation";
import { getEditableTemplate, ownedAgencies, requireAccess } from "@/lib/access";
import { getWeek, todayIn, upcomingExceptions, upcomingHolidays } from "@/lib/schedule";
import { WeeklyHoursEditor } from "@/components/schedule/weekly-hours-editor";
import { ExceptionForm } from "@/components/schedule/exception-form";
import { ExceptionsList, HolidaysList } from "@/components/schedule/schedule-lists";
import { SimpleForm } from "@/components/schedule/simple-form";
import { addException, deleteTemplate, renameTemplate, saveWeek, setTemplateAgencies } from "../actions";

export const metadata = { title: "Plantilla de horario · Laqui" };
const TZ = "America/Argentina/Buenos_Aires";

export default async function TemplatePage({ params }: { params: Promise<{ templateId: string }> }) {
  const { templateId } = await params;
  const access = await requireAccess();
  const template = await getEditableTemplate(access, templateId);
  if (!template) notFound();

  const today = todayIn(TZ);
  const scope = { templateId };
  const [week, agencies, exceptions, holidays] = await Promise.all([
    getWeek(scope),
    ownedAgencies(access),
    upcomingExceptions(scope, today),
    upcomingHolidays([scope], today),
  ]);

  return (
    <main className="screen">
      <Link href="/panel/horarios" className="back">
        ← Plantillas
      </Link>
      <h1>{template.name}</h1>

      <section className="stack-sm">
        <h2>Horario semanal</h2>
        <WeeklyHoursEditor initial={week} action={saveWeek.bind(null, "template", templateId)} />
      </section>

      <section className="card stack-sm">
        <h2>Agencias que la usan</h2>
        <SimpleForm action={setTemplateAgencies.bind(null, templateId)} submitLabel="Guardar agencias">
          <ul className="list plain">
            {agencies.map((a) => (
              <li key={a.id}>
                <label className="check">
                  <input type="checkbox" name="agencyId" value={a.id} defaultChecked={a.scheduleTemplateId === templateId} />
                  <span>
                    {a.name}
                    {a.scheduleTemplateId && a.scheduleTemplateId !== templateId && (
                      <span className="muted small"> · usa otra plantilla</span>
                    )}
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <p className="muted small">Si quitás una agencia, conserva este horario como horario propio.</p>
        </SimpleForm>
      </section>

      <section className="card stack-sm">
        <h2>Excepciones</h2>
        <p className="muted small">Se aplican a todas las agencias de la plantilla. Cada agencia puede tener además las suyas.</p>
        <ExceptionsList items={exceptions} canDelete />
        <details>
          <summary>Agregar excepción</summary>
          <div className="spaced">
            <ExceptionForm action={addException.bind(null, "template", templateId)} today={today} />
          </div>
        </details>
      </section>

      <section className="card stack-sm">
        <h2>Próximos feriados</h2>
        <p className="muted small">Los feriados no cierran solos: elegí en cuáles cierran las agencias de esta plantilla.</p>
        <HolidaysList items={holidays} scope={{ kind: "template", id: templateId }} canEdit />
      </section>

      <section className="card stack-sm">
        <h2>Ajustes</h2>
        <SimpleForm action={renameTemplate.bind(null, templateId)} submitLabel="Cambiar nombre" className="inline-form">
          <input name="name" className="input" defaultValue={template.name} aria-label="Nombre de la plantilla" required />
        </SimpleForm>
        <form action={deleteTemplate.bind(null, templateId)}>
          <button type="submit" className="btn btn-danger">
            Eliminar plantilla
          </button>
        </form>
        <p className="muted small">Al eliminarla, cada agencia que la usaba conserva el horario como propio.</p>
      </section>
    </main>
  );
}
