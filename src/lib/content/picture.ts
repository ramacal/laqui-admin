// The branded picture of an idea for one agency (spec social-content "Branded Picture"),
// shared by the image route (preview and download) and "Guardar en Drive".
import { agencyBrand, RESPONSIBLE_GAMING } from "./brand";
import { ideaForAgency, isIsoDate, longDate, todayIn } from "./ideas";
import { isFormat, renderPicture, type Format } from "./render";
import { fileName } from "@/lib/names";

export type PictureOptions = { format?: string | null; date?: string | null; title?: string | null };

export async function ideaPicture(agencyId: string, ideaId: string, opts: PictureOptions) {
  const brand = await agencyBrand(agencyId);
  if (!brand) return null;

  const format: Format = isFormat(opts.format) ? opts.format : "story";
  const date = isIsoDate(opts.date) ? opts.date : todayIn(brand.timezone);
  const idea = await ideaForAgency(ideaId, brand, date);
  if (!idea) return null;

  const headline = (opts.title ?? "").trim().slice(0, 160) || idea.headline;
  const others = idea.numbers.filter((n) => n !== idea.main && n.value.length <= 4).slice(0, format === "cuadrado" ? 3 : 4);

  const picture = await renderPicture({
    format,
    headline,
    dateLabel: longDate(date),
    main: idea.main,
    others,
    agency: { name: brand.name, instagram: brand.instagram?.handle ?? null, logoKey: brand.logoKey },
    lottery: { logoKey: brand.lotteryLogoKey },
    colors: brand.colors,
    footer: RESPONSIBLE_GAMING,
  });
  return { picture, format, date, idea };
}

const FORMAT_NAME: Record<Format, string> = { story: "historia", feed: "feed", cuadrado: "cuadrado" };

/** Same name for the download and the Drive copy: 2026-11-20-vuelta-de-obligado-historia.png */
export const pictureFileName = (date: string, title: string, format: Format) =>
  fileName([date, title, FORMAT_NAME[format]], "png");
