import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAccess } from "@/lib/access";
import { priceOn } from "@/lib/catalog";
import { prisma } from "@/lib/prisma";
import { todayIn } from "@/lib/schedule";
import { SimpleForm } from "@/components/schedule/simple-form";
import {
  KIND_LABEL,
  PriceForm,
  PriceHistory,
  money,
} from "@/components/products/price-parts";
import {
  addGamePrice,
  addGameProvince,
  addProvincePrice,
  deleteGamePrice,
  deleteProvincePrice,
  removeGameImage,
  resetProvincePrice,
  setGameActive,
  setGameImage,
  setProvinceGameEnabled,
} from "../../productos/actions";
import { GameThumb } from "@/components/products/game-thumb";

export const metadata = { title: "Editar juego · Laqui" };
const TZ = "America/Argentina/Buenos_Aires";
const ddmm = (iso: string) =>
  `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

type Row = {
  id: string;
  amount: { toString(): string };
  validFrom: Date;
  note: string | null;
};
const toRows = (rows: Row[]) =>
  rows.map((r) => ({
    id: r.id,
    amount: r.amount.toString(),
    validFrom: r.validFrom.toISOString().slice(0, 10),
    note: r.note,
  }));

// Platform admin: one official game: its official price and the provinces where it is offered.
export default async function GamePage({
  params,
}: {
  params: Promise<{ gameId: string }>;
}) {
  const { gameId } = await params;
  const access = await requireAccess();
  if (!access.isPlatformAdmin) notFound();
  const today = todayIn(TZ);

  const [game, provinces] = await Promise.all([
    prisma.gameDefinition.findUnique({
      where: { id: gameId },
      include: {
        modalities: { orderBy: { sortOrder: "asc" } },
        prices: true,
        provinces: {
          include: { prices: true, province: { select: { name: true } } },
        },
      },
    }),
    prisma.province.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);
  if (!game) notFound();

  const national = priceOn(game.prices, today);
  const unit =
    game.kind === "QUINIELA"
      ? "mínimo por renglón"
      : game.kind === "UNIT"
        ? "por unidad"
        : "por jugada";
  const offered = game.provinces
    .filter((p) => p.enabled)
    .sort((a, b) => a.province.name.localeCompare(b.province.name));
  const offeredIds = new Set(offered.map((p) => p.provinceId));
  const others = provinces.filter((p) => !offeredIds.has(p.id));
  const detail =
    game.kind === "NUMBER_PICK"
      ? `${game.pickCount} números del ${String(game.minNumber).padStart(2, "0")} al ${game.maxNumber}${game.extraMax != null ? ` + plus ${game.extraMin}–${game.extraMax}` : ""}`
      : game.kind === "QUINIELA"
        ? `hasta ${game.maxDigits} cifras`
        : null;

  return (
    <main className="screen">
      <Link href="/panel/juegos" className="back">
        ← Juegos y precios
      </Link>

      <div className="row page-head">
        <div className="row-start game-head">
          <GameThumb name={game.name} imageKey={game.imageKey} size={64} />
          <div className="stack-xs">
            <div className="row-start">
              <h1>{game.name}</h1>
              <span
                className={`tag ${game.saleMode === "PHYSICAL" ? "ok" : ""}`}
              >
                {game.saleMode === "PHYSICAL" ? "Físico" : "Online"}
              </span>
              {!game.active && <span className="tag warn-tag">Pausado</span>}
            </div>
            <span className="muted small">
              {KIND_LABEL[game.kind]}
              {detail ? ` · ${detail}` : ""}
              {game.modalities.length
                ? ` · ${game.modalities.map((m) => m.name).join(", ")}`
                : ""}
            </span>
          </div>
        </div>
        <form action={setGameActive.bind(null, game.id, !game.active)}>
          <button
            type="submit"
            className={`btn btn-sm ${game.active ? "btn-secondary" : "btn-primary"}`}
          >
            {game.active ? "Pausar en todo el país" : "Activar"}
          </button>
        </form>
      </div>

      <div className="two-col">
        <div className="stack">
          {/* ── Picture ── */}
          <section className="card stack-sm">
            <h2>Imagen</h2>
            <div className="row-start image-row">
              <GameThumb name={game.name} imageKey={game.imageKey} size={96} />
              <div className="stack-xs">
                <span className="small muted">
                  Se muestra en el panel y en la página de la agencia. Se achica
                  sola (máx. 512 px, WebP) para que cargue rápido.
                </span>
                {game.imageKey && (
                  <form action={removeGameImage.bind(null, game.id)}>
                    <button type="submit" className="link-btn">
                      Quitar imagen
                    </button>
                  </form>
                )}
              </div>
            </div>
            <SimpleForm
              action={setGameImage.bind(null, game.id)}
              submitLabel={game.imageKey ? "Cambiar imagen" : "Subir imagen"}
            >
              <input
                type="file"
                name="image"
                accept="image/jpeg,image/png,image/webp"
                className="input file"
                required
              />
            </SimpleForm>
          </section>

          {/* ── Official price ── */}
          <section className="card stack-sm">
            <h2>Precio oficial</h2>
            <div className="stack-xs">
              {national.current ? (
                <span className="price lg">
                  {money(national.current.amount)}
                </span>
              ) : (
                <span className="warn">Sin precio</span>
              )}
              <span className="muted small">
                {unit}
                {national.current
                  ? ` · vigente desde el ${ddmm(national.current.validFrom)}`
                  : ""}
              </span>
              {national.next && (
                <span className="small note">
                  Cambia a {money(national.next.amount)} el{" "}
                  {ddmm(national.next.validFrom)}
                </span>
              )}
            </div>
            <div className="divider" />
            <strong className="small">Cambiar precio</strong>
            <PriceForm
              action={addGamePrice.bind(null, game.id)}
              today={today}
              amountLabel={
                game.kind === "QUINIELA"
                  ? "Mínimo por renglón"
                  : game.kind === "UNIT"
                    ? "Precio por unidad"
                    : "Nuevo precio"
              }
            />
            <p className="small muted">
              Con fecha de hoy cambia ya; con una fecha futura queda programado.
            </p>
            <details>
              <summary className="small">Historial de precios</summary>
              <div className="spaced">
                <PriceHistory
                  rows={toRows(game.prices)}
                  today={today}
                  deleteAction={deleteGamePrice}
                />
              </div>
            </details>
          </section>
        </div>

        {/* ── Provinces ── */}
        <section className="card stack-sm">
          <h2>Provincias</h2>
          <p className="small muted">
            Usan el precio oficial, salvo las que tengan precio propio.
          </p>
          {offered.length === 0 ? (
            <p className="warn small">No se ofrece en ninguna provincia.</p>
          ) : (
            <ul className="list prov-list">
              {offered.map((pg) => {
                const own = pg.customPrice ? priceOn(pg.prices, today) : null;
                return (
                  <li key={pg.provinceId} className="prov-row">
                    <div className="row">
                      <div className="stack-xs">
                        <strong>{pg.province.name}</strong>
                        {own ? (
                          <span className="small">
                            <span className="pill added">Precio propio</span>{" "}
                            {own.current ? (
                              money(own.current.amount)
                            ) : (
                              <span className="warn">sin precio</span>
                            )}
                            {own.next ? (
                              <span className="muted">
                                {" "}
                                · {money(own.next.amount)} desde el{" "}
                                {ddmm(own.next.validFrom)}
                              </span>
                            ) : null}
                          </span>
                        ) : (
                          <span className="small muted">
                            Precio oficial
                            {national.current
                              ? ` · ${money(national.current.amount)}`
                              : ""}
                          </span>
                        )}
                      </div>
                      <div className="row-actions">
                        {own && (
                          <form
                            action={resetProvincePrice.bind(
                              null,
                              pg.provinceId,
                              game.id,
                            )}
                          >
                            <button
                              type="submit"
                              className="btn btn-secondary btn-sm"
                            >
                              Volver al oficial
                            </button>
                          </form>
                        )}
                        <form
                          action={setProvinceGameEnabled.bind(
                            null,
                            pg.provinceId,
                            game.id,
                            false,
                          )}
                        >
                          <button
                            type="submit"
                            className="btn btn-danger btn-sm"
                          >
                            Quitar
                          </button>
                        </form>
                      </div>
                    </div>
                    <details>
                      <summary className="small">
                        {own ? "Cambiar precio propio" : "Poner precio propio"}
                      </summary>
                      <div className="spaced stack-sm">
                        <PriceForm
                          action={addProvincePrice.bind(null, game.id)}
                          today={today}
                          amountLabel={`Precio en ${pg.province.name}`}
                        >
                          <input
                            type="hidden"
                            name="provinceId"
                            value={pg.provinceId}
                          />
                        </PriceForm>
                        {own && (
                          <PriceHistory
                            rows={toRows(pg.prices)}
                            today={today}
                            deleteAction={deleteProvincePrice}
                          />
                        )}
                      </div>
                    </details>
                  </li>
                );
              })}
            </ul>
          )}
          {others.length > 0 && (
            <>
              <div className="divider" />
              <strong className="small">Agregar provincia</strong>
              <SimpleForm
                action={addGameProvince.bind(null, game.id)}
                submitLabel="Agregar"
                className="inline-form"
              >
                <select
                  name="provinceId"
                  className="input"
                  required
                  defaultValue=""
                >
                  <option value="" disabled>
                    Elegí una provincia
                  </option>
                  {others.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </SimpleForm>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
