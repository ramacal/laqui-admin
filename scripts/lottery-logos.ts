// Download the official lotteries' logos listed in prisma/data/lotteries.ts into storage.
//   npm run lotteries:logos             -> only lotteries without a logo
//   npm run lotteries:logos -- --force  -> replace every logo from the list
// Logos changed by hand in Plataforma → Loterías are kept unless --force.
import "dotenv/config";
import { LOTTERIES } from "../prisma/data/lotteries";
import { logoPng, replaceLotteryLogo } from "../src/lib/lotteries";
import { prisma } from "../src/lib/prisma";

async function main() {
  const force = process.argv.includes("--force");
  for (const seed of LOTTERIES) {
    const lottery = await prisma.lottery.findUnique({ where: { code: seed.code } });
    if (!lottery) {
      console.log(`${seed.code}: no está en la base (corré npm run db:seed)`);
      continue;
    }
    if (!seed.logoUrl) {
      console.log(`${seed.code}: sin logo en la lista`);
      continue;
    }
    if (lottery.logoKey && !force) {
      console.log(`${seed.code}: ya tiene logo`);
      continue;
    }
    try {
      const res = await fetch(seed.logoUrl, { headers: { "User-Agent": "laqui-admin" } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const png = await logoPng(new Uint8Array(await res.arrayBuffer()));
      await replaceLotteryLogo(lottery, png);
      console.log(`${seed.code}: logo cargado (${Math.round(png.byteLength / 1024)} KB)`);
    } catch (err) {
      console.log(`${seed.code}: no se pudo bajar el logo (${(err as Error).message})`);
    }
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
