import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ROLE_LABEL, agencyRole, canViewStaff, requireAccess } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { publicUrl } from "@/lib/storage";
import { formatRanges, isAgencyOpen, todayIn } from "@/lib/schedule";
import { agencyCatalog } from "@/lib/catalog";
import { agencyBalances } from "@/lib/finance";
import { SHIFT_LABEL, agencySessions, openSessionOf } from "@/lib/cash";
import { agencyCustomers } from "@/lib/credit";
import { agencySettlements } from "@/lib/settlement";
import { money } from "@/components/products/price-parts";

export const metadata = { title: "Agencia · Laqui" };

const fmt = (d: Date) => d.toLocaleDateString("es-AR", { timeZone: "UTC", weekday: "short", day: "2-digit", month: "2-digit" });
const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

type Alert = { text: string; href: string };

// Estado de la agencia: how it is doing today, what is pending, and the last days of caja.
// Configuration (datos, medios, horario…) and the day-to-day loading have their own sections.
export default async function AgencyPage({ params }: { params: Promise<{ agencyId: string }> }) {
  const { agencyId } = await params;
  const access = await requireAccess();
  const role = agencyRole(access, agencyId);
  if (!role) notFound(); // do not reveal agencies the user cannot see

  const agency = await prisma.agency.findUnique({
    where: { id: agencyId },
    include: {
      province: { select: { code: true } },
      assets: { where: { kind: "LOGO_SYMBOL" }, select: { storageKey: true } },
    },
  });
  if (!agency) notFound();

  const staffView = canViewStaff(role); // owners and admins
  const today = todayIn(agency.timezone);
  const weekAgo = new Date(Date.parse(`${today}T00:00:00Z`) - 7 * 86_400_000).toISOString().slice(0, 10);
  const [now, catalog, open, sessions, credit, finances, settlements, activeStaff] = await Promise.all([
    isAgencyOpen(agencyId),
    agencyCatalog(agencyId),
    openSessionOf(agencyId),
    agencySessions(agencyId, weekAgo),
    agencyCustomers(agencyId),
    staffView ? agencyBalances(agencyId) : Promise.resolve(null),
    staffView ? agencySettlements(agencyId) : Promise.resolve(null),
    staffView
      ? prisma.agencyEmployee.findMany({ where: { agencyId, active: true, role: { not: "OWNER" } }, select: { firstName: true } })
      : Promise.resolve(null),
  ]);

  const isMember = access.memberships.some((m) => m.agency.id === agencyId);
  const roleLabel = !isMember && access.isPlatformAdmin ? "Admin de plataforma" : ROLE_LABEL[role];
  const logo = agency.assets[0];
  const pendingLicense = /^pend/i.test(agency.licenseNumber);
  const base = `/panel/agencias/${agencyId}`;
  const todaySessions = sessions.filter((s) => s.date.toISOString().slice(0, 10) === today);
  const openIso = open?.date.toISOString().slice(0, 10);

  // Things to resolve, most urgent first.
  const alerts: Alert[] = [];
  if (open && openIso! < today)
    alerts.push({ text: `La caja del ${fmt(open.date)} (${SHIFT_LABEL[open.shift]}) sigue abierta: falta cerrarla`, href: `${base}/caja/${open.id}` });
  if (settlements?.missing.length)
    alerts.push({
      text: `${settlements.missing.length} día(s) sin ticket de Lotería: ${settlements.missing.slice(0, 4).map(ddmm).join(", ")}${settlements.missing.length > 4 ? "…" : ""}`,
      href: `${base}/liquidaciones`,
    });
  const legajoFund = finances?.funds.find((f) => f.fund.settlesAgencyId)?.fund;
  if (legajoFund && !legajoFund.accountNumber)
    alerts.push({ text: "Falta el n.º de la cuenta del legajo (la de los débitos de Lotería)", href: `${base}/datos#cuenta-legajo` });
  if (!agency.cellphoneNumber) alerts.push({ text: "Falta el WhatsApp para jugadas", href: `${base}/datos` });
  if (pendingLicense) alerts.push({ text: "Falta el número de legajo", href: `${base}/datos` });
  if (!agency.titularFirstName && !agency.titularLastName) alerts.push({ text: "Falta el titular del legajo", href: `${base}/datos` });

  const forSale = catalog.games.length + catalog.products.length;

  return (
    <main className="screen">
      <header className="row agency">
        {logo ? (
          <Image src={publicUrl(logo.storageKey)} alt="" width={64} height={64} className="agency-logo lg" />
        ) : (
          <span
            className="agency-logo lg placeholder"
            style={{ background: agency.primaryColor ?? undefined }}
            aria-hidden="true"
          >
            {agency.name.charAt(0)}
          </span>
        )}
        <div className="stack-xs">
          <h1>{agency.name}</h1>
          <span className="muted small">
            {pendingLicense ? "Legajo pendiente" : `Legajo ${agency.province.code}-${agency.licenseNumber}`} ·{" "}
            <span className="badge badge-inline">{roleLabel}</span>
          </span>
        </div>
      </header>

      {alerts.length > 0 && (
        <section className="card stack-sm">
          <h2>Para resolver</h2>
          <ul className="list plain">
            {alerts.map((a) => (
              <li key={a.text}>
                <Link href={a.href} className="row exception-row link">
                  <span className="small warn">{a.text}</span>
                  <span className="small muted">›</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <h2>Hoy</h2>

      <Link href={`${base}/horario`} className={`card row link-card status ${now.open ? "is-open" : "is-closed"}`}>
        <div className="stack-xs">
          <strong>{now.open ? `Abierta, cierra ${now.closesAt}` : "Cerrada ahora"}</strong>
          <span className="small">
            Hoy: {formatRanges(now.ranges)}
            {now.reason ? ` · ${now.reason}` : ""}
            {now.holidayWithoutException ? " · feriado sin excepción" : ""}
          </span>
        </div>
        <span className="chevron" aria-hidden="true">›</span>
      </Link>

      <Link href={open ? `${base}/caja/${open.id}` : `${base}/caja`} className={`card row link-card status ${open ? "is-open" : ""}`}>
        <div className="stack-xs">
          <strong>
            {open
              ? `Caja abierta · ${SHIFT_LABEL[open.shift]}${openIso === today ? "" : ` del ${fmt(open.date)}`}`
              : todaySessions.length
                ? `Caja · ${todaySessions.length} turno(s) cerrado(s) hoy`
                : "Caja sin abrir hoy"}
          </strong>
          <span className="small muted">
            {open
              ? `Efectivo inicial ${money(open.openingCash.toString())} · cargá movimientos y cerrala`
              : "Abrir el turno y cargar la caja diaria"}
          </span>
        </div>
        <span className="chevron" aria-hidden="true">›</span>
      </Link>

      {finances && (
        <Link href={`${base}/finanzas`} className="card row link-card">
          <div className="stack-xs">
            <strong>Plata · {money(finances.total.toString())}</strong>
            <span className="small muted">
              {finances.funds
                .filter((f) => f.fund.active)
                .map((f) => `${f.fund.name} ${money(f.balance.toString())}`)
                .join(" · ")}
            </span>
          </div>
          <span className="chevron" aria-hidden="true">›</span>
        </Link>
      )}

      <Link href={`${base}/fiados`} className="card row link-card">
        <div className="stack-xs">
          <strong>Fiados · {money(credit.total.toString())}</strong>
          <span className="small muted">
            {credit.rows.filter((r) => r.balance.isPositive() && !r.balance.isZero()).length} cliente(s) deben ·{" "}
            {credit.rows.length} en total
          </span>
        </div>
        <span className="chevron" aria-hidden="true">›</span>
      </Link>

      {settlements && (
        <Link href={`${base}/liquidaciones`} className="card row link-card">
          <div className="stack-xs">
            <strong>Liquidaciones de Lotería</strong>
            <span className="small muted">
              {settlements.upcoming.length
                ? settlements.upcoming
                    .map((u) => `${u.direction === "DEBIT" ? "Débito" : "Crédito"} de ${money(u.amount.toString())} el ${ddmm(u.dueDate.toISOString())}`)
                    .join(" · ")
                : "Sin débitos ni créditos próximos"}
              {settlements.missing.length ? ` · ${settlements.missing.length} día(s) sin ticket` : " · tickets al día"}
            </span>
          </div>
          <span className="chevron" aria-hidden="true">›</span>
        </Link>
      )}

      <section className="card stack-sm">
        <div className="row">
          <h2>Cajas de la última semana</h2>
          <Link href={`${base}/caja`} className="link small">
            Ver todas
          </Link>
        </div>
        {sessions.length === 0 ? (
          <p className="muted small">No hubo cajas en los últimos 7 días.</p>
        ) : (
          <ul className="list plain">
            {sessions.map((s) => (
              <li key={s.id}>
                <Link href={`${base}/caja/${s.id}`} className="row exception-row link">
                  <span className="small">
                    {fmt(s.date)} · {SHIFT_LABEL[s.shift]}
                  </span>
                  <span className="small muted">
                    {s.status === "OPEN" ? "abierta" : `efectivo ${money((s.countedCash ?? 0).toString())}`} ›
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <h2>Configuración</h2>

      <Link href={`${base}/productos`} className="card row link-card">
        <div className="stack-xs">
          <strong>Productos · {forSale} a la venta hoy</strong>
          <span className="small muted">
            {[...catalog.games.map((g) => g.name), ...catalog.products.map((p) => p.name)].join(", ") || "Nada a la venta"}
          </span>
        </div>
        <span className="chevron" aria-hidden="true">›</span>
      </Link>

      {activeStaff && (
        <Link href={`${base}/personal`} className="card row link-card">
          <div className="stack-xs">
            <strong>
              Personal · {activeStaff.length} {activeStaff.length === 1 ? "activo" : "activos"}
            </strong>
            <span className="small muted">
              {activeStaff.map((e) => e.firstName).join(", ") || "Todavía no hay personal cargado"}
            </span>
          </div>
          <span className="chevron" aria-hidden="true">›</span>
        </Link>
      )}
    </main>
  );
}
