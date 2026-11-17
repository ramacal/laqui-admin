import Link from "next/link";
import { ownedAgencies, requireAccess } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { SimpleForm } from "@/components/schedule/simple-form";
import { createTemplate } from "./actions";

export const metadata = { title: "Horarios · Laqui" };

export default async function TemplatesPage() {
  const access = await requireAccess();
  const agencies = await ownedAgencies(access);
  const templates = await prisma.scheduleTemplate.findMany({
    where: access.isPlatformAdmin ? {} : { ownerUserId: access.user.id },
    include: { _count: { select: { agencies: true, rules: true } }, owner: { select: { name: true } } },
    orderBy: { name: "asc" },
  });

  return (
    <main className="screen">
      <Link href="/panel" className="back">
        ← Panel
      </Link>
      <div className="stack-xs">
        <h1>Plantillas de horario</h1>
        <p className="muted small">
          Armá un horario una vez y aplicalo a varias agencias. Si lo cambiás, cambia en todas las que lo usan.
        </p>
      </div>

      {agencies.length === 0 ? (
        <p className="card muted">Las plantillas son para dueños de agencias. Tu usuario no es dueño de ninguna.</p>
      ) : (
        <>
          {templates.length > 0 && (
            <ul className="list">
              {templates.map((t) => (
                <li key={t.id}>
                  <Link href={`/panel/horarios/${t.id}`} className="card row link-card">
                    <div className="stack-xs">
                      <strong>{t.name}</strong>
                      <span className="muted small">
                        {t._count.agencies} agencia(s){t._count.rules === 0 ? " · sin horario cargado" : ""}
                        {access.isPlatformAdmin ? ` · de ${t.owner.name}` : ""}
                      </span>
                    </div>
                    <span className="chevron" aria-hidden="true">
                      ›
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          <section className="card stack-sm">
            <h2>Nueva plantilla</h2>
            <SimpleForm action={createTemplate} submitLabel="Crear plantilla">
              <label className="field">
                <span className="small muted">Nombre</span>
                <input name="name" className="input" placeholder="Horario general" required maxLength={80} />
              </label>
            </SimpleForm>
          </section>
        </>
      )}
    </main>
  );
}
