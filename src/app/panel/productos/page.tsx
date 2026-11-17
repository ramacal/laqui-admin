import Link from "next/link";
import { requireAccess } from "@/lib/access";
import { effectivePriceRows, priceOn } from "@/lib/catalog";
import { prisma } from "@/lib/prisma";
import { agenciesOwnedBy, todayIn } from "@/lib/schedule";
import { SimpleForm } from "@/components/schedule/simple-form";
import { money } from "@/components/products/price-parts";
import { createOwnerProduct, setAgencyGameVisible } from "./actions";

export const metadata = { title: "Productos · Laqui" };
const TZ = "America/Argentina/Buenos_Aires";

// Owner's products: official games (choose where they are shown) and own products
// (one list per owner, offered in chosen agencies). Specs: global-game-catalog, owner-products.
export default async function OwnerProductsPage() {
  const access = await requireAccess();
  const today = todayIn(TZ);
  const agencies = await agenciesOwnedBy(access.user.id);
  const products = await prisma.ownerProduct.findMany({
    where: { ownerUserId: access.user.id },
    include: { prices: true, agencies: { include: { agency: { select: { name: true } } } } },
    orderBy: [{ active: "desc" }, { sortOrder: "asc" }, { name: "asc" }],
  });

  // Official games enabled in the provinces of the owner's agencies, with visibility per agency.
  const agencyDetails = await prisma.agency.findMany({
    where: { id: { in: agencies.map((a) => a.id) } },
    select: { id: true, name: true, provinceId: true, games: { select: { gameId: true, visible: true } } },
    orderBy: { name: "asc" },
  });
  const provinceIds = [...new Set(agencyDetails.map((a) => a.provinceId))];
  const provinceGames = await prisma.provinceGameAvailability.findMany({
    where: { provinceId: { in: provinceIds }, enabled: true },
    include: { game: { select: { id: true, name: true, kind: true, active: true, prices: true } }, prices: true },
  });
  const officialGames = [...new Map(provinceGames.map((pg) => [pg.game.id, pg.game])).values()].sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  return (
    <main className="screen">
      <Link href="/panel" className="back">
        ← Panel
      </Link>
      <div className="stack-xs">
        <h1>Productos</h1>
      </div>

      {agencies.length === 0 ? (
        <p className="card muted">Los productos propios son para dueños de agencias. Tu usuario no es dueño de ninguna.</p>
      ) : (
        <>
          <section className="stack-sm">
            <div className="stack-xs">
              <h2>Productos oficiales</h2>
              <p className="muted small">
                Los juegos de Lotería. El precio lo fija la provincia; vos elegís en qué agencias se muestran.
              </p>
            </div>
            <ul className="list">
              {officialGames.map((game) => (
                <li key={game.id} className="card stack-sm">
                  <div className="row">
                    <strong>{game.name}</strong>
                    <span className="small muted">
                      {[...new Set(agencyDetails.map((a) => {
                        const pg = provinceGames.find((x) => x.gameId === game.id && x.provinceId === a.provinceId);
                        const current = pg ? priceOn(effectivePriceRows(pg, pg.game.prices), today).current : null;
                        return current ? money(current.amount) : "sin precio";
                      }))].join(" / ")}
                      {game.kind === "QUINIELA" ? " mínimo por renglón" : ""}
                    </span>
                  </div>
                  {!game.active && <p className="warn small">Pausado por la plataforma.</p>}
                  <div className="tags">
                    {agencyDetails.map((a) => {
                      const offeredInProvince = provinceGames.some((x) => x.gameId === game.id && x.provinceId === a.provinceId);
                      if (!offeredInProvince) return null;
                      const visible = !a.games.some((g) => g.gameId === game.id && !g.visible);
                      return (
                        <form key={a.id} action={setAgencyGameVisible.bind(null, a.id, game.id, !visible)}>
                          <button
                            type="submit"
                            className={`chip ${visible ? "on" : ""}`}
                            aria-pressed={visible}
                            aria-label={`${a.name}: ${visible ? "se muestra" : "oculto"}`}
                            title={visible ? "Se muestra: tocá para ocultar" : "Oculto: tocá para mostrar"}
                          >
                            {visible ? "✓ " : ""}
                            {a.name}
                          </button>
                        </form>
                      );
                    })}
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="stack-sm">
            <div className="stack-xs">
              <h2>Productos propios</h2>
              <p className="muted small">
                Rifas, billetes, raspaditas o lo que vendas además de los juegos oficiales. Cargalos una vez y elegí en
                qué agencias se ofrecen.
              </p>
            </div>
          {products.length > 0 && (
            <ul className="list">
              {products.map((p) => {
                const { current, next } = priceOn(p.prices, today);
                const ended = p.availableUntil && p.availableUntil.toISOString().slice(0, 10) < today;
                return (
                  <li key={p.id}>
                    <Link href={`/panel/productos/${p.id}`} className="card row link-card">
                      <div className="stack-xs">
                        <strong className={p.active ? "" : "muted"}>{p.name}</strong>
                        <span className="muted small">
                          {current ? money(current.amount) : "sin precio vigente"}
                          {next ? ` · ${money(next.amount)} desde ${next.validFrom}` : ""}
                          {" · "}
                          {p.agencies.length === agencies.length
                            ? "todas tus agencias"
                            : p.agencies.map((a) => a.agency.name).join(", ")}
                        </span>
                      </div>
                      <span className={`badge ${p.active && !ended ? "" : "neutral"}`}>
                        {!p.active ? "Pausado" : ended ? "Terminado" : "Activo"}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}

          <section className="card stack-sm">
            <h2>Nuevo producto</h2>
            <SimpleForm action={createOwnerProduct} submitLabel="Crear producto">
              <label className="field">
                <span className="small muted">Nombre</span>
                <input name="name" className="input" placeholder="Rifa de fin de año" required maxLength={120} />
              </label>
              <div className="grid-2">
                <label className="field">
                  <span className="small muted">Precio por unidad ($)</span>
                  <input name="amount" className="input" inputMode="decimal" placeholder="2000" required />
                </label>
                <label className="field">
                  <span className="small muted">Vale desde</span>
                  <input type="date" name="validFrom" className="input" defaultValue={today} required />
                </label>
              </div>
              <fieldset className="stack-xs">
                <legend className="small muted">Se ofrece en</legend>
                {agencies.map((a) => (
                  <label key={a.id} className="check">
                    <input type="checkbox" name="agencyId" value={a.id} defaultChecked aria-label={a.name} />
                    <span>{a.name}</span>
                  </label>
                ))}
              </fieldset>
              <details>
                <summary className="small">Más opciones: descripción y fechas de venta</summary>
                <div className="stack-sm spaced">
                  <label className="field">
                    <span className="small muted">Descripción (opcional)</span>
                    <textarea name="description" className="input textarea" rows={2} maxLength={500} />
                  </label>
                  <div className="grid-2">
                    <label className="field">
                      <span className="small muted">Se vende desde</span>
                      <input type="date" name="availableFrom" className="input" />
                    </label>
                    <label className="field">
                      <span className="small muted">Se vende hasta</span>
                      <input type="date" name="availableUntil" className="input" />
                    </label>
                  </div>
                </div>
              </details>
            </SimpleForm>
          </section>
          </section>
        </>
      )}
    </main>
  );
}
