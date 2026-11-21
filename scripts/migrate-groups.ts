// agency-groups, phase 1: build groups from the current OWNER rows (spec: agency-groups).
//   npx tsx scripts/migrate-groups.ts --dry-run   -> prints the plan, writes nothing
//   npx tsx scripts/migrate-groups.ts             -> applies it in one transaction
//
// Rules:
//   - One group per distinct owner login (OWNER row userId; else its email; else the agency alone).
//   - Group name = the owner user's name; its first owner = that login's email.
//   - Titular = the OWNER row's name and CUIL. A name that looks like a business ("Agencias …")
//     is a placeholder and stays empty. The OWNER row's email is the login, not the titular's,
//     so titularEmail is left empty.
//   - The owner's general schedule and owner products move to the group.
// Idempotent: agencies that already have a group are skipped; groups are matched by slug.
// Owner product images keep their current keys; they move in phase 4.
import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { slug } from "../src/lib/names";

const dryRun = process.argv.includes("--dry-run");

type Plan = {
  key: string;
  name: string;
  slug: string;
  ownerEmail: string | null;
  ownerUserId: string | null;
  agencies: { id: string; name: string; titular: { first: string; last: string; cuil: string | null } | null; note?: string }[];
};

const isPlaceholder = (first: string, last: string) => /^agencias?\b/i.test(`${first} ${last}`.trim());

async function main() {
  const agencies = await prisma.agency.findMany({
    where: { groupId: null },
    select: {
      id: true,
      name: true,
      employees: {
        where: { role: "OWNER" },
        orderBy: [{ active: "desc" }, { createdAt: "asc" }],
        select: { firstName: true, lastName: true, cuil: true, email: true, userId: true, user: { select: { name: true, email: true } } },
      },
    },
    orderBy: { name: "asc" },
  });

  const plans = new Map<string, Plan>();
  for (const a of agencies) {
    const owner = a.employees[0];
    const key = owner?.userId ?? owner?.email ?? `agency:${a.id}`;
    const name = owner?.user?.name ?? (owner ? `${owner.firstName} ${owner.lastName}` : a.name);
    let plan = plans.get(key);
    if (!plan) {
      plan = {
        key,
        name,
        slug: slug(name),
        ownerEmail: (owner?.user?.email ?? owner?.email ?? null)?.toLowerCase() ?? null,
        ownerUserId: owner?.userId ?? null,
        agencies: [],
      };
      plans.set(key, plan);
    }
    const placeholder = owner && isPlaceholder(owner.firstName, owner.lastName);
    plan.agencies.push({
      id: a.id,
      name: a.name,
      titular: owner && !placeholder ? { first: owner.firstName, last: owner.lastName, cuil: owner.cuil } : null,
      note: !owner ? "sin dueño cargado" : placeholder ? `titular "${owner.firstName} ${owner.lastName}" parece el nombre del grupo: queda pendiente` : undefined,
    });
  }

  // Unique slugs among new groups (and against existing ones).
  const taken = new Set((await prisma.agencyGroup.findMany({ select: { slug: true } })).map((g) => g.slug));
  for (const p of plans.values()) {
    const existing = await prisma.agencyGroup.findUnique({ where: { slug: p.slug } });
    if (existing) continue; // reused (idempotent re-run)
    let s = p.slug;
    for (let i = 2; taken.has(s); i++) s = `${p.slug}-${i}`;
    p.slug = s;
    taken.add(s);
  }

  // Report
  if (plans.size === 0) console.log("Nada para migrar: todas las agencias ya tienen grupo.");
  for (const p of plans.values()) {
    const schedules = p.ownerUserId ? await prisma.scheduleTemplate.count({ where: { ownerUserId: p.ownerUserId, groupId: null } }) : 0;
    const products = p.ownerUserId ? await prisma.ownerProduct.count({ where: { ownerUserId: p.ownerUserId, groupId: null } }) : 0;
    console.log(`\nGrupo "${p.name}" (${p.slug})`);
    console.log(`  Dueño: ${p.ownerEmail ?? "(sin email: cargarlo en Plataforma → Grupos)"}${p.ownerUserId ? "" : " · pendiente"}`);
    console.log(`  Horario general: ${schedules ? "pasa al grupo" : "no tiene"} · Productos propios: ${products}`);
    for (const a of p.agencies) {
      const t = a.titular ? `${a.titular.first} ${a.titular.last}${a.titular.cuil ? ` (CUIL ${a.titular.cuil})` : ""}` : "pendiente";
      console.log(`  - ${a.name} · titular: ${t}${a.note ? ` · ${a.note}` : ""}`);
    }
  }
  if (dryRun) {
    console.log("\n(--dry-run: no se escribió nada)");
    return;
  }

  await prisma.$transaction(async (tx) => {
    for (const p of plans.values()) {
      const group = await tx.agencyGroup.upsert({ where: { slug: p.slug }, update: {}, create: { slug: p.slug, name: p.name } });
      if (p.ownerEmail) {
        await tx.agencyGroupOwner.upsert({
          where: { groupId_email: { groupId: group.id, email: p.ownerEmail } },
          update: { userId: p.ownerUserId },
          create: { groupId: group.id, email: p.ownerEmail, userId: p.ownerUserId },
        });
        await tx.agencyGroupEvent.create({
          data: { groupId: group.id, kind: "OWNER_ADDED", detail: `migración: ${p.ownerEmail} queda como dueño` },
        });
      }
      for (const a of p.agencies)
        await tx.agency.update({
          where: { id: a.id },
          data: {
            groupId: group.id,
            titularFirstName: a.titular?.first ?? null,
            titularLastName: a.titular?.last ?? null,
            titularCuil: a.titular?.cuil ?? null,
          },
        });
      if (p.ownerUserId) {
        await tx.scheduleTemplate.updateMany({ where: { ownerUserId: p.ownerUserId, groupId: null }, data: { groupId: group.id } });
        await tx.ownerProduct.updateMany({ where: { ownerUserId: p.ownerUserId, groupId: null }, data: { groupId: group.id } });
      }
    }
  });
  console.log(`\nListo: ${plans.size} grupo(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
