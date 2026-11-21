import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowRight, Wallet } from "lucide-react";
import { ROLE_LABEL, agencyRole, canViewStaff, requireAccess } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { publicUrl } from "@/lib/storage";
import { formatRanges, isAgencyOpen, todayIn } from "@/lib/schedule";
import { agencyCatalog } from "@/lib/catalog";
import { agencyBalances } from "@/lib/finance";
import { SHIFT_LABEL, agencySessions, openSessionOf } from "@/lib/cash";
import { agencyCustomers } from "@/lib/credit";
import { agencySettlements } from "@/lib/settlement";
import { cn } from "@/lib/utils";
import { money } from "@/components/products/price-parts";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { DashCard } from "@/components/ui/dash-card";
import { Row, RowList } from "@/components/ui/row-list";

export const metadata = { title: "Agencia · Laqui" };

const fmt = (d: Date) => d.toLocaleDateString("es-AR", { timeZone: "UTC", weekday: "short", day: "2-digit", month: "2-digit" });
const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

type Alert = { text: string; href: string };
type Kpi = { label: string; value: string; detail: string; href: string; tone?: "ok" | "warn" };

// Estado de la agencia, as a dashboard: who and when, the numbers of the day (each one a door
// to its section), what needs attention, and short summaries of caja, Lotería, money and today.
// Configuration has its own sections in the menu.
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
  const staleCash = Boolean(open && openIso! < today);

  // Things to resolve, most urgent first.
  const alerts: Alert[] = [];
  if (open && staleCash)
    alerts.push({ text: `La caja del ${fmt(open.date)} (${SHIFT_LABEL[open.shift]}) sigue abierta: falta cerrarla`, href: `${base}/caja/${open.id}` });
  if (settlements?.missing.length)
    alerts.push({
      text: `${settlements.missing.length} día(s) sin ticket de Lotería: ${settlements.missing.slice(0, 4).map(ddmm).join(", ")}${settlements.missing.length > 4 ? "…" : ""}`,
      href: `${base}/liquidaciones`,
    });
  if (!agency.cellphoneNumber) alerts.push({ text: "Falta el WhatsApp para jugadas", href: `${base}/datos` });
  if (pendingLicense) alerts.push({ text: "Falta el número de legajo", href: `${base}/datos` });
  if (!agency.titularFirstName && !agency.titularLastName) alerts.push({ text: "Falta el titular del legajo", href: `${base}/datos` });

  const forSale = catalog.games.length + catalog.products.length;
  const owing = credit.rows.filter((r) => r.balance.isPositive() && !r.balance.isZero()).length;
  const dateLine = new Date().toLocaleDateString("es-AR", { timeZone: agency.timezone, weekday: "long", day: "numeric", month: "long" });

  // The numbers of the day, each one a door to its section.
  const kpis: Kpi[] = [
    {
      label: "Ahora",
      value: now.open ? "Abierta" : "Cerrada",
      detail: now.open ? `cierra ${now.closesAt}` : now.opensNextAt ? `abre ${now.opensNextAt}` : (now.reason ?? "hoy no abre"),
      href: `${base}/horario`,
      tone: now.open ? "ok" : undefined,
    },
    {
      label: "Caja",
      value: open ? (staleCash ? "Sin cerrar" : "Abierta") : todaySessions.length ? "Cerrada" : "Sin abrir",
      detail: open
        ? staleCash
          ? `desde el ${fmt(open.date)}`
          : `${SHIFT_LABEL[open.shift]} · inicial ${money(open.openingCash.toString())}`
        : todaySessions.length
          ? `${todaySessions.length} ${todaySessions.length === 1 ? "turno cerrado" : "turnos cerrados"} hoy`
          : "todavía no se abrió hoy",
      href: open ? `${base}/caja/${open.id}` : `${base}/caja`,
      tone: staleCash ? "warn" : open ? "ok" : undefined,
    },
    {
      label: "Fiados a cobrar",
      value: money(credit.total.toString()),
      detail: owing ? `${owing} ${owing === 1 ? "cliente debe" : "clientes deben"}` : "nadie debe",
      href: `${base}/fiados`,
    },
  ];
  if (finances)
    kpis.push({
      label: "Saldo total",
      value: money(finances.total.toString()),
      detail: `${finances.funds.filter((f) => f.fund.active).length} medios de cobro`,
      href: `${base}/finanzas`,
      tone: finances.total.isNegative() ? "warn" : undefined,
    });

  return (
    <main className="screen">
      {/* Hero: who, today, and the numbers of the day (same family as the group's home board). */}
      <section className="flex flex-col gap-5 overflow-hidden rounded-2xl bg-primary p-5 text-primary-foreground shadow-[0_8px_28px_rgba(0,0,150,0.18)] sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            {logo ? (
              <Image
                src={publicUrl(logo.storageKey)}
                alt=""
                width={56}
                height={56}
                className="size-14 shrink-0 rounded-full bg-white object-cover ring-2 ring-white/40"
              />
            ) : (
              <span
                className="inline-flex size-14 shrink-0 items-center justify-center rounded-full bg-white/20 text-xl font-bold ring-2 ring-white/40"
                style={{ background: agency.primaryColor ?? undefined }}
                aria-hidden="true"
              >
                {agency.name.charAt(0)}
              </span>
            )}
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="text-xs font-bold tracking-widest uppercase opacity-75">
                {dateLine} · {now.localTime}
              </span>
              <h1 className="m-0 truncate text-[1.7rem] font-bold tracking-tight">{agency.name}</h1>
              <span className="text-sm opacity-80">
                {pendingLicense ? "Legajo pendiente" : `Legajo ${agency.province.code}-${agency.licenseNumber}`} · {roleLabel}
              </span>
            </div>
          </div>
          <Link
            href={open ? `${base}/caja/${open.id}` : `${base}/caja`}
            className={cn(buttonVariants(), "bg-white text-primary hover:bg-white/90")}
          >
            <Wallet /> {open ? (staleCash ? "Cerrar la caja" : "Ir a la caja") : "Abrir caja"}
          </Link>
        </div>

        <dl className="m-0 grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-white/15 lg:grid-cols-4">
          {kpis.map((k) => (
            <div key={k.label} className="bg-[#00006e]">
              <Link href={k.href} className="flex h-full flex-col gap-0.5 p-3.5 transition-colors hover:bg-white/10">
                <dt className="flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase opacity-75">
                  {k.tone && (
                    <span
                      aria-hidden="true"
                      className={cn("inline-block size-2 rounded-full", k.tone === "ok" ? "bg-[#4ade80]" : "bg-[#fbbf24]")}
                    />
                  )}
                  {k.label}
                </dt>
                <dd className="m-0 text-2xl leading-tight font-bold">{k.value}</dd>
                <span className="text-sm opacity-75">{k.detail}</span>
              </Link>
            </div>
          ))}
        </dl>
      </section>

      {alerts.length > 0 && (
        <section className="flex flex-col gap-1 rounded-xl border border-l-4 border-solid border-border border-l-[#d99a1e] bg-card p-4 sm:p-5">
          <h2 className="m-0 mb-1 flex items-center gap-2 text-base font-bold">
            <AlertTriangle className="size-4 text-warning" aria-hidden="true" /> Para revisar
            <Badge tone="warning">{alerts.length}</Badge>
          </h2>
          <ul className="m-0 flex list-none flex-col p-0">
            {alerts.map((a) => (
              <li key={a.text}>
                <Link href={a.href} className="-mx-2 flex items-center justify-between gap-3 rounded-lg px-2 py-2.5 text-sm hover:bg-muted">
                  <span className="flex items-center gap-2.5">
                    <span aria-hidden="true" className="inline-block size-2 shrink-0 rounded-full bg-[#d99a1e]" />
                    {a.text}
                  </span>
                  <ArrowRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <DashCard title="Cajas de la semana" link={{ href: `${base}/caja`, label: "Ver todas" }}>
          {sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hubo cajas en los últimos 7 días.</p>
          ) : (
            <RowList>
              {sessions.map((s) => (
                <Row
                  key={s.id}
                  title={
                    <Link href={`${base}/caja/${s.id}`} className="hover:underline">
                      {fmt(s.date)} · {SHIFT_LABEL[s.shift]}
                    </Link>
                  }
                  trailing={
                    s.status === "OPEN" ? (
                      <Badge tone={s.date.toISOString().slice(0, 10) < today ? "warning" : "success"}>Abierta</Badge>
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        contado <strong className="text-foreground">{money((s.countedCash ?? 0).toString())}</strong>
                      </span>
                    )
                  }
                />
              ))}
            </RowList>
          )}
        </DashCard>

        {settlements && (
          <DashCard title="Liquidaciones de Lotería" link={{ href: `${base}/liquidaciones`, label: "Ver tickets" }}>
            <RowList>
              {settlements.upcoming.map((u) => (
                <Row
                  key={u.id}
                  title={u.direction === "DEBIT" ? "Débito" : "Crédito"}
                  detail={`vence el ${ddmm(u.dueDate.toISOString())}`}
                  trailing={
                    <strong className={u.direction === "DEBIT" ? "text-destructive" : "text-success"}>
                      {u.direction === "DEBIT" ? "−" : "+"}
                      {money(u.amount.toString())}
                    </strong>
                  }
                />
              ))}
              <Row
                title="Tickets diarios"
                detail={
                  settlements.missing.length ? (
                    <span className="text-warning">
                      Faltan {settlements.missing.length}: {settlements.missing.slice(0, 4).map(ddmm).join(", ")}
                      {settlements.missing.length > 4 ? "…" : ""}
                    </span>
                  ) : settlements.upcoming.length === 0 ? (
                    "Sin débitos ni créditos próximos"
                  ) : undefined
                }
                trailing={settlements.missing.length ? <Badge tone="warning">Pendiente</Badge> : <Badge tone="success">Al día</Badge>}
              />
            </RowList>
          </DashCard>
        )}

        {finances && (
          <DashCard title="Plata por medio de cobro" link={{ href: `${base}/finanzas`, label: "Ver movimientos" }}>
            <RowList>
              {finances.funds
                .filter((f) => f.fund.active)
                .map((f) => (
                  <Row
                    key={f.fund.id}
                    title={f.fund.name}
                    detail={f.fund.settlesAgencyId ? "Cuenta del legajo" : undefined}
                    trailing={<strong className={f.balance.isNegative() ? "text-destructive" : ""}>{money(f.balance.toString())}</strong>}
                  />
                ))}
              <Row title="Total" trailing={<strong>{money(finances.total.toString())}</strong>} />
            </RowList>
          </DashCard>
        )}

        <DashCard title="Hoy en la agencia">
          <RowList>
            <Row
              title={
                <Link href={`${base}/horario`} className="hover:underline">
                  Horario
                </Link>
              }
              detail={[now.reason, now.holidayWithoutException ? "feriado sin excepción" : null].filter(Boolean).join(" · ") || undefined}
              trailing={<span className="text-sm">{formatRanges(now.ranges)}</span>}
            />
            <Row
              title={
                <Link href={`${base}/productos`} className="hover:underline">
                  Productos a la venta
                </Link>
              }
              detail={
                [...catalog.games.map((g) => g.name), ...catalog.products.map((p) => p.name)].slice(0, 5).join(", ") +
                (forSale > 5 ? "…" : "")
              }
              trailing={<strong>{forSale}</strong>}
            />
            {activeStaff && (
              <Row
                title={
                  <Link href={`${base}/personal`} className="hover:underline">
                    Personal activo
                  </Link>
                }
                detail={activeStaff.map((e) => e.firstName).join(", ") || "Todavía no hay personal cargado"}
                trailing={<strong>{activeStaff.length}</strong>}
              />
            )}
          </RowList>
        </DashCard>
      </div>
    </main>
  );
}
