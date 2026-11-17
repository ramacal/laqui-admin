// Load real agencies and staff from a local JSON file (never committed).
//   npm run agencies:import                       -> prisma/data/agencias.local.json
//   npm run agencies:import -- path/to/file.json
//
// Idempotent: agencies are matched by slug, the owner by email, employees by name.
import "dotenv/config";
import { readFileSync } from "node:fs";
import { prisma } from "../src/lib/prisma";

type EmployeeInput = { firstName: string; lastName: string; hiredAt?: string | null; email?: string | null };
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
  const lotteries = await prisma.lottery.findMany({ orderBy: { code: "asc" } });
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

  for (const a of data.agencies) {
    const fields = {
      name: a.name,
      provinceId: province.id,
      licenseNumber: a.licenseNumber,
      licenseHolder: a.licenseHolder ?? null,
      street: a.street ?? null,
      streetNumber: a.streetNumber ?? null,
      city: a.city ?? null,
      email: a.email?.toLowerCase() ?? null,
      cellphoneNumber: a.cellphoneNumber ?? null,
      primaryColor: a.primaryColor ?? null,
    };
    const agency = await prisma.agency.upsert({
      where: { slug: a.slug },
      create: { slug: a.slug, ...fields },
      update: fields,
    });

    for (const game of games) {
      await prisma.agencyGameAvailability.upsert({
        where: { agencyId_gameId: { agencyId: agency.id, gameId: game.id } },
        create: { agencyId: agency.id, gameId: game.id },
        update: {},
      });
    }

    // Owner account (linked to the Google user if it already signed in).
    const ownerRow = await prisma.agencyEmployee.findFirst({ where: { agencyId: agency.id, email: ownerEmail } });
    const ownerData = {
      role: "OWNER" as const,
      active: true,
      firstName: data.ownerFirstName,
      lastName: data.ownerLastName,
      email: ownerEmail,
      userId: owner?.id ?? null,
    };
    if (ownerRow) await prisma.agencyEmployee.update({ where: { id: ownerRow.id }, data: ownerData });
    else await prisma.agencyEmployee.create({ data: { agencyId: agency.id, ...ownerData } });

    for (const e of a.employees) {
      const existing = await prisma.agencyEmployee.findFirst({
        where: { agencyId: agency.id, firstName: e.firstName, lastName: e.lastName },
      });
      const empData = {
        role: "EMPLOYEE" as const,
        active: true,
        hiredAt: toDate(e.hiredAt),
        email: e.email?.toLowerCase() ?? null,
      };
      if (existing) await prisma.agencyEmployee.update({ where: { id: existing.id }, data: empData });
      else
        await prisma.agencyEmployee.create({
          data: { agencyId: agency.id, firstName: e.firstName, lastName: e.lastName, ...empData },
        });
    }
  }

  const slugs = data.agencies.map((a) => a.slug);
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
