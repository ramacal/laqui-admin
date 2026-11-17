import Link from "next/link";
import { notFound } from "next/navigation";
import { agencyRole, canEditAgencyHours, requireAccess } from "@/lib/access";
import { agencyCatalog } from "@/lib/catalog";
import { prisma } from "@/lib/prisma";
import { money } from "@/components/products/price-parts";
import { setAgencyGameVisible } from "@/app/panel/productos/actions";

export const metadata = { title: "Productos de la agencia · Laqui" };

export default async function AgencyProductsPage({ params }: { params: Promise<{ agencyId: string }> }) {
  const { agencyId } = await params;
  const access = await requireAccess();
  const role = agencyRole(access, agencyId);
  if (!role) notFound();

  const agency = await prisma.agency.findUnique({
    where: { id: agencyId },
    select: {
      name: true,
      provinceId: true,
      province: { select: { name: true } },
      games: { select: { gameId: true, visible: true } },
    },
  });
  if (!agency) notFound();

  const canEdit = canEditAgencyHours(role);
  const catalog = await agencyCatalog(agencyId);
  const provinceGames = await prisma.provinceGameAvailability.findMany({
    where: { provinceId: agency.provinceId, enabled: true },
    include: { game: { select: { id: true, name: true, active: true } } },
    orderBy: { game: { name: "asc" } },
  });
  const hidden = new Set(agency.games.filter((g) => !g.visible).map((g) => g.gameId));
  const offeredIds = new Set(catalog.games.map((g) => g.id));

  return (
    <main className="screen">
      <Link href={`/panel/agencias/${agencyId}`} className="back">
        ← {agency.name}
      </Link>
      <h1>Productos</h1>

      <section className="card stack-sm">
        <h2>Lo que vende hoy</h2>
        {catalog.games.length + catalog.products.length === 0 ? (
          <p className="muted small">Hoy no tiene nada a la venta.</p>
        ) : (
          <ul className="list plain">
            {catalog.games.map((g) => (
              <li key={g.id} className="row exception-row">
                <span className="small">
                  <strong>{g.name}</strong>
                </span>
                <span className="small">
                  {g.kind === "QUINIELA" ? `desde ${money(g.price.amount)} por renglón` : money(g.price.amount)}
                  {g.nextPrice ? <span className="muted"> · {money(g.nextPrice.amount)} desde {g.nextPrice.validFrom}</span> : null}
                </span>
              </li>
            ))}
            {catalog.products.map((p) => (
              <li key={p.id} className="row exception-row">
                <span className="small">
                  <strong>{p.name}</strong> <span className="tag">propio</span>
                </span>
                <span className="small">
                  {money(p.unitPrice.amount)} c/u
                  {p.availableUntil ? <span className="muted"> · hasta {p.availableUntil}</span> : null}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card stack-sm">
        <h2>Juegos oficiales</h2>
        <p className="muted small">Los que habilita {agency.province.name}. Elegí cuáles muestra esta agencia.</p>
        <ul className="list plain">
          {provinceGames.map(({ game }) => {
            const visible = !hidden.has(game.id);
            const status = !game.active
              ? "pausado en la plataforma"
              : !visible
                ? "oculto en esta agencia"
                : offeredIds.has(game.id)
                  ? "a la venta"
                  : "sin precio vigente";
            return (
              <li key={game.id} className="row exception-row">
                <div className="stack-xs">
                  <strong className="small">{game.name}</strong>
                  <span className="small muted">{status}</span>
                </div>
                {canEdit && (
                  <form action={setAgencyGameVisible.bind(null, agencyId, game.id, !visible)}>
                    <button type="submit" className="btn btn-secondary btn-sm">
                      {visible ? "Ocultar" : "Mostrar"}
                    </button>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <p className="muted small">
        Los productos propios se cargan en{" "}
        <Link href="/panel/productos" className="link">
          Productos
        </Link>
        , donde también elegís en qué agencias se ofrece cada uno.
      </p>
    </main>
  );
}
