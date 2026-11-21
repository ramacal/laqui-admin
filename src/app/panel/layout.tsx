// Panel shell: navigation (sidebar on desktop, drawer on mobile) around every panel screen.
// The links depend on the user's access: platform admin, owner, or agency staff.
import { requireAccess } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { publicUrl } from "@/lib/storage";
import {
  type NavAgency,
  type NavGroup,
  PanelNav,
} from "@/components/panel-nav";
import { ROLE_LABEL } from "@/lib/access";

export default async function PanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isPlatformAdmin, memberships } = await requireAccess();
  const isOwner = memberships.some((m) => m.role === "OWNER");

  const groups: NavGroup[] = [
    { title: null, links: [{ href: "/panel", label: "Inicio" }] },
  ];
  if (isOwner)
    groups.push({
      title: "Mis agencias",
      links: [
        { href: "/panel/horarios", label: "Horario general" },
        { href: "/panel/productos", label: "Productos" },
      ],
    });
  if (isPlatformAdmin)
    groups.push({
      title: "Plataforma",
      links: [
        { href: "/panel/juegos", label: "Juegos y precios" },
        { href: "/panel/loterias", label: "Loterías" },
        { href: "/panel/quiniela", label: "Sorteos de Quiniela" },
        { href: "/panel/tareas", label: "Tareas programadas" },
        { href: "/panel/redes", label: "Ideas para redes" },
      ],
    });

  // Admins see every agency; the rest, the ones they work in.
  const agencyRows = isPlatformAdmin
    ? await prisma.agency.findMany({
        where: { active: true },
        select: {
          id: true,
          name: true,
          primaryColor: true,
          assets: {
            where: { kind: "LOGO_SYMBOL" },
            select: { storageKey: true },
          },
        },
        orderBy: { name: "asc" },
      })
    : memberships.map((m) => ({ ...m.agency }));
  const roleOf = new Map(
    memberships.map((m) => [m.agency.id, ROLE_LABEL[m.role]]),
  );
  const agencies: NavAgency[] = agencyRows.map((a) => ({
    id: a.id,
    name: a.name,
    color: a.primaryColor,
    logo: a.assets[0] ? publicUrl(a.assets[0].storageKey) : null,
    badge: roleOf.get(a.id) ?? null,
  }));

  return (
    <div className="shell">
      <PanelNav
        groups={groups}
        agencies={agencies}
        user={{ name: user.name, email: user.email }}
      />
      <div className="shell-main">{children}</div>
    </div>
  );
}
