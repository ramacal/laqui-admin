// What a picture needs from an agency: names, Instagram, logos and colors
// (agency color first, then its province's official lottery, then Lotería blue).
import { prisma } from "@/lib/prisma";

const DEFAULT_PRIMARY = "#000096";
const DEFAULT_SECONDARY = "#f5c400";

export const RESPONSIBLE_GAMING = "Jugá con responsabilidad · Prohibida la venta a menores de 18 años";

export async function agencyBrand(agencyId: string) {
  const agency = await prisma.agency.findUnique({
    where: { id: agencyId },
    select: {
      id: true,
      name: true,
      city: true,
      timezone: true,
      provinceId: true,
      primaryColor: true,
      province: {
        select: { name: true, ownLottery: { select: { logoKey: true, brandPrimaryColor: true, brandSecondaryColor: true, active: true } } },
      },
      assets: { where: { kind: { in: ["LOGO_SYMBOL", "LOGO_MAIN"] } }, select: { kind: true, storageKey: true } },
      socialAccounts: { orderBy: { network: "asc" } },
    },
  });
  if (!agency) return null;
  const logo = agency.assets.find((a) => a.kind === "LOGO_SYMBOL") ?? agency.assets[0];
  const instagram = agency.socialAccounts.find((s) => s.network === "INSTAGRAM") ?? null;
  // The province's official lottery brands its agencies' pictures.
  const lottery = agency.province.ownLottery?.active ? agency.province.ownLottery : null;
  return {
    ...agency,
    lotteryLogoKey: lottery?.logoKey ?? null,
    logoKey: logo?.storageKey ?? null,
    instagram,
    colors: {
      primary: agency.primaryColor ?? lottery?.brandPrimaryColor ?? DEFAULT_PRIMARY,
      secondary: lottery?.brandSecondaryColor ?? DEFAULT_SECONDARY,
    },
  };
}
