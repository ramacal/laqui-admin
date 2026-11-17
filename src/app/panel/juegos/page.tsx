import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAccess } from "@/lib/access";
import { priceOn } from "@/lib/catalog";
import { prisma } from "@/lib/prisma";
import { todayIn } from "@/lib/schedule";
import { PriceForm, PriceHistory, money } from "@/components/products/price-parts";
import { addProvincePrice, deleteProvincePrice, setGameActive, setProvinceGameEnabled } from "../productos/actions";

export const metadata = { title: "Juegos y precios · Laqui" };
const TZ = "America/Argentina/Buenos_Aires";
const KIND_LABEL = { QUINIELA: "Monto libre por renglón", NUMBER_PICK: "Números a precio fijo" } as const;

// Platform admin: base products (official games) and their prices per province.
export default async function GamesPage({ searchParams }: { searchParams: Promise<{ prov?: string }> }) {
  const access = await requireAccess();
  if (!access.isPlatformAdmin) notFound();
  const { prov } = await searchParams;
  const today = todayIn(TZ);

  // Provinces with agencies first (the ones that matter today), then the rest.
  const provinces = await prisma.province.findMany({
    select: { id: true, code: true, name: true, _count: { select: { agencies: true } } },
    orderBy: { name: "asc" },
  });
  provinces.sort((a, b) => Number(b._count.agencies > 0) - Number(a._count.agencies > 0));
  const province = provinces.find((p) => p.code === prov) ?? provinces[0];

  const games = await prisma.gameDefinition.findMany({
    include: {
      modalities: { orderBy: { sortOrder: "asc" } },
      provinces: { where: { provinceId: province.id }, include: { prices: true } },
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
          Productos base (juegos oficiales). Las reglas son iguales en todo el país; los precios se fijan por provincia y
          con fecha de vigencia.
        </p>
      </div>

      <nav className="tags" aria-label="Provincia">
        {provinces.map((p) => (
          <Link
            key={p.id}
            href={`?prov=${p.code}`}
            className={`tag ${p.id === province.id ? "ok" : ""}`}
            aria-current={p.id === province.id ? "page" : undefined}
          >
            {p.name}
            {p._count.agencies ? ` (${p._count.agencies})` : ""}
          </Link>
        ))}
      </nav>

      <ul className="list">
        {games.map((g) => {
          const availability = g.provinces[0];
          const enabled = Boolean(availability?.enabled);
          const rows = (availability?.prices ?? []).map((p) => ({
            id: p.id,
            amount: p.amount.toString(),
            validFrom: p.validFrom.toISOString().slice(0, 10),
            note: p.note,
          }));
          const { current } = priceOn(availability?.prices ?? [], today);
          return (
            <li key={g.id} className="card stack-sm">
              <div className="row">
                <div className="stack-xs">
                  <strong>{g.name}</strong>
                  <span className="muted small">
                    {KIND_LABEL[g.kind]}
                    {g.kind === "NUMBER_PICK"
                      ? ` · ${g.pickCount} números del ${String(g.minNumber).padStart(2, "0")} al ${g.maxNumber}${g.extraMax != null ? ` + plus ${g.extraMin}–${g.extraMax}` : ""}`
                      : ` · hasta ${g.maxDigits} cifras`}
                  </span>
                  {g.modalities.length > 0 && (
                    <span className="muted small">{g.modalities.map((m) => m.name).join(" · ")}</span>
                  )}
                </div>
                <form action={setGameActive.bind(null, g.id, !g.active)}>
                  <button type="submit" className={`btn btn-sm ${g.active ? "btn-secondary" : "btn-primary"}`}>
                    {g.active ? "Pausar en todo el país" : "Activar"}
                  </button>
                </form>
              </div>
              {!g.active && <p className="warn small">Pausado: no se ofrece en ninguna agencia.</p>}

              <div className="row">
                <span className="small">
                  En {province.name}:{" "}
                  <strong>{enabled ? (current ? `${money(current.amount)} vigente` : "sin precio vigente") : "no se ofrece"}</strong>
                  {g.kind === "QUINIELA" && enabled && current ? " (mínimo por renglón)" : ""}
                </span>
                <form action={setProvinceGameEnabled.bind(null, province.id, g.id, !enabled)}>
                  <button type="submit" className="btn btn-secondary btn-sm">
                    {enabled ? "Quitar de la provincia" : "Ofrecer en la provincia"}
                  </button>
                </form>
              </div>

              {enabled && (
                <details>
                  <summary>Precios en {province.name}</summary>
                  <div className="stack-sm spaced">
                    <PriceHistory rows={rows} today={today} deleteAction={deleteProvincePrice} />
                    <PriceForm
                      action={addProvincePrice.bind(null, province.id, g.id)}
                      today={today}
                      amountLabel={g.kind === "QUINIELA" ? "Mínimo por renglón" : "Precio"}
                    />
                  </div>
                </details>
              )}
            </li>
          );
        })}
      </ul>
    </main>
  );
}
