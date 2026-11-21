import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAccess } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { publicUrl } from "@/lib/storage";

export const metadata = { title: "Loterías · Laqui" };

export default async function LotteriesPage() {
  const access = await requireAccess();
  if (!access.isPlatformAdmin) notFound();

  const countries = await prisma.country.findMany({
    orderBy: { name: "asc" },
    include: {
      lotteries: {
        include: { province: { select: { name: true } } },
        orderBy: [{ active: "desc" }, { name: "asc" }],
      },
    },
  });
  const total = countries.reduce((n, c) => n + c.lotteries.length, 0);

  return (
    <main className="screen wide">
      <div className="row page-head">
        <div className="stack-xs">
          <h1>Loterías</h1>
          <p className="muted">
            Organismos oficiales por país y jurisdicción. Su logo y colores van en las imágenes para redes de las agencias de esa
            provincia. {total} cargadas.
          </p>
        </div>
        <Link href="/panel/loterias/nueva" className="btn btn-primary">
          Nueva lotería
        </Link>
      </div>

      {countries
        .filter((c) => c.lotteries.length > 0)
        .map((country) => (
          <section key={country.id} className="stack-sm">
            <h2>{country.name}</h2>
            <ul className="list rows card">
              {country.lotteries.map((l) => (
                <li key={l.id}>
                  <Link href={`/panel/loterias/${l.id}`} className={`row list-row lottery-row ${l.active ? "" : "voided"}`}>
                    <span className="lottery-logo">
                      {l.logoKey ? (
                        <Image src={publicUrl(l.logoKey)} alt="" width={72} height={48} />
                      ) : (
                        <span className="muted small">Sin logo</span>
                      )}
                    </span>
                    <span className="stack-xs grow">
                      <strong>{l.province?.name ?? "Nacional"}</strong>
                      <span className="small muted">{l.fullName ?? l.name}</span>
                    </span>
                    <span className="tags">
                      {l.quinielaDraws && <span className="tag ok">Quiniela {l.name}</span>}
                      {!l.active && <span className="tag">Inactiva</span>}
                    </span>
                    <span className="chevron" aria-hidden="true">
                      ›
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
    </main>
  );
}
