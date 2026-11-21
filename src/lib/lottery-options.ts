// Countries and jurisdictions for the lottery form (a jurisdiction has at most one official lottery).
import { prisma } from "@/lib/prisma";

export async function lotteryFormOptions(currentLotteryId: string | null) {
  const [countries, provinces] = await Promise.all([
    prisma.country.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.province.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, countryId: true, ownLottery: { select: { id: true } } },
    }),
  ]);
  return {
    countries,
    provinces: provinces.map((p) => ({
      id: p.id,
      name: p.name,
      countryId: p.countryId,
      taken: !!p.ownLottery && p.ownLottery.id !== currentLotteryId,
    })),
  };
}
