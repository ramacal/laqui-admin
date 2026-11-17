// Development seed. Idempotent: safe to run many times (`npm run db:seed`).
//
// Two kinds of data:
//   1. Reference data (games, provinces, lotteries) — meant to be real.
//   2. DEMO data (one province's availability and a demo agency) — placeholders
//      for local development only. Quiniela programs are never invented: they come
//      from each province's official program (see src/lib/quiniela).
//
// Values marked "TODO confirm" are placeholders that must be checked against
// current official prices/rules before going to production.

import "dotenv/config";
import { Prisma } from "../src/generated/prisma/client";
import { prisma } from "../src/lib/prisma";

// ─── Reference: games ─────────────────────────────────────────

const GAMES = [
  {
    code: "QUINIELA",
    name: "Quiniela",
    kind: "QUINIELA" as const,
    defaultPrice: new Prisma.Decimal(100), // minimum per bet line. TODO confirm
    maxDigits: 4,
    modalities: [],
  },
  {
    code: "QUINI_6",
    name: "Quini 6",
    kind: "NUMBER_PICK" as const,
    defaultPrice: new Prisma.Decimal(2500), // TODO confirm current price
    pickCount: 6,
    minNumber: 0,
    maxNumber: 45,
    modalities: [
      { code: "TRADICIONAL", name: "Tradicional" },
      { code: "LA_SEGUNDA", name: "La Segunda" },
      { code: "REVANCHA", name: "Revancha" },
      { code: "SIEMPRE_SALE", name: "Siempre Sale" },
    ],
  },
  {
    code: "LOTO_PLUS",
    name: "Loto Plus",
    kind: "NUMBER_PICK" as const,
    defaultPrice: new Prisma.Decimal(3000), // reference price from spec 001
    pickCount: 6,
    minNumber: 0,
    maxNumber: 45,
    extraMin: 0,
    extraMax: 9,
    modalities: [
      { code: "TRADICIONAL", name: "Tradicional" },
      { code: "MATCH", name: "Match" },
      { code: "DESQUITE", name: "Desquite" },
      { code: "SALE_O_SALE", name: "Sale o Sale" },
    ],
  },
];

// ─── Reference: provinces (ISO 3166-2:AR codes) ────────────────

const PROVINCES: [code: string, name: string][] = [
  ["C", "Ciudad Autónoma de Buenos Aires"],
  ["B", "Buenos Aires"],
  ["K", "Catamarca"],
  ["H", "Chaco"],
  ["U", "Chubut"],
  ["X", "Córdoba"],
  ["W", "Corrientes"],
  ["E", "Entre Ríos"],
  ["P", "Formosa"],
  ["Y", "Jujuy"],
  ["L", "La Pampa"],
  ["F", "La Rioja"],
  ["M", "Mendoza"],
  ["N", "Misiones"],
  ["Q", "Neuquén"],
  ["R", "Río Negro"],
  ["A", "Salta"],
  ["J", "San Juan"],
  ["D", "San Luis"],
  ["Z", "Santa Cruz"],
  ["S", "Santa Fe"],
  ["G", "Santiago del Estero"],
  ["V", "Tierra del Fuego"],
  ["T", "Tucumán"],
];

// ─── Reference: Quiniela lotteries ─────────────────────────────

const LOTTERIES: [code: string, name: string][] = [
  ["CIUDAD", "Ciudad"],
  ["PROVINCIA", "Provincia"],
  ["SANTA_FE", "Santa Fe"],
  ["CORDOBA", "Córdoba"],
  ["ENTRE_RIOS", "Entre Ríos"],
  ["MENDOZA", "Mendoza"],
  ["MONTEVIDEO", "Montevideo"],
];

// ─── DEMO data ─────────────────────────────────────────────────

const DEMO_PROVINCE = "S"; // Santa Fe
const DEMO_LOTTERIES = ["CIUDAD", "PROVINCIA", "SANTA_FE", "CORDOBA", "ENTRE_RIOS", "MONTEVIDEO"];

const DEMO_AGENCY = {
  slug: "agencia-demo",
  name: "Agencia Demo",
  licenseNumber: "0001", // placeholder legajo
  cellphoneNumber: "5490000000000", // placeholder, not a real number
  primaryColor: "#0f766e",
};

const DEMO_STAFF = [
  { role: "OWNER", firstName: "Dueño", lastName: "Demo", cuil: "20123456788", phone: "5490000000001", email: "dueno@laqui.test" },
  { role: "ADMIN", firstName: "Admin", lastName: "Demo", cuil: "27222222228", phone: "5490000000002", email: "admin-agencia@laqui.test" },
  { role: "EMPLOYEE", firstName: "Empleado", lastName: "Demo", cuil: "20333333334", phone: "5490000000003", email: "empleado@laqui.test" },
] as const;

const PLATFORM_ADMIN_EMAIL = "admin@laqui.test";

// ─── Helpers ───────────────────────────────────────────────────

// @db.Time / @db.Date columns: store wall-clock values on a UTC-anchored Date.
const time = (hhmm: string) => new Date(`1970-01-01T${hhmm}:00.000Z`);

// ─── Seed steps ────────────────────────────────────────────────

async function seedGames() {
  for (const { modalities, defaultPrice, ...game } of GAMES) {
    const saved = await prisma.gameDefinition.upsert({
      where: { code: game.code },
      create: game,
      update: game,
    });
    // Initial national price, only if the game has none yet (edits in the panel are kept).
    if (!(await prisma.gamePrice.count({ where: { gameId: saved.id } })))
      await prisma.gamePrice.create({
        data: { gameId: saved.id, amount: defaultPrice, validFrom: new Date("2026-01-01T00:00:00Z"), note: "Precio inicial" },
      });
    for (const [i, mod] of modalities.entries()) {
      await prisma.gameModality.upsert({
        where: { gameId_code: { gameId: saved.id, code: mod.code } },
        create: { ...mod, gameId: saved.id, sortOrder: i },
        update: { name: mod.name, sortOrder: i },
      });
    }
  }
}

async function seedProvincesAndLotteries() {
  for (const [code, name] of PROVINCES) {
    await prisma.province.upsert({ where: { code }, create: { code, name }, update: { name } });
  }
  for (const [code, name] of LOTTERIES) {
    await prisma.lottery.upsert({ where: { code }, create: { code, name }, update: { name } });
  }
}

async function seedDemoProvince() {
  const province = await prisma.province.findUniqueOrThrow({ where: { code: DEMO_PROVINCE } });
  const games = await prisma.gameDefinition.findMany();

  for (const game of games) {
    await prisma.provinceGameAvailability.upsert({
      where: { provinceId_gameId: { provinceId: province.id, gameId: game.id } },
      create: { provinceId: province.id, gameId: game.id },
      update: {},
    });
  }

  for (const [i, code] of DEMO_LOTTERIES.entries()) {
    const lottery = await prisma.lottery.findUniqueOrThrow({ where: { code } });
    await prisma.provinceLotteryAvailability.upsert({
      where: { provinceId_lotteryId: { provinceId: province.id, lotteryId: lottery.id } },
      create: { provinceId: province.id, lotteryId: lottery.id, sortOrder: i },
      update: { sortOrder: i },
    });
  }
}

async function seedDemoAgency() {
  const province = await prisma.province.findUniqueOrThrow({ where: { code: DEMO_PROVINCE } });
  const agency = await prisma.agency.upsert({
    where: { slug: DEMO_AGENCY.slug },
    create: { ...DEMO_AGENCY, provinceId: province.id },
    update: { name: DEMO_AGENCY.name, licenseNumber: DEMO_AGENCY.licenseNumber, primaryColor: DEMO_AGENCY.primaryColor },
  });

  const allowed = await prisma.provinceGameAvailability.findMany({
    where: { provinceId: province.id, enabled: true },
  });
  for (const { gameId } of allowed) {
    await prisma.agencyGameAvailability.upsert({
      where: { agencyId_gameId: { agencyId: agency.id, gameId } },
      create: { agencyId: agency.id, gameId },
      update: {},
    });
  }

  // Demo staff, one per agency role, each with a login. Fake people; CUILs are
  // made-up numbers with a valid check digit. Emails use the reserved .test TLD.
  for (const s of DEMO_STAFF) {
    const user = await prisma.user.upsert({
      where: { email: s.email },
      create: { email: s.email, name: `${s.firstName} ${s.lastName}` },
      update: {},
    });
    await prisma.agencyEmployee.upsert({
      where: { agencyId_cuil: { agencyId: agency.id, cuil: s.cuil } },
      create: {
        agencyId: agency.id,
        userId: user.id,
        role: s.role,
        firstName: s.firstName,
        lastName: s.lastName,
        cuil: s.cuil,
        phone: s.phone,
        email: s.email,
        street: "Calle Falsa",
        streetNumber: "123",
        city: "Rosario",
        postalCode: "2000",
        addressProvinceId: province.id,
      },
      update: { role: s.role, userId: user.id },
    });
  }

  // Mon–Fri 08:00–21:00, Sat 08:00–13:00. Replace rules wholesale to stay idempotent.
  await prisma.agencyScheduleRule.deleteMany({ where: { agencyId: agency.id } });
  await prisma.agencyScheduleRule.createMany({
    data: [
      ...[1, 2, 3, 4, 5].map((weekday) => ({
        agencyId: agency.id,
        weekday,
        opensAt: time("08:00"),
        closesAt: time("21:00"),
      })),
      { agencyId: agency.id, weekday: 6, opensAt: time("08:00"), closesAt: time("13:00") },
    ],
  });
}

async function seedPlatformAdmin() {
  await prisma.user.upsert({
    where: { email: PLATFORM_ADMIN_EMAIL },
    create: { email: PLATFORM_ADMIN_EMAIL, name: "Admin Plataforma", platformRole: "PLATFORM_ADMIN" },
    update: { platformRole: "PLATFORM_ADMIN" },
  });
}

async function main() {
  await seedPlatformAdmin();
  await seedGames();
  await seedProvincesAndLotteries();
  await seedDemoProvince();
  await seedDemoAgency();

  const counts = {
    games: await prisma.gameDefinition.count(),
    modalities: await prisma.gameModality.count(),
    provinces: await prisma.province.count(),
    lotteries: await prisma.lottery.count(),
    programs: await prisma.provinceQuinielaMonthlyProgram.count(),
    programDays: await prisma.provinceQuinielaProgramDay.count(),
    draws: await prisma.provinceQuinielaProgramDayDraw.count(),
    agencies: await prisma.agency.count(),
    employees: await prisma.agencyEmployee.count(),
    users: await prisma.user.count(),
    scheduleRules: await prisma.agencyScheduleRule.count(),
  };
  console.log("Seed OK", counts);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
