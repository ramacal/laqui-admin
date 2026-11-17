import Image from "next/image";
import Link from "next/link";
import { ROLE_LABEL, requireAccess } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { publicUrl } from "@/lib/storage";
import { SignOutButton } from "@/components/sign-out-button";

export const metadata = { title: "Panel · Laqui" };

const agencySummary = {
  id: true,
  name: true,
  licenseNumber: true,
  city: true,
  primaryColor: true,
  province: { select: { code: true } },
  assets: { where: { kind: "LOGO_SYMBOL" as const }, select: { storageKey: true } },
};

type AgencySummary = {
  id: string;
  name: string;
  licenseNumber: string;
  city: string | null;
  primaryColor: string | null;
  province: { code: string };
  assets: { storageKey: string }[];
};

function AgencyCard({ agency, badge }: { agency: AgencySummary; badge?: string }) {
  const logo = agency.assets[0];
  return (
    <li>
      <Link href={`/panel/agencias/${agency.id}`} className="card row link-card">
        <div className="row agency">
          {logo ? (
            <Image src={publicUrl(logo.storageKey)} alt="" width={48} height={48} className="agency-logo" />
          ) : (
            <span
              className="agency-logo placeholder"
              style={{ background: agency.primaryColor ?? undefined }}
              aria-hidden="true"
            >
              {agency.name.charAt(0)}
            </span>
          )}
          <div className="stack-xs">
            <strong>{agency.name}</strong>
            <span className="muted small">
              {/^pend/i.test(agency.licenseNumber)
                ? "Legajo pendiente"
                : `Legajo ${agency.province.code}-${agency.licenseNumber}`}
              {agency.city ? ` · ${agency.city}` : ""}
            </span>
          </div>
        </div>
        <span className="row agency-meta">
          {badge && <span className="badge">{badge}</span>}
          <span className="chevron" aria-hidden="true">
            ›
          </span>
        </span>
      </Link>
    </li>
  );
}

export default async function PanelPage() {
  const { user, isPlatformAdmin, memberships } = await requireAccess();
  const hasAccess = isPlatformAdmin || memberships.length > 0;

  // Platform admins see every agency; the rest only their memberships.
  const allAgencies = isPlatformAdmin
    ? await prisma.agency.findMany({ where: { active: true }, select: agencySummary, orderBy: { name: "asc" } })
    : [];

  return (
    <main className="screen">
      <header className="topbar">
        <div className="stack-xs">
          <strong>{user.name}</strong>
          <span className="muted small">{user.email}</span>
        </div>
        <SignOutButton />
      </header>

      <section className="stack">
        {isPlatformAdmin && (
          <Link href="/panel/juegos" className="card row link-card">
            <div className="stack-xs">
              <strong>Juegos y precios</strong>
              <span className="muted small">Juegos oficiales y sus precios por provincia, con vigencia</span>
            </div>
            <span className="chevron" aria-hidden="true">
              ›
            </span>
          </Link>
        )}

        {memberships.some((m) => m.role === "OWNER") && (
          <>
            <Link href="/panel/horarios" className="card row link-card">
              <div className="stack-xs">
                <strong>Horario general</strong>
                <span className="muted small">El horario que heredan tus agencias, con excepciones y feriados</span>
              </div>
              <span className="chevron" aria-hidden="true">
                ›
              </span>
            </Link>
            <Link href="/panel/productos" className="card row link-card">
              <div className="stack-xs">
                <strong>Productos</strong>
                <span className="muted small">Productos oficiales y propios, con su precio y en qué agencias se ofrecen</span>
              </div>
              <span className="chevron" aria-hidden="true">
                ›
              </span>
            </Link>
          </>
        )}

        {memberships.length > 0 && (
          <div className="stack-sm">
            <h2>Tus agencias</h2>
            <ul className="list">
              {memberships.map((m) => (
                <AgencyCard key={m.id} agency={m.agency} badge={ROLE_LABEL[m.role]} />
              ))}
            </ul>
          </div>
        )}

        {isPlatformAdmin && (
          <div className="stack-sm">
            <div className="row">
              <h2>Todas las agencias</h2>
              <span className="badge">Admin de plataforma</span>
            </div>
            <ul className="list">
              {allAgencies.map((a) => (
                <AgencyCard key={a.id} agency={a} />
              ))}
            </ul>
          </div>
        )}

        {!hasAccess && (
          <article className="card stack-sm">
            <h2>Todavía no tenés acceso</h2>
            <p className="muted">
              Pedile al dueño o administrador de tu agencia que te registre como empleado con este email:{" "}
              <strong>{user.email}</strong>. La próxima vez que ingreses vas a ver tu agencia acá.
            </p>
          </article>
        )}
      </section>
    </main>
  );
}
