// Sync national holidays from ArgentinaDatos (logic in src/lib/holidays-sync.ts).
//   npm run holidays:sync              -> current and next year
//   npm run holidays:sync -- 2028      -> a specific year
import "dotenv/config";
import { syncHolidayYear } from "../src/lib/holidays-sync";
import { prisma } from "../src/lib/prisma";

async function main() {
  const arg = Number(process.argv[2]);
  const now = new Date().getUTCFullYear();
  const years = Number.isInteger(arg) && arg > 2000 ? [arg] : [now, now + 1];
  for (const year of years) {
    const r = await syncHolidayYear(year);
    console.log(`${r.year}: ${r.count} feriados${r.removed ? `, ${r.removed} eliminados del calendario oficial` : ""}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
