import Link from "next/link";
import { notFound } from "next/navigation";
import { agencyRole, requireAccess } from "@/lib/access";
import { agencyBrand } from "@/lib/content/brand";
import { KIND_LABEL, TOPIC_LABEL, ideaForAgency, isIsoDate, longDate, suggestedCaption, todayIn } from "@/lib/content/ideas";
import { PostEditor } from "@/components/content/post-editor";
import { prisma } from "@/lib/prisma";
import { savePictureToDrive } from "../../drive-actions";

export const metadata = { title: "Publicación · Laqui" };

export default async function IdeaPage({
  params,
  searchParams,
}: {
  params: Promise<{ agencyId: string; ideaId: string }>;
  searchParams: Promise<{ fecha?: string }>;
}) {
  const { agencyId, ideaId } = await params;
  const { fecha } = await searchParams;
  const access = await requireAccess();
  if (!agencyRole(access, agencyId)) notFound();
  const brand = await agencyBrand(agencyId);
  if (!brand) notFound();

  const date = isIsoDate(fecha) ? fecha : todayIn(brand.timezone);
  const idea = await ideaForAgency(ideaId, brand, date);
  if (!idea) notFound();

  const agencyText = { name: brand.name, city: brand.city, instagram: brand.instagram?.handle ?? null };
  const driveConn = await prisma.agencyDriveConnection.findUnique({ where: { agencyId }, select: { status: true } });
  const driveStatus = driveConn?.status === "ACTIVE" || driveConn?.status === "NEEDS_RECONNECT" ? driveConn.status : null;

  return (
    <main className="screen wide">
      <Link href={`/panel/agencias/${agencyId}/redes`} className="back">
        ← Redes
      </Link>
      <div className="stack-xs">
        <span className="label">
          {longDate(date)} · {KIND_LABEL[idea.kind]} · {TOPIC_LABEL[idea.topic]}
        </span>
        <h1>{idea.title}</h1>
        {idea.summary && <p className="muted">{idea.summary}</p>}
      </div>

      <section className="card stack-sm">
        <h2>Números para jugar</h2>
        <ul className="number-list">
          {idea.numbers.map((n) => (
            <li key={n.value}>
              <strong>{n.value}</strong>
              <span className="small muted">{n.reason}</span>
              {n.meaning && <span className="small">{n.meaning}</span>}
            </li>
          ))}
        </ul>
      </section>

      {!brand.instagram && (
        <p className="notice small">
          La agencia no tiene Instagram cargado: la imagen sale sin la cuenta.{" "}
          <Link href={`/panel/agencias/${agencyId}/redes`} className="link">
            Cargarlo
          </Link>
        </p>
      )}

      <PostEditor
        imageBase={`/panel/agencias/${agencyId}/redes/${idea.id}/imagen`}
        date={date}
        headline={idea.headline}
        caption={suggestedCaption(idea, agencyText)}
        idea={idea}
        agency={agencyText}
        drive={{ status: driveStatus, agencyHref: `/panel/agencias/${agencyId}/datos` }}
        saveToDrive={savePictureToDrive.bind(null, agencyId, idea.id)}
      />
    </main>
  );
}
