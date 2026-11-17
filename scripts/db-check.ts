// Quick connectivity check: npx tsx scripts/db-check.ts
import "dotenv/config";
import { prisma } from "../src/lib/prisma";

async function main() {
  const [games, provinces, agencies] = await Promise.all([
    prisma.gameDefinition.count(),
    prisma.province.count(),
    prisma.agency.count(),
  ]);
  console.log(`DB OK — games: ${games}, provinces: ${provinces}, agencies: ${agencies}`);
}

main().finally(() => prisma.$disconnect());
