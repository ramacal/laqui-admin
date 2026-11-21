import { CalendarClock, Pause, Play, Store } from "lucide-react";
import type { ReactNode } from "react";
import { currentGroupId, requireAccess } from "@/lib/access";
import { effectivePriceRows, priceOn } from "@/lib/catalog";
import { prisma } from "@/lib/prisma";
import { agenciesOfGroup, todayIn } from "@/lib/schedule";
import { SimpleForm } from "@/components/schedule/simple-form";
import { PriceForm, PriceHistory, PriceTimeline, money } from "@/components/products/price-parts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AddableList, EditableSection } from "@/components/ui/editable-section";
import { PageHeader } from "@/components/ui/page-header";
import { DataItem, DataList, Missing, PanelList } from "@/components/ui/settings-section";
import { SubmitSwitch } from "@/components/ui/switch";
import {
  addOwnerProductPrice,
  createOwnerProduct,
  deleteOwnerProductPrice,
  setAgencyGameVisible,
  setOwnerProductActive,
  setOwnerProductAgencies,
  updateOwnerProduct,
} from "./actions";

export const metadata = { title: "Productos y precios · Laqui" };
const TZ = "America/Argentina/Buenos_Aires";
const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");
const day = (d: Date) => d.toLocaleDateString("es-AR", { timeZone: "UTC" });

/** Full-width block of this page: title and explanation above, content below. */
function Block({ title, description, children }: { title: string; description: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 border-0 border-t border-solid border-border pt-7 first:border-t-0 first:pt-2">
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-bold">{title}</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  );
}

// The group's products (Configuración general): which official games each agency sells, and the
// group's own products (one list, offered in chosen agencies). Specs: global-game-catalog,
// owner-products, agency-groups.
export default async function OwnerProductsPage({ searchParams }: { searchParams: Promise<{ group?: string }> }) {
  const access = await requireAccess();
  const today = todayIn(TZ);
  const groupId = currentGroupId(access, (await searchParams).group);
  const agencies = groupId ? await agenciesOfGroup(groupId) : [];

  if (!groupId || agencies.length === 0) {
    return (
      <main className="screen">
        <PageHeader title="Productos y precios" subtitle="Los productos son para los dueños de un grupo de agencias." />
      </main>
    );
  }

  const products = await prisma.ownerProduct.findMany({
    where: { groupId },
    include: { prices: true, agencies: { select: { agencyId: true } } },
    orderBy: [{ active: "desc" }, { sortOrder: "asc" }, { name: "asc" }],
  });

  // Official games enabled in the provinces of the group's agencies, with each agency's choice.
  const agencyDetails = await prisma.agency.findMany({
    where: { id: { in: agencies.map((a) => a.id) } },
    select: { id: true, name: true, provinceId: true, games: { select: { gameId: true, visible: true } } },
    orderBy: { name: "asc" },
  });
  const provinceGames = await prisma.provinceGameAvailability.findMany({
    where: { provinceId: { in: [...new Set(agencyDetails.map((a) => a.provinceId))] }, enabled: true },
    include: { game: { select: { id: true, name: true, kind: true, active: true, saleMode: true, prices: true } }, prices: true },
  });
  const officialGames = [...new Map(provinceGames.map((pg) => [pg.game.id, pg.game])).values()].sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  const priceText = (game: (typeof officialGames)[number]) => {
    const prices = [
      ...new Set(
        agencyDetails.map((a) => {
          const pg = provinceGames.find((x) => x.gameId === game.id && x.provinceId === a.provinceId);
          const current = pg ? priceOn(effectivePriceRows(pg, pg.game.prices), today).current : null;
          return current ? money(current.amount) : null;
        }),
      ),
    ];
    if (prices.every((p) => p === null)) return <span className="text-warning">Sin precio vigente</span>;
    const text = prices.map((p) => p ?? "sin precio").join(" / ");
    return game.kind === "QUINIELA" ? `Desde ${text} por renglón` : game.kind === "UNIT" ? `${text} c/u` : text;
  };

  // One table per sale mode: games in rows, an on/off switch per agency in columns.
  const gameTable = (mode: "MACHINE" | "PHYSICAL") => (
    <div className="overflow-x-auto rounded-xl border border-solid border-border bg-card shadow-[0_1px_2px_rgba(19,20,43,0.05)]">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="text-xs text-muted-foreground">
            <th className="sticky left-0 bg-card px-4 py-3 text-left font-medium">Juego</th>
            {agencyDetails.map((a) => (
              <th key={a.id} className="px-3 py-3 text-center font-medium whitespace-nowrap">
                {a.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {officialGames
            .filter((g) => g.saleMode === mode)
            .map((game) => (
              <tr key={game.id} className="border-0 border-t border-solid border-border">
                <td className="sticky left-0 min-w-44 bg-card px-4 py-3">
                  <span className={`block font-semibold ${game.active ? "" : "text-muted-foreground"}`}>{game.name}</span>
                  <span className="text-muted-foreground">{game.active ? priceText(game) : "Pausado en la plataforma"}</span>
                </td>
                {agencyDetails.map((a) => {
                  const inProvince = provinceGames.some((x) => x.gameId === game.id && x.provinceId === a.provinceId);
                  const visible = !a.games.some((g) => g.gameId === game.id && !g.visible);
                  return (
                    <td key={a.id} className="px-3 py-3 text-center">
                      {inProvince ? (
                        <form action={setAgencyGameVisible.bind(null, a.id, game.id, !visible)} className="inline-flex">
                          <SubmitSwitch checked={visible} disabled={!game.active} label={`${game.name} en ${a.name}`} />
                        </form>
                      ) : (
                        <span className="text-subtle-foreground" title="Su provincia no lo habilita">
                          —
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );

  const agencyChecks = (checked: (id: string) => boolean) => (
    <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
      <legend className="mb-1 p-0 text-sm text-muted-foreground">Se ofrece en</legend>
      {agencies.map((a) => (
        <label key={a.id} className="check">
          <input type="checkbox" name="agencyId" value={a.id} defaultChecked={checked(a.id)} aria-label={a.name} />
          <span>{a.name}</span>
        </label>
      ))}
    </fieldset>
  );

  const productFields = (p?: (typeof products)[number]) => (
    <>
      <fieldset className="segmented">
        <legend className="small muted">Cómo se vende</legend>
        <label>
          <input type="radio" name="saleMode" value="PHYSICAL" defaultChecked={!p || p.saleMode === "PHYSICAL"} />
          <span>Físico (se cuenta en la caja)</span>
        </label>
        <label>
          <input type="radio" name="saleMode" value="MACHINE" defaultChecked={p?.saleMode === "MACHINE"} />
          <span>No se cuenta en la caja</span>
        </label>
      </fieldset>
      <label className="field">
        <span className="small muted">Descripción (opcional)</span>
        <textarea name="description" className="input textarea" rows={2} maxLength={500} defaultValue={p?.description ?? ""} />
      </label>
      <div className="grid-2">
        <label className="field">
          <span className="small muted">Se vende desde (opcional)</span>
          <input type="date" name="availableFrom" className="input" defaultValue={iso(p?.availableFrom ?? null)} />
        </label>
        <label className="field">
          <span className="small muted">Se vende hasta (opcional)</span>
          <input type="date" name="availableUntil" className="input" defaultValue={iso(p?.availableUntil ?? null)} />
        </label>
      </div>
    </>
  );

  const activeCount = products.filter((p) => p.active).length;

  return (
    <main className="screen">
      <PageHeader
        title="Productos y precios"
        subtitle={`Para ${agencies.length === 1 ? "tu agencia" : `tus ${agencies.length} agencias`}. Los precios de los juegos oficiales los fija la provincia.`}
      />

      <div className="flex flex-col gap-7">
        <Block title="Juegos online" description="Los que se juegan en la máquina de Lotería. Elegí en qué agencias se venden.">
          {gameTable("MACHINE")}
        </Block>

        <Block title="Juegos físicos" description="Billetes y raspaditas que se venden en mano.">
          {gameTable("PHYSICAL")}
        </Block>

        <Block
          title="Productos propios"
          description="Rifas, bonos o lo que vendas además de los juegos oficiales. Se cargan una vez para el grupo y se elige en qué agencias se ofrecen."
        >
          <AddableList
            count={`${activeCount} ${activeCount === 1 ? "activo" : "activos"}${products.length > activeCount ? ` · ${products.length - activeCount} pausados` : ""}`}
            addLabel="Agregar producto"
            formTitle="Nuevo producto"
            form={
              <SimpleForm footer action={createOwnerProduct} submitLabel="Agregar">
                <input type="hidden" name="groupId" value={groupId} />
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
                {agencyChecks(() => true)}
                {productFields()}
              </SimpleForm>
            }
          >
            {products.length === 0 ? (
              <p className="text-sm text-muted-foreground">Todavía no hay productos propios.</p>
            ) : (
              <PanelList>
                {products.map((p) => {
                  const { current } = priceOn(p.prices, today);
                  const ended = Boolean(p.availableUntil && iso(p.availableUntil) < today);
                  const offered = new Set(p.agencies.map((a) => a.agencyId));
                  const where =
                    offered.size === agencies.length
                      ? "Todas las agencias"
                      : agencies.filter((a) => offered.has(a.id)).map((a) => a.name).join(", ");
                  return (
                    <li key={p.id}>
                      <EditableSection
                        item
                        muted={!p.active || ended}
                        title={p.name}
                        subtitle={p.saleMode === "PHYSICAL" ? "Físico: se cuenta en la caja" : "No se cuenta en la caja"}
                        status={
                          !p.active ? <Badge>Pausado</Badge> : ended ? <Badge>Terminado</Badge> : <Badge tone="success">Activo</Badge>
                        }
                        view={
                          <DataList>
                            <DataItem label="Se ofrece en">{where || <Missing warn>Ninguna agencia</Missing>}</DataItem>
                            {(p.availableFrom || p.availableUntil) && (
                              <DataItem label="Se vende">
                                {p.availableFrom ? `desde ${day(p.availableFrom)}` : ""}
                                {p.availableFrom && p.availableUntil ? " " : ""}
                                {p.availableUntil ? `hasta ${day(p.availableUntil)}` : ""}
                              </DataItem>
                            )}
                            {p.description && (
                              <DataItem label="Descripción" wide>
                                {p.description}
                              </DataItem>
                            )}
                            <DataItem label="Precio por unidad (historial)" wide>
                              {!current && p.prices.length > 0 && (
                                <span className="mb-1 block">
                                  <Missing warn>Sin precio vigente hoy: no se ofrece</Missing>
                                </span>
                              )}
                              <PriceTimeline
                                rows={p.prices.map((r) => ({ id: r.id, amount: r.amount.toString(), validFrom: iso(r.validFrom), note: r.note }))}
                                today={today}
                              />
                            </DataItem>
                          </DataList>
                        }
                        actions={
                          <form key="pause" action={setOwnerProductActive.bind(null, p.id, !p.active)} className="flex">
                            <Button type="submit" variant="outline" size="sm" className="flex-1 lg:justify-start">
                              {p.active ? <Pause /> : <Play />} {p.active ? "Pausar" : "Activar"}
                            </Button>
                          </form>
                        }
                        forms={[
                          {
                            key: "precio",
                            label: "Cambiar precio",
                            icon: <CalendarClock key="icon" />,
                            form: (
                              <div key="form" className="flex flex-col gap-4">
                                <PriceHistory
                                  rows={p.prices.map((r) => ({ id: r.id, amount: r.amount.toString(), validFrom: iso(r.validFrom), note: r.note }))}
                                  today={today}
                                  deleteAction={deleteOwnerProductPrice}
                                />
                                <PriceForm footer action={addOwnerProductPrice.bind(null, p.id)} today={today} />
                                <p className="text-sm text-muted-foreground">
                                  Con una fecha futura, el cambio queda programado y el precio actual sigue hasta ese día.
                                </p>
                              </div>
                            ),
                          },
                          {
                            key: "agencias",
                            label: "Agencias",
                            icon: <Store key="icon" />,
                            form: (
                              <SimpleForm key="form" footer action={setOwnerProductAgencies.bind(null, p.id)} submitLabel="Guardar">
                                {agencyChecks((id) => offered.has(id))}
                              </SimpleForm>
                            ),
                          },
                        ]}
                      >
                        <SimpleForm footer action={updateOwnerProduct.bind(null, p.id)} submitLabel="Guardar">
                          <label className="field">
                            <span className="small muted">Nombre</span>
                            <input name="name" className="input" defaultValue={p.name} required maxLength={120} />
                          </label>
                          {productFields(p)}
                        </SimpleForm>
                      </EditableSection>
                    </li>
                  );
                })}
              </PanelList>
            )}
          </AddableList>
        </Block>
      </div>
    </main>
  );
}
