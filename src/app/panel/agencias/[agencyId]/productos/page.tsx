import { notFound } from "next/navigation";
import { agencyRole, canEditAgencyHours, requireAccess } from "@/lib/access";
import { agencyCatalog, priceOn } from "@/lib/catalog";
import { prisma } from "@/lib/prisma";
import { todayIn } from "@/lib/schedule";
import { money } from "@/components/products/price-parts";
import {
  setAgencyGameOnWeb,
  setAgencyGameVisible,
  setOwnerProductAtAgency,
  setOwnerProductOnWeb,
} from "@/app/panel/productos/actions";
import { PageHeader } from "@/components/ui/page-header";
import { Row, RowList } from "@/components/ui/row-list";
import { SettingsPage, SettingsSection } from "@/components/ui/settings-section";
import { SubmitSwitch } from "@/components/ui/switch";

export const metadata = { title: "Productos de la agencia · Laqui" };

const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

// What this agency sells, each item with two switches: at the agency (counter, cash register)
// and on the web (public betting flow, which is played at the agency, so it needs the first).
// Official games come from the province; own products are loaded by the group's owners.
export default async function AgencyProductsPage({ params }: { params: Promise<{ agencyId: string }> }) {
  const { agencyId } = await params;
  const access = await requireAccess();
  const role = agencyRole(access, agencyId);
  if (!role) notFound();

  const agency = await prisma.agency.findUnique({
    where: { id: agencyId },
    select: {
      name: true,
      timezone: true,
      groupId: true,
      provinceId: true,
      province: { select: { name: true } },
      games: { select: { gameId: true, visible: true, onWeb: true } },
    },
  });
  if (!agency) notFound();

  const canEdit = canEditAgencyHours(role);
  const today = todayIn(agency.timezone);
  const catalog = await agencyCatalog(agencyId);
  const provinceGames = await prisma.provinceGameAvailability.findMany({
    where: { provinceId: agency.provinceId, enabled: true },
    include: { game: { select: { id: true, name: true, active: true, saleMode: true } } },
    orderBy: { game: { name: "asc" } },
  });
  const ownProducts = agency.groupId
    ? await prisma.ownerProduct.findMany({
        where: { groupId: agency.groupId },
        include: { prices: true, agencies: { where: { agencyId } } },
        orderBy: [{ active: "desc" }, { sortOrder: "asc" }, { name: "asc" }],
      })
    : [];
  const choice = new Map(agency.games.map((g) => [g.gameId, g]));
  const offered = new Map(catalog.games.map((g) => [g.id, g]));
  const onSale = provinceGames.filter(({ game }) => offered.has(game.id)).length + catalog.products.length;

  const header = canEdit && (
    <li aria-hidden="true" className="flex justify-end gap-5 pt-1 pb-2 text-xs font-medium text-muted-foreground">
      <span className="w-11 text-center">Agencia</span>
      <span className="w-11 text-center">Web</span>
    </li>
  );
  const switches = (o: {
    name: string;
    atAgency: boolean;
    onWeb: boolean;
    locked: boolean; // paused by the platform or the group
    agencyAction: () => Promise<void>;
    webAction: () => Promise<void>;
  }) =>
    canEdit ? (
      <div className="flex gap-5">
        <form action={o.agencyAction} className="flex">
          <SubmitSwitch checked={o.atAgency} disabled={o.locked} label={`${o.name}: se vende en la agencia`} />
        </form>
        <form action={o.webAction} className="flex">
          <SubmitSwitch checked={o.onWeb} disabled={o.locked || !o.atAgency} label={`${o.name}: se vende en web`} />
        </form>
      </div>
    ) : (
      <span className="text-sm text-muted-foreground">
        {o.atAgency ? (o.onWeb ? "Agencia y web" : "Solo agencia") : "No se vende"}
      </span>
    );

  // One row per official game: price of today (or why it is not sold) and the two switches.
  const gameRows = (mode: "MACHINE" | "PHYSICAL") => (
    <RowList>
      {header}
      {provinceGames
        .filter(({ game }) => game.saleMode === mode)
        .map(({ game }) => {
          const atAgency = choice.get(game.id)?.visible ?? true;
          const onWeb = atAgency && (choice.get(game.id)?.onWeb ?? true);
          const sale = offered.get(game.id);
          const detail = !game.active ? (
            "Pausado en la plataforma"
          ) : !atAgency ? (
            "No se vende en esta agencia"
          ) : sale ? (
            <>
              {sale.kind === "QUINIELA"
                ? `Desde ${money(sale.price.amount)} por renglón`
                : `${money(sale.price.amount)}${sale.kind === "UNIT" ? " c/u" : ""}`}
              {sale.nextPrice && ` · ${money(sale.nextPrice.amount)} desde ${sale.nextPrice.validFrom}`}
            </>
          ) : (
            <span className="text-warning">Sin precio vigente: no aparece a la venta</span>
          );
          return (
            <Row
              key={game.id}
              muted={!atAgency || !game.active}
              title={game.name}
              detail={detail}
              trailing={switches({
                name: game.name,
                atAgency,
                onWeb,
                locked: !game.active,
                agencyAction: setAgencyGameVisible.bind(null, agencyId, game.id, !atAgency),
                webAction: setAgencyGameOnWeb.bind(null, agencyId, game.id, !onWeb),
              })}
            />
          );
        })}
    </RowList>
  );

  return (
    <main className="screen">
      <PageHeader
        back={{ href: `/panel/agencias/${agencyId}`, label: agency.name }}
        title="Productos"
        subtitle={onSale === 0 ? "Hoy no tiene nada a la venta." : `${onSale} a la venta hoy`}
      />

      <SettingsPage>
        <SettingsSection
          title="Juegos online"
          description={`Los que se juegan en la máquina de Lotería, habilitados por ${agency.province.name}. Elegí si se venden en la agencia y en la web.`}
        >
          {gameRows("MACHINE")}
        </SettingsSection>

        <SettingsSection
          title="Juegos físicos"
          description="Billetes y raspaditas que se venden en mano, cada uno con su renglón en la caja."
        >
          {gameRows("PHYSICAL")}
        </SettingsSection>

        <SettingsSection
          title="Productos propios"
          description="Rifas, bonos y lo que el grupo venda además de los juegos oficiales. Los cargan los dueños del grupo."
        >
          {ownProducts.length === 0 ? (
            <p className="text-sm text-muted-foreground">El grupo todavía no tiene productos propios.</p>
          ) : (
            <RowList>
              {header}
              {ownProducts.map((p) => {
                const link = p.agencies[0];
                const atAgency = Boolean(link);
                const onWeb = atAgency && link.onWeb;
                const { current, next } = priceOn(p.prices, today);
                const ended = Boolean(p.availableUntil && iso(p.availableUntil) < today);
                const notYet = Boolean(p.availableFrom && iso(p.availableFrom) > today);
                const detail = !p.active ? (
                  "Pausado por el grupo"
                ) : ended ? (
                  "Terminado"
                ) : !atAgency ? (
                  "No se vende en esta agencia"
                ) : !current ? (
                  <span className="text-warning">Sin precio vigente: no aparece a la venta</span>
                ) : (
                  <>
                    {money(current.amount)} c/u
                    {next && ` · ${money(next.amount)} desde ${next.validFrom}`}
                    {notYet && ` · se vende desde ${iso(p.availableFrom)}`}
                    {p.availableUntil && ` · hasta ${iso(p.availableUntil)}`}
                  </>
                );
                return (
                  <Row
                    key={p.id}
                    muted={!atAgency || !p.active || ended}
                    title={p.name}
                    detail={detail}
                    trailing={switches({
                      name: p.name,
                      atAgency,
                      onWeb,
                      locked: !p.active || ended,
                      agencyAction: setOwnerProductAtAgency.bind(null, p.id, agencyId, !atAgency),
                      webAction: setOwnerProductOnWeb.bind(null, p.id, agencyId, !onWeb),
                    })}
                  />
                );
              })}
            </RowList>
          )}
        </SettingsSection>
      </SettingsPage>
    </main>
  );
}
