// Panel home. For people with agencies it is a control board: "how are my agencies today?"
// (open now, cash session, fiados, money) and what needs attention, one card per agency.
import Image from "next/image";
import Link from "next/link";
import { ROLE_LABEL, canViewStaff, requireAccess } from "@/lib/access";
import { SHIFT_LABEL } from "@/lib/cash";
import { type AgencyOverview, type CashState, agenciesOverview } from "@/lib/overview";
import { prisma } from "@/lib/prisma";
import { publicUrl } from "@/lib/storage";
import { money } from "@/components/products/price-parts";

export const metadata = { title: "Panel · Laqui" };

const TZ = "America/Argentina/Buenos_Aires";

type AgencyLite = {
  id: string;
  name: string;
  licenseNumber: string;
  city: string | null;
  primaryColor: string | null;
  province: { code: string };
  assets: { storageKey: string }[];
};

const agencySelect = {
  id: true,
  name: true,
  licenseNumber: true,
  city: true,
  primaryColor: true,
  province: { select: { code: true } },
  assets: { where: { kind: "LOGO_SYMBOL" as const }, select: { storageKey: true } },
};

const license = (a: AgencyLite) =>
  /^pend/i.test(a.licenseNumber) ? "Legajo pendiente" : `Legajo ${a.province.code}-${a.licenseNumber}`;

function Logo({ agency, size }: { agency: AgencyLite; size: number }) {
  const logo = agency.assets[0];
  return logo ? (
    <Image src={publicUrl(logo.storageKey)} alt="" width={size} height={size} className="agency-logo" />
  ) : (
    <span
      className="agency-logo placeholder"
      style={{ background: agency.primaryColor ?? undefined, width: size, height: size }}
      aria-hidden="true"
    >
      {agency.name.charAt(0)}
    </span>
  );
}

function NowLine({ status }: { status: AgencyOverview["status"] }) {
  if (status.open)
    return (
      <span className="pulse-line is-open">
        <span className="dot" aria-hidden="true" />
        Abierta · cierra {status.closesAt}
      </span>
    );
  const text = status.opensNextAt
    ? `Cerrada · abre ${status.opensNextAt}`
    : status.closed
      ? `Cerrada hoy${status.reason ? ` · ${status.reason}` : ""}`
      : `Cerrada · abrió hasta las ${status.ranges.at(-1)?.closesAt ?? ""}`;
  return (
    <span className="pulse-line">
      <span className="dot" aria-hidden="true" />
      {text}
    </span>
  );
}

function CashLine({ cash, href }: { cash: CashState; href: string }) {
  if (cash.kind === "open") {
    const [, m, d] = cash.date.split("-");
    return (
      <Link href={`${href}/${cash.sessionId}`} className={`status-chip ${cash.stale ? "error" : "ok"}`}>
        {cash.stale ? `Abierta desde el ${d}/${m}` : `${SHIFT_LABEL[cash.shift]} abierta`}
      </Link>
    );
  }
  if (cash.kind === "closed-today")
    return (
      <Link href={href} className="status-chip">
        {cash.count === 1 ? "1 caja cerrada hoy" : `${cash.count} cajas cerradas hoy`}
      </Link>
    );
  return (
    <Link href={href} className="status-chip">
      Sin abrir hoy
    </Link>
  );
}

function AgencyTile({
  agency,
  row,
  badge,
  index,
}: {
  agency: AgencyLite;
  row: AgencyOverview;
  badge?: string;
  index: number;
}) {
  const base = `/panel/agencias/${agency.id}`;
  return (
    <li className={`tile ${row.status.open ? "is-open" : ""}`} style={{ animationDelay: `${index * 50}ms` }}>
      <Link href={base} className="tile-head">
        <Logo agency={agency} size={44} />
        <div className="stack-xs grow">
          <strong className="tile-name">{agency.name}</strong>
          <span className="muted small">
            {license(agency)}
            {agency.city ? ` · ${agency.city}` : ""}
          </span>
        </div>
        {badge && <span className="badge neutral">{badge}</span>}
      </Link>

      <div className="tile-now">
        <NowLine status={row.status} />
      </div>

      <dl className="tile-facts">
        <div>
          <dt>Caja</dt>
          <dd>
            <CashLine cash={row.cash} href={`${base}/caja`} />
          </dd>
        </div>
        {row.money && (
          <>
            <div>
              <dt>Fiados a cobrar</dt>
              <dd>
                <Link href={`${base}/fiados`} className="num">
                  {money(row.money.fiados.toString())}
                </Link>
              </dd>
            </div>
            <div>
              <dt>Saldo</dt>
              <dd>
                <Link href={`${base}/finanzas`} className={`num ${row.money.balance.isNegative() ? "error" : ""}`}>
                  {money(row.money.balance.toString())}
                </Link>
              </dd>
            </div>
          </>
        )}
      </dl>

      <nav className="tile-actions" aria-label={`Atajos de ${agency.name}`}>
        <Link href={`${base}/caja`}>Caja</Link>
        <Link href={`${base}/fiados`}>Fiados</Link>
        {row.money && <Link href={`${base}/finanzas`}>Finanzas</Link>}
        <Link href={`${base}/horario`}>Horario</Link>
      </nav>
    </li>
  );
}

function Shortcut({ href, title, text }: { href: string; title: string; text: string }) {
  return (
    <Link href={href} className="card row link-card">
      <div className="stack-xs">
        <strong>{title}</strong>
        <span className="muted small">{text}</span>
      </div>
      <span className="chevron" aria-hidden="true">
        ›
      </span>
    </Link>
  );
}

export default async function PanelPage() {
  const access = await requireAccess();
  const { user, isPlatformAdmin, memberships } = access;
  const isOwner = memberships.some((m) => m.role === "OWNER");

  const mine = memberships.map((m) => m.agency as AgencyLite);
  const withMoney = new Set(memberships.filter((m) => canViewStaff(m.role)).map((m) => m.agency.id));
  const board = mine.length > 0 ? await agenciesOverview(mine, withMoney) : null;
  const rowOf = new Map(board?.rows.map((r) => [r.id, r]));

  const allAgencies = isPlatformAdmin
    ? await prisma.agency.findMany({ where: { active: true }, select: agencySelect, orderBy: { name: "asc" } })
    : [];
  const mineIds = new Set(mine.map((a) => a.id));
  const others = allAgencies.filter((a) => !mineIds.has(a.id));

  const now = new Date();
  const today = new Intl.DateTimeFormat("es-AR", { timeZone: TZ, weekday: "long", day: "numeric", month: "long" }).format(now);
  const time = new Intl.DateTimeFormat("es-AR", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false }).format(now);

  return (
    <main className="screen board">
      {board && (
        <header className="board-hero">
          <div className="stack-xs">
            <span className="board-kicker">
              {today} · {time}
            </span>
            <h1>{mine.length === 1 ? "Tu agencia hoy" : "Tus agencias hoy"}</h1>
            <span className="board-who">{user.name}</span>
          </div>
          <dl className="kpis">
            <div>
              <dt>Abiertas ahora</dt>
              <dd>
                <span className="num">{board.totals.openNow}</span>
                <span className="kpi-of"> de {mine.length}</span>
              </dd>
            </div>
            <div>
              <dt>Cajas abiertas</dt>
              <dd className="num">{board.totals.cashOpen}</dd>
            </div>
            {board.totals.showMoney && (
              <>
                <div>
                  <dt>Fiados a cobrar</dt>
                  <dd className="num">{money(board.totals.fiados.toString())}</dd>
                </div>
                <div>
                  <dt>Saldo total</dt>
                  <dd className="num">{money(board.totals.balance.toString())}</dd>
                </div>
              </>
            )}
          </dl>
        </header>
      )}

      {board && board.attention.length > 0 && (
        <section className="card attention stack-sm" aria-labelledby="attention-title">
          <div className="row">
            <h2 id="attention-title">Para revisar</h2>
            <span className="status-chip warn">{board.attention.length}</span>
          </div>
          <ul className="list plain attention-list">
            {board.attention.map((a, i) => (
              <li key={i}>
                <Link href={a.href} className={`attention-item is-${a.tone}`}>
                  <span className="dot" aria-hidden="true" />
                  <span className="grow">
                    <strong>{a.agencyName}</strong>
                    <span className="muted"> · {a.text}</span>
                  </span>
                  <span className="chevron" aria-hidden="true">
                    ›
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {board && (
        <section className="stack-sm" aria-labelledby="agencies-title">
          <h2 id="agencies-title">{mine.length === 1 ? "Agencia" : `Agencias (${mine.length})`}</h2>
          <ul className="list tiles">
            {memberships.map((m, i) => (
              <AgencyTile
                key={m.id}
                agency={m.agency as AgencyLite}
                row={rowOf.get(m.agency.id)!}
                badge={mine.length > 1 && m.role === "OWNER" ? undefined : ROLE_LABEL[m.role]}
                index={i}
              />
            ))}
          </ul>
        </section>
      )}

      {!board && (
        <div className="stack-xs">
          <h1>Hola, {user.name.split(" ")[0]}</h1>
          <p className="muted">Elegí una sección.</p>
        </div>
      )}

      {(isOwner || isPlatformAdmin) && (
        <section className="stack-sm">
          <h2>{isOwner ? "Configuración general" : "Plataforma"}</h2>
          <div className="card-grid">
            {isOwner && (
              <>
                <Shortcut
                  href="/panel/horarios"
                  title="Horario general"
                  text="El horario que heredan tus agencias, con excepciones y feriados"
                />
                <Shortcut
                  href="/panel/productos"
                  title="Productos y precios"
                  text="Oficiales y propios, con su precio y en qué agencias se ofrecen"
                />
              </>
            )}
            {isPlatformAdmin && (
              <>
                <Shortcut href="/panel/juegos" title="Juegos y precios" text="Juegos oficiales y sus precios por provincia" />
                <Shortcut href="/panel/quiniela" title="Sorteos de Quiniela" text="Programa mensual: sorteos y loterías por día" />
                <Shortcut href="/panel/tareas" title="Tareas programadas" text="Lo que corre solo: programa de Quiniela, feriados…" />
              </>
            )}
          </div>
        </section>
      )}

      {others.length > 0 && (
        <section className="stack-sm">
          <div className="row">
            <h2>Otras agencias</h2>
            <span className="badge">Admin de plataforma</span>
          </div>
          <ul className="list card-grid">
            {others.map((a) => (
              <li key={a.id}>
                <Link href={`/panel/agencias/${a.id}`} className="card row link-card">
                  <div className="row agency">
                    <Logo agency={a} size={40} />
                    <div className="stack-xs">
                      <strong>{a.name}</strong>
                      <span className="muted small">{license(a)}</span>
                    </div>
                  </div>
                  <span className="chevron" aria-hidden="true">
                    ›
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!board && !isPlatformAdmin && (
        <article className="card stack-sm">
          <h2>Todavía no tenés acceso</h2>
          <p className="muted">
            Pedile al dueño o administrador de tu agencia que te registre como empleado con este email:{" "}
            <strong>{user.email}</strong>. La próxima vez que ingreses vas a ver tu agencia acá.
          </p>
        </article>
      )}
    </main>
  );
}
