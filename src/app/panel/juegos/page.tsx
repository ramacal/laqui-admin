import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAccess } from "@/lib/access";
import { priceOn } from "@/lib/catalog";
import { prisma } from "@/lib/prisma";
import { todayIn } from "@/lib/schedule";
import { KIND_LABEL, money } from "@/components/products/price-parts";
import { GameThumb } from "@/components/products/game-thumb";

export const metadata = { title: "Juegos y precios · Laqui" };
const TZ = "America/Argentina/Buenos_Aires";
const GROUPS = [
  {
    mode: "MACHINE",
    title: "Juegos online",
    hint: "Se venden por la terminal; entran en la «Venta» de la caja.",
  },
  {
    mode: "PHYSICAL",
    title: "Juegos físicos",
    hint: "Billetes y raspaditas: se cuentan por cantidad en la caja.",
  },
] as const;
const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

// Platform admin: official games at a glance (price, where they are offered, provinces with their
// own price). Changes are made in each game's page.
export default async function GamesPage() {
  const access = await requireAccess();
  if (!access.isPlatformAdmin) notFound();
  const today = todayIn(TZ);

  const games = await prisma.gameDefinition.findMany({
    include: {
      prices: true,
      provinces: {
        where: { enabled: true },
        include: { prices: true, province: { select: { name: true } } },
      },
    },
    orderBy: [{ active: "desc" }, { name: "asc" }],
  });

  return (
    <main className="screen">
      <div className="row page-head">
        <div className="stack-xs">
          <h1>Juegos y precios</h1>
          <p className="muted small">
            Precio oficial de cada juego y dónde se ofrece. Una provincia puede
            tener su propio precio.
          </p>
        </div>
        <Link href="/panel/juegos/nuevo" className="btn btn-primary btn-sm">
          + Nuevo juego
        </Link>
      </div>

      {GROUPS.map((group) => {
        const list = games.filter((g) => g.saleMode === group.mode);
        return (
          <section key={group.mode} className="stack-sm">
            <div className="stack-xs">
              <h2>
                {group.title} <span className="count">{list.length}</span>
              </h2>
              <p className="muted small">{group.hint}</p>
            </div>
            {list.length === 0 ? (
              <p className="muted small">Todavía no hay.</p>
            ) : (
              <ul className="list game-list">
                {list.map((g) => {
                  const national = priceOn(g.prices, today);
                  const unit =
                    g.kind === "QUINIELA"
                      ? "mínimo por renglón"
                      : g.kind === "UNIT"
                        ? "por unidad"
                        : "por jugada";
                  const offered = [...g.provinces].sort(
                    (a, b) =>
                      Number(b.customPrice) - Number(a.customPrice) ||
                      a.province.name.localeCompare(b.province.name),
                  );
                  return (
                    <li
                      key={g.id}
                      className={`card game-card ${g.active ? "" : "is-paused"}`}
                    >
                      <div className="game-main">
                        <GameThumb name={g.name} imageKey={g.imageKey} />
                        <div className="stack-xs">
                          <div className="row-start">
                            <strong className="game-name">{g.name}</strong>
                            {!g.active && (
                              <span className="tag warn-tag">Pausado</span>
                            )}
                          </div>
                          <span className="muted small">
                            {KIND_LABEL[g.kind]}
                          </span>
                        </div>
                      </div>

                      <div className="game-price stack-xs">
                        <span className="label">Precio oficial</span>
                        {national.current ? (
                          <span className="price">
                            {money(national.current.amount)}
                          </span>
                        ) : (
                          <span className="warn">Sin precio</span>
                        )}
                        <span className="muted small">
                          {unit}
                          {national.next
                            ? ` · ${money(national.next.amount)} desde el ${ddmm(national.next.validFrom)}`
                            : ""}
                        </span>
                      </div>

                      <div className="game-where stack-xs">
                        <span className="label">Se ofrece en</span>
                        {offered.length === 0 ? (
                          <span className="warn small">Ninguna provincia</span>
                        ) : (
                          <div className="pills">
                            {offered.map((pg) => {
                              const own = pg.customPrice
                                ? priceOn(pg.prices, today).current
                                : null;
                              return (
                                <span
                                  key={pg.provinceId}
                                  className={`pill ${pg.customPrice ? "added" : ""}`}
                                  title={
                                    pg.customPrice
                                      ? "Precio propio de la provincia"
                                      : "Precio oficial"
                                  }
                                >
                                  {pg.province.name}
                                  {pg.customPrice
                                    ? ` · ${own ? money(own.amount) : "sin precio"}`
                                    : ""}
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      <div className="game-actions">
                        <Link
                          href={`/panel/juegos/${g.id}`}
                          className="btn btn-secondary btn-sm"
                        >
                          Editar
                        </Link>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}
      <p className="small muted">
        <span className="pill added">Provincia · $</span> tiene precio propio;
        el resto usa el precio oficial.
      </p>
    </main>
  );
}
