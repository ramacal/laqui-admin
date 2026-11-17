import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAccess } from "@/lib/access";
import { priceOn } from "@/lib/catalog";
import { prisma } from "@/lib/prisma";
import { todayIn } from "@/lib/schedule";
import { PriceForm, PriceHistory, money } from "@/components/products/price-parts";
import { NewGameForm } from "@/components/products/new-game-form";
import {
  addGamePrice,
  addProvincePrice,
  createGame,
  deleteGamePrice,
  deleteProvincePrice,
  resetProvincePrice,
  setGameActive,
  setProvinceGameEnabled,
} from "../productos/actions";

export const metadata = { title: "Juegos y precios · Laqui" };
const TZ = "America/Argentina/Buenos_Aires";
const KIND_LABEL = {
  QUINIELA: "Monto libre por renglón",
  NUMBER_PICK: "Números a precio fijo",
  UNIT: "Venta por unidad",
} as const;
const SALE_MODE_LABEL = { MACHINE: "Máquina", PHYSICAL: "Físico · se cuenta en la caja" } as const;

type Row = { id: string; amount: { toString(): string }; validFrom: Date; note: string | null };
const toRows = (rows: Row[]) =>
  rows.map((r) => ({ id: r.id, amount: r.amount.toString(), validFrom: r.validFrom.toISOString().slice(0, 10), note: r.note }));

// Platform admin: official games with a national price (validity) that provinces may override.
export default async function GamesPage() {
  const access = await requireAccess();
  if (!access.isPlatformAdmin) notFound();
  const today = todayIn(TZ);

  const provinces = await prisma.province.findMany({
    select: { id: true, code: true, name: true, _count: { select: { agencies: true } } },
    orderBy: { name: "asc" },
  });
  provinces.sort((a, b) => Number(b._count.agencies > 0) - Number(a._count.agencies > 0));

  const games = await prisma.gameDefinition.findMany({
    include: {
      modalities: { orderBy: { sortOrder: "asc" } },
      prices: true,
      provinces: { include: { prices: true, province: { select: { name: true } } } },
    },
    orderBy: { name: "asc" },
  });

  return (
    <main className="screen">
      <Link href="/panel" className="back">
        ← Panel
      </Link>
      <div className="stack-xs">
        <h1>Juegos y precios</h1>
        <p className="muted small">
          Cada juego tiene un precio oficial con fecha de vigencia. Una provincia puede tener precio propio: desde ahí
          los cambios del precio oficial no la afectan, hasta que vuelva a usarlo.
        </p>
      </div>

      <ul className="list">
        {games.map((g) => {
          const national = priceOn(g.prices, today);
          const byProvince = new Map(g.provinces.map((p) => [p.provinceId, p]));
          const custom = g.provinces.filter((p) => p.enabled && p.customPrice);
          const unit = g.kind === "QUINIELA" ? " mínimo por renglón" : g.kind === "UNIT" ? " c/u" : "";
          const enabledWithoutOwn = provinces.filter((p) => byProvince.get(p.id)?.enabled && !byProvince.get(p.id)?.customPrice);
          return (
            <li key={g.id} className="card stack-sm">
              <div className="row">
                <div className="stack-xs">
                  <strong>
                    {g.name} <span className={`tag ${g.saleMode === "PHYSICAL" ? "ok" : ""}`}>{SALE_MODE_LABEL[g.saleMode]}</span>
                  </strong>
                  <span className="muted small">
                    {KIND_LABEL[g.kind]}
                    {g.kind === "NUMBER_PICK"
                      ? ` · ${g.pickCount} números del ${String(g.minNumber).padStart(2, "0")} al ${g.maxNumber}${g.extraMax != null ? ` + plus ${g.extraMin}–${g.extraMax}` : ""}`
                      : g.kind === "QUINIELA"
                        ? ` · hasta ${g.maxDigits} cifras`
                        : ""}
                  </span>
                  {g.modalities.length > 0 && <span className="muted small">{g.modalities.map((m) => m.name).join(" · ")}</span>}
                </div>
                <form action={setGameActive.bind(null, g.id, !g.active)}>
                  <button type="submit" className={`btn btn-sm ${g.active ? "btn-secondary" : "btn-primary"}`}>
                    {g.active ? "Pausar en todo el país" : "Activar"}
                  </button>
                </form>
              </div>
              {!g.active && <p className="warn small">Pausado: no se ofrece en ninguna agencia.</p>}

              <div className="stack-xs">
                <h3 className="small">Precio oficial</h3>
                <span className="small">
                  {national.current ? <strong>{money(national.current.amount)}</strong> : <span className="warn">sin precio</span>}
                  {unit}
                  {national.next ? (
                    <span className="muted">
                      {" "}
                      · {money(national.next.amount)} desde {national.next.validFrom}
                    </span>
                  ) : null}
                </span>
                <details>
                  <summary className="small">Historial y cambios de precio</summary>
                  <div className="stack-sm spaced">
                    <PriceHistory rows={toRows(g.prices)} today={today} deleteAction={deleteGamePrice} />
                    <PriceForm
                      action={addGamePrice.bind(null, g.id)}
                      today={today}
                      amountLabel={g.kind === "QUINIELA" ? "Mínimo por renglón" : g.kind === "UNIT" ? "Precio por unidad" : "Precio oficial"}
                    />
                  </div>
                </details>
              </div>

              <div className="stack-xs">
                <h3 className="small">Se ofrece en</h3>
                <div className="tags">
                  {provinces.map((p) => {
                    const on = Boolean(byProvince.get(p.id)?.enabled);
                    return (
                      <form key={p.id} action={setProvinceGameEnabled.bind(null, p.id, g.id, !on)}>
                        <button
                          type="submit"
                          className={`chip ${on ? "on" : ""}`}
                          aria-pressed={on}
                          aria-label={`${p.name}: ${on ? "se ofrece" : "no se ofrece"}`}
                        >
                          {on ? "✓ " : ""}
                          {p.name}
                        </button>
                      </form>
                    );
                  })}
                </div>
              </div>

              <div className="stack-xs">
                <h3 className="small">Provincias con precio propio</h3>
                {custom.length === 0 ? (
                  <p className="muted small">Ninguna: todas usan el precio oficial.</p>
                ) : (
                  <ul className="list plain">
                    {custom.map((pg) => {
                      const own = priceOn(pg.prices, today);
                      return (
                        <li key={pg.provinceId} className="stack-xs exception-row">
                          <div className="row">
                            <span className="small">
                              <strong>{pg.province.name}</strong>:{" "}
                              {own.current ? money(own.current.amount) : <span className="warn">sin precio vigente</span>}
                              {own.next ? <span className="muted"> · {money(own.next.amount)} desde {own.next.validFrom}</span> : null}
                            </span>
                            <form action={resetProvincePrice.bind(null, pg.provinceId, g.id)}>
                              <button type="submit" className="btn btn-secondary btn-sm">
                                Volver al oficial
                              </button>
                            </form>
                          </div>
                          <details>
                            <summary className="small">Historial y cambios en {pg.province.name}</summary>
                            <div className="stack-sm spaced">
                              <PriceHistory rows={toRows(pg.prices)} today={today} deleteAction={deleteProvincePrice} />
                              <PriceForm action={addProvincePrice.bind(null, g.id)} today={today}>
                                <input type="hidden" name="provinceId" value={pg.provinceId} />
                              </PriceForm>
                            </div>
                          </details>
                        </li>
                      );
                    })}
                  </ul>
                )}
                {enabledWithoutOwn.length > 0 && (
                  <details>
                    <summary className="small">Poner precio propio a una provincia</summary>
                    <div className="spaced">
                      <PriceForm action={addProvincePrice.bind(null, g.id)} today={today}>
                        <label className="field">
                          <span className="small muted">Provincia</span>
                          <select name="provinceId" className="input" required defaultValue="">
                            <option value="" disabled>
                              Elegí una provincia
                            </option>
                            {enabledWithoutOwn.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name}
                              </option>
                            ))}
                          </select>
                        </label>
                      </PriceForm>
                    </div>
                  </details>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <section className="card stack-sm" id="nuevo">
        <h2>Nuevo producto oficial</h2>
        <p className="muted small">
          De máquina (Brinco, Poceada…) o físico (Telekino, raspaditas). Queda activo y a la venta en las provincias que
          marques.
        </p>
        <NewGameForm
          action={createGame}
          today={today}
          provinces={provinces.map((p) => ({ id: p.id, name: p.name, agencies: p._count.agencies }))}
        />
      </section>
    </main>
  );
}
