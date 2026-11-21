"use client";

// Panel navigation. Desktop: fixed sidebar. Mobile: top bar with a menu button that opens the
// same navigation as a drawer. The current section is highlighted; the agency you are in shows
// its own sections (caja, fiados, finanzas…).
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { SignOutButton } from "@/components/sign-out-button";

export type NavLink = { href: string; label: string };
export type NavGroup = {
  title: string | null;
  hint?: string; // one muted line under the title
  placement?: "top" | "bottom"; // bottom: after the agency list
  links: NavLink[];
};

function Group({ group, pathname }: { group: NavGroup; pathname: string }) {
  return (
    <div className={`nav-group ${group.placement === "bottom" ? "is-settings" : ""}`}>
      {group.title && <span className="nav-title">{group.title}</span>}
      {group.hint && <span className="nav-hint">{group.hint}</span>}
      {group.links.map((l) => (
        <Link key={l.href} href={l.href} className={`nav-link ${isActive(pathname, l.href) ? "is-active" : ""}`}>
          {l.label}
        </Link>
      ))}
    </div>
  );
}
export type NavAgency = {
  id: string;
  name: string;
  logo: string | null;
  color: string | null;
  badge: string | null;
};

const AGENCY_SECTIONS: NavLink[] = [
  { href: "", label: "Resumen" },
  { href: "/caja", label: "Caja" },
  { href: "/fiados", label: "Fiados" },
  { href: "/finanzas", label: "Finanzas" },
  { href: "/liquidaciones", label: "Liquidaciones" },
  { href: "/horario", label: "Horario" },
  { href: "/productos", label: "Productos" },
  { href: "/personal", label: "Personal" },
];

const isActive = (pathname: string, href: string) =>
  href === "/panel"
    ? pathname === "/panel"
    : pathname === href || pathname.startsWith(`${href}/`);

function AgencyMark({ agency }: { agency: NavAgency }) {
  return agency.logo ? (
    <Image
      src={agency.logo}
      alt=""
      width={24}
      height={24}
      className="nav-logo"
    />
  ) : (
    <span
      className="nav-logo placeholder"
      style={{ background: agency.color ?? undefined }}
      aria-hidden="true"
    >
      {agency.name.charAt(0)}
    </span>
  );
}

export function PanelNav({
  groups,
  agencies,
  user,
}: {
  groups: NavGroup[];
  agencies: NavAgency[];
  user: { name: string; email: string };
}) {
  const pathname = usePathname();
  // The drawer stays open only on the page where it was opened, so navigating closes it.
  const [openOn, setOpenOn] = useState<string | null>(null);
  // With many agencies the list gets long: a filter by name (the current agency always shows).
  const [filter, setFilter] = useState("");
  const fold = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const needle = fold(filter.trim());
  const showFilter = agencies.length > 5;
  const open = openOn === pathname;
  const setOpen = (next: boolean | ((o: boolean) => boolean)) =>
    setOpenOn((typeof next === "function" ? next(open) : next) ? pathname : null);

  return (
    <>
      <header className="mobile-bar">
        <Link href="/panel" className="brand">
          Laqui
        </Link>
        <button
          type="button"
          className="menu-btn"
          aria-expanded={open}
          aria-controls="panel-nav"
          onClick={() => setOpen((o) => !o)}
        >
          <span aria-hidden="true">{open ? "✕" : "☰"}</span>
          <span className="sr-only">{open ? "Cerrar menú" : "Abrir menú"}</span>
        </button>
      </header>
      {open && (
        <div
          className="nav-backdrop"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      <nav
        id="panel-nav"
        className={`sidebar ${open ? "is-open" : ""}`}
        aria-label="Panel"
      >
        <Link href="/panel" className="brand sidebar-brand">
          Laqui
        </Link>
        <div className="nav-scroll">
          {groups
            .filter((g) => g.placement !== "bottom")
            .map((g, i) => (
              <Group key={g.title ?? i} group={g} pathname={pathname} />
            ))}
          {agencies.length > 0 && (
            <div className="nav-group">
              <span className="nav-title">Agencias ({agencies.length})</span>
              {showFilter && (
                <input
                  type="search"
                  className="nav-filter"
                  placeholder="Buscar agencia…"
                  aria-label="Buscar agencia"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                />
              )}
              {agencies.map((a) => {
                const base = `/panel/agencias/${a.id}`;
                const inside =
                  pathname === base || pathname.startsWith(`${base}/`);
                if (needle && !inside && !fold(a.name).includes(needle)) return null;
                return (
                  <div key={a.id}>
                    <Link
                      href={base}
                      className={`nav-link nav-agency ${inside ? "is-current" : ""}`}
                    >
                      <AgencyMark agency={a} />
                      <span className="nav-agency-name">{a.name}</span>
                    </Link>
                    {inside && (
                      <div className="nav-sub">
                        {AGENCY_SECTIONS.map((s) => {
                          const href = `${base}${s.href}`;
                          const active =
                            s.href === ""
                              ? pathname === base
                              : isActive(pathname, href);
                          return (
                            <Link
                              key={s.label}
                              href={href}
                              className={`nav-link ${active ? "is-active" : ""}`}
                            >
                              {s.label}
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
              {needle && !agencies.some((a) => fold(a.name).includes(needle)) && (
                <span className="muted small nav-empty">Ninguna coincide</span>
              )}
            </div>
          )}
          {groups
            .filter((g) => g.placement === "bottom")
            .map((g, i) => (
              <Group key={g.title ?? i} group={g} pathname={pathname} />
            ))}
        </div>
        <div className="nav-user">
          <div className="stack-xs">
            <strong className="small">{user.name}</strong>
            <span className="muted small">{user.email}</span>
          </div>
          <SignOutButton />
        </div>
      </nav>
    </>
  );
}
