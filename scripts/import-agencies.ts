// Load real agencies and staff from a local JSON file (never committed).
//   npm run agencies:import                       -> prisma/data/agencias.local.json
//   npm run agencies:import -- path/to/file.json
//
// Idempotent: agencies are matched by slug, the owner by email, employees by name.
import "dotenv/config";
import { readFileSync } from "node:fs";
import { prisma } from "../src/lib/prisma";
import { uniqueGroupSlug } from "../src/lib/groups";
import { ensureGeneral, getWeek, linkUnscheduledAgencies, replaceWeek, type Week } from "../src/lib/schedule";
import { syncDriveAccess } from "../src/lib/drive/sharing";

type EmployeeInput = {
  firstName: string;
  lastName: string;
  hiredAt?: string | null;
  leftAt?: string | null;
  email?: string | null;
  jobTitle?: string | null;
  notes?: string | null;
  publicName?: string | null;
  socialMediaConsent?: boolean;
};
type AgencyInput = {
  code: string;
  slug: string;
  name: string;
  licenseNumber: string;
  licenseHolder?: string | null;
  street?: string | null;
  streetNumber?: string | null;
  city?: string | null;
  email?: string | null;
  cellphoneNumber?: string | null;
  primaryColor?: string | null;
  employees: EmployeeInput[];
};
type ImportFile = {
  provinceCode: string;
  ownerEmail: string;
  ownerFirstName: string;
  ownerLastName: string;
  // Default weekly hours for agencies that have none yet (0 = Sunday .. 6 = Saturday).
  defaultWeeklyHours?: { days: number[]; opensAt: string; closesAt: string }[];
  agencies: AgencyInput[];
};

const file = process.argv[2] ?? "prisma/data/agencias.local.json";
const data = JSON.parse(readFileSync(file, "utf8")) as ImportFile;
const toDate = (iso?: string | null) => (iso ? new Date(`${iso}T00:00:00.000Z`) : null);

async function enableProvinceCatalog(provinceId: string) {
  // Dev default: every game and lottery available in the province. Real availability
  // comes from the platform admin later.
  for (const game of await prisma.gameDefinition.findMany()) {
    await prisma.provinceGameAvailability.upsert({
      where: { provinceId_gameId: { provinceId, gameId: game.id } },
      create: { provinceId, gameId: game.id },
      update: {},
    });
  }
  const lotteries = await prisma.lottery.findMany({ where: { quinielaDraws: true }, orderBy: { code: "asc" } });
  for (const [i, lottery] of lotteries.entries()) {
    await prisma.provinceLotteryAvailability.upsert({
      where: { provinceId_lotteryId: { provinceId, lotteryId: lottery.id } },
      create: { provinceId, lotteryId: lottery.id, sortOrder: i },
      update: {},
    });
  }
}

async function main() {
  const province = await prisma.province.findUniqueOrThrow({ where: { code: data.provinceCode } });
  await enableProvinceCatalog(province.id);
  const games = await prisma.gameDefinition.findMany();
  const ownerEmail = data.ownerEmail.toLowerCase();
  const owner = await prisma.user.findUnique({ where: { email: ownerEmail } });

  // The agencies belong to the group owned by ownerEmail (spec agency-groups); created if missing.
  const existingOwner = await prisma.agencyGroupOwner.findFirst({ where: { email: ownerEmail }, select: { groupId: true } });
  const groupName = owner?.name ?? `${data.ownerFirstName} ${data.ownerLastName}`;
  const group = existingOwner
    ? await prisma.agencyGroup.findUniqueOrThrow({ where: { id: existingOwner.groupId } })
    : await prisma.agencyGroup.create({
        data: {
          slug: await uniqueGroupSlug(groupName),
          name: groupName,
          owners: { create: { email: ownerEmail, userId: owner?.id ?? null } },
          events: { create: { kind: "OWNER_ADDED", detail: `importación: ${ownerEmail} queda como dueño` } },
        },
      });

  for (const a of data.agencies) {
    const fields = {
      name: a.name,
      provinceId: province.id,
      licenseNumber: a.licenseNumber,
      street: a.street ?? null,
      streetNumber: a.streetNumber ?? null,
      city: a.city ?? null,
      email: a.email?.toLowerCase() ?? null,
      cellphoneNumber: a.cellphoneNumber ?? null,
      primaryColor: a.primaryColor ?? null,
    };
    const agency = await prisma.agency.upsert({
      where: { slug: a.slug },
      create: { slug: a.slug, groupId: group.id, ...fields },
      update: fields, // an existing agency keeps its group (it may have been moved)
    });
    if (!agency.groupId) await prisma.agency.update({ where: { id: agency.id }, data: { groupId: group.id } });


    for (const game of games) {
      await prisma.agencyGameAvailability.upsert({
        where: { agencyId_gameId: { agencyId: agency.id, gameId: game.id } },
        create: { agencyId: agency.id, gameId: game.id },
        update: {},
      });
    }

    // Titular = license holder ("Apellido, Nombres"): agency data, grants no access.
    const holder = a.licenseHolder?.includes(",")
      ? { lastName: a.licenseHolder.split(",")[0].trim(), firstName: a.licenseHolder.split(",").slice(1).join(",").trim() }
      : null;
    if (holder)
      await prisma.agency.update({
        where: { id: agency.id },
        data: { titularFirstName: holder.firstName, titularLastName: holder.lastName },
      });

    for (const e of a.employees) {
      const existing = await prisma.agencyEmployee.findFirst({
        where: { agencyId: agency.id, firstName: e.firstName, lastName: e.lastName },
      });
      const empData = {
        role: "EMPLOYEE" as const,
        active: !e.leftAt,
        hiredAt: toDate(e.hiredAt),
        leftAt: toDate(e.leftAt),
        email: e.email?.toLowerCase() ?? null,
        jobTitle: e.jobTitle ?? null,
        notes: e.notes ?? null,
        publicName: e.publicName ?? null,
        socialMediaConsent: e.socialMediaConsent ?? false,
      };
      if (existing) await prisma.agencyEmployee.update({ where: { id: existing.id }, data: empData });
      else
        await prisma.agencyEmployee.create({
          data: { agencyId: agency.id, firstName: e.firstName, lastName: e.lastName, ...empData },
        });
    }
  }

  // Default hours go to the group's "Horario general" (spec agency-schedule): only when it
  // has no weekly hours yet, so changes made in the panel are never overwritten.
  if (data.defaultWeeklyHours?.length) {
    const general = await ensureGeneral(group.id);
    const current = await getWeek({ templateId: general.id });
    if (current.every((day) => day.length === 0)) {
      const week: Week = [[], [], [], [], [], [], []];
      for (const block of data.defaultWeeklyHours)
        for (const day of block.days) week[day].push({ opensAt: block.opensAt, closesAt: block.closesAt });
      await replaceWeek({ templateId: general.id }, week);
    }
    await linkUnscheduledAgencies(group.id, general.id);
  }

  const slugs = data.agencies.map((a) => a.slug);

  // Staff changed: keep each connected agency's Drive folder shared with its active staff.
  const connected = await prisma.agencyDriveConnection.findMany({
    where: { status: "ACTIVE", agency: { slug: { in: slugs } } },
    select: { agencyId: true, agency: { select: { name: true } } },
  });
  for (const c of connected) {
    try {
      const r = await syncDriveAccess(c.agencyId);
      if (r) console.log(`Drive ${c.agency.name}: +${r.added} -${r.removed}${r.failed ? `, ${r.failed} sin poder compartir` : ""}`);
    } catch (err) {
      console.warn(`Drive ${c.agency.name}: no se pudo sincronizar`, err);
    }
  }
  const summary = await prisma.agency.findMany({
    where: { slug: { in: slugs } },
    select: { name: true, licenseNumber: true, _count: { select: { employees: true } } },
    orderBy: { name: "asc" },
  });
  console.log(`Owner ${ownerEmail}: ${owner ? "linked to existing Google user" : "will link on first Google sign-in"}`);
  for (const s of summary) console.log(`  ${s.name} (legajo ${s.licenseNumber}): ${s._count.employees} personas`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
