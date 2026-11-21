import Link from "next/link";
import { notFound } from "next/navigation";
import { agencyRole, canViewStaff, requireAccess } from "@/lib/access";
import { agencyBrand } from "@/lib/content/brand";
import { KIND_LABEL, TOPIC_LABEL, longDate, todayIn, upcomingIdeas } from "@/lib/content/ideas";
import { InstagramForm } from "@/components/content/instagram-form";
import { saveInstagram } from "./actions";

export const metadata = { title: "Redes · Laqui" };

const DAYS = 14;

export default async function SocialPage({ params }: { params: Promise<{ agencyId: string }> }) {
  const { agencyId } = await params;
  const access = await requireAccess();
  const role = agencyRole(access, agencyId);
  if (!role) notFound();
  const brand = await agencyBrand(agencyId);
  if (!brand) notFound();

  const today = todayIn(brand.timezone);
  const days = await upcomingIdeas(brand, today, DAYS);

  return (
    <main className="screen">
      <Link href={`/panel/agencias/${agencyId}`} className="back">
        ← {brand.name}
      </Link>
      <div className="stack-xs">
        <h1>Redes</h1>
        <p className="muted">Ideas para publicar con sus números para jugar, e imágenes con la marca de la agencia.</p>
      </div>

      <section className="card stack-sm">
        <h2>Instagram</h2>
        <InstagramForm
          handle={brand.instagram?.handle ?? null}
          email={brand.instagram?.email ?? null}
          canEdit={canViewStaff(role)}
          action={saveInstagram.bind(null, agencyId)}
        />
      </section>

      <section className="stack-sm">
        <h2>Próximos {DAYS} días</h2>
        <ul className="list">
          {days
            .filter((d) => d.ideas.length > 0)
            .map((d) => (
              <li key={d.date} className={`card stack-sm ${d.date === today ? "day-card is-today" : ""}`}>
                <div className="row">
                  <strong>{d.date === today ? `Hoy · ${longDate(d.date)}` : longDate(d.date)}</strong>
                  <span className="muted small">
                    {d.ideas.length} {d.ideas.length === 1 ? "idea" : "ideas"}
                  </span>
                </div>
                <ul className="list rows">
                  {d.ideas.map((idea) => (
                    <li key={idea.id}>
                      <Link href={`/panel/agencias/${agencyId}/redes/${idea.id}?fecha=${d.date}`} className="row list-row idea-row">
                        <span className="idea-number" aria-hidden="true">
                          {idea.main?.value}
                        </span>
                        <span className="stack-xs grow">
                          <strong>{idea.headline}</strong>
                          <span className="small muted">
                            {KIND_LABEL[idea.kind]} · {TOPIC_LABEL[idea.topic]}
                            {idea.main?.meaning ? ` · ${idea.main.value} ${idea.main.meaning}` : ""}
                          </span>
                        </span>
                        <span className="chevron" aria-hidden="true">
                          ›
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
        </ul>
        {days.every((d) => d.ideas.length === 0) && <p className="card muted">No hay ideas cargadas para estos días.</p>}
      </section>
    </main>
  );
}
