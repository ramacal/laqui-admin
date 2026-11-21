import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAccess } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { SimpleForm } from "@/components/schedule/simple-form";
import { createGroupAction } from "@/app/panel/grupo/actions";

export const metadata = { title: "Grupos y agencias · Laqui" };

// Platform admin: every group of agencies. A new agenciero starts here: create the group with
// the Google email of its first owner, then add its agencies (spec agency-groups).
export default async function GroupsPage() {
  const access = await requireAccess();
  if (!access.isPlatformAdmin) notFound();

  const groups = await prisma.agencyGroup.findMany({
    include: {
      owners: { select: { email: true, userId: true } },
      _count: { select: { agencies: { where: { active: true } } } },
    },
    orderBy: { name: "asc" },
  });

  return (
    <main className="screen">
      <div className="stack-xs">
        <h1>Grupos y agencias</h1>
        <p className="muted">Cada agenciero es un grupo: sus dueños y sus agencias.</p>
      </div>

      <section className="card stack-sm">
        <h2>Nuevo agenciero</h2>
        <SimpleForm action={createGroupAction} submitLabel="Crear grupo">
          <div className="grid-2">
            <label className="field">
              <span className="small muted">Nombre del grupo</span>
              <input name="name" className="input" placeholder="Agencias Pérez" required />
            </label>
            <label className="field">
              <span className="small muted">Email de Google del dueño</span>
              <input name="ownerEmail" type="email" className="input" placeholder="nombre@gmail.com" required autoComplete="off" />
            </label>
          </div>
          <p className="small muted">El dueño entra con ese Gmail y ve el grupo. Las agencias se agregan en el paso siguiente.</p>
        </SimpleForm>
      </section>

      <ul className="list card-grid">
        {groups.map((g) => (
          <li key={g.id}>
            <Link href={`/panel/grupos/${g.id}`} className="card row link-card">
              <div className="stack-xs">
                <strong>{g.name}</strong>
                <span className="muted small">
                  {g._count.agencies} {g._count.agencies === 1 ? "agencia" : "agencias"} · {g.owners.length}{" "}
                  {g.owners.length === 1 ? "dueño" : "dueños"}
                  {g.owners.some((o) => !o.userId) ? " · alguno todavía no ingresó" : ""}
                </span>
              </div>
              <span className="chevron" aria-hidden="true">
                ›
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
