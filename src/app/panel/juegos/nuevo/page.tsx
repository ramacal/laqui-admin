import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAccess } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { todayIn } from "@/lib/schedule";
import { NewGameForm } from "@/components/products/new-game-form";
import { createGame } from "../../productos/actions";

export const metadata = { title: "Nuevo juego · Laqui" };
const TZ = "America/Argentina/Buenos_Aires";

// Platform admin: a new official game. On save it opens the game's page.
export default async function NewGamePage() {
  const access = await requireAccess();
  if (!access.isPlatformAdmin) notFound();
  const provinces = await prisma.province.findMany({
    select: { id: true, name: true, _count: { select: { agencies: true } } },
    orderBy: { name: "asc" },
  });
  // Provinces with agencies first.
  provinces.sort(
    (a, b) => Number(b._count.agencies > 0) - Number(a._count.agencies > 0),
  );

  return (
    <main className="screen">
      <Link href="/panel/juegos" className="back">
        ← Juegos y precios
      </Link>
      <div className="stack-xs">
        <h1>Nuevo juego oficial</h1>
        <p className="muted small">
          Online (Brinco, Poceada…) o físico (Telekino, raspaditas). Queda
          activo y a la venta en las provincias que marques.
        </p>
      </div>
      <section className="card form-card">
        <NewGameForm
          action={createGame}
          today={todayIn(TZ)}
          provinces={provinces.map((p) => ({
            id: p.id,
            name: p.name,
            agencies: p._count.agencies,
          }))}
        />
      </section>
    </main>
  );
}
