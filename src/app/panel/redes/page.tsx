import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAccess } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { KIND_LABEL, TOPIC_LABEL } from "@/lib/content/text";

export const metadata = { title: "Ideas para redes · Laqui" };

const pad = (n: number) => String(n).padStart(2, "0");

export default async function ContentAdminPage() {
  const access = await requireAccess();
  if (!access.isPlatformAdmin) notFound();

  const [ideas, meanings] = await Promise.all([
    prisma.contentIdea.findMany({
      include: { province: { select: { code: true } }, numbers: true },
      orderBy: [{ month: "asc" }, { day: "asc" }, { popularity: "desc" }],
    }),
    prisma.quinielaNumberMeaning.findMany({ orderBy: { number: "asc" } }),
  ]);

  return (
    <main className="screen wide">
      <div className="stack-xs">
        <h1>Ideas para redes</h1>
        <p className="muted">
          El banco de ideas que se repite cada año y el significado de los números.
        </p>
      </div>

      <Link href="/panel/loterias" className="card row link-card">
        <div className="stack-xs">
          <strong>Logos y colores de las loterías</strong>
          <span className="small muted">Las imágenes llevan el logo de la lotería oficial de la provincia de cada agencia.</span>
        </div>
        <span className="chevron" aria-hidden="true">
          ›
        </span>
      </Link>

      <section className="stack-sm">
        <div className="row">
          <h2>Banco de ideas</h2>
          <span className="muted small">{ideas.length} ideas</span>
        </div>
        <div className="card table-scroll">
          <table className="program-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Idea</th>
                <th>Tipo</th>
                <th>Tema</th>
                <th>Alcance</th>
                <th>Números fijos</th>
              </tr>
            </thead>
            <tbody>
              {ideas.map((i) => (
                <tr key={i.id} className={i.active ? "" : "voided"}>
                  <td>
                    {pad(i.day)}/{pad(i.month)}
                    {i.year ? `/${i.year}` : ""}
                  </td>
                  <td>{i.title}</td>
                  <td>{KIND_LABEL[i.kind]}</td>
                  <td>{TOPIC_LABEL[i.topic]}</td>
                  <td>{i.province ? i.province.code : "País"}</td>
                  <td>{i.numbers.map((n) => `${n.value} (${n.reason})`).join(", ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="stack-sm">
        <h2>Significado de los números</h2>
        <ul className="number-list">
          {meanings.map((m) => (
            <li key={m.number} className={m.usable ? "" : "voided"} title={m.usable ? undefined : "No se usa en posteos"}>
              <strong>{pad(m.number)}</strong>
              <span className="small">{m.meaning}</span>
              {!m.usable && <span className="small muted">no se publica</span>}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
