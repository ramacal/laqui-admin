// Jugando Online: SorteosQuiniela3.aspx shows the 20 prizes of every draw of the latest day
// (Ciudad, Provincia, Santa Fe, Córdoba, Entre Ríos, Montevideo) but not which day it is; the
// home page (rHome.aspx) says it ("Sorteos del Martes 17 de Noviembre") and shows each draw's
// first prize. A draw is only accepted when its first prize matches the home page's, so both
// pages are known to show the same day.
import type { QuinielaDrawSlot } from "@/generated/prisma/enums";
import { fetchText, iso, monthIndex, sleep, text } from "@/lib/quiniela/results/http";
import { type Reading, type ResultSource, SourceError, validReading } from "@/lib/quiniela/results/types";

const BASE = "https://www.jugandoonline.com.ar";
const SLOT_WORD: [RegExp, QuinielaDrawSlot][] = [
  [/previa/i, "PREVIA"],
  [/primer/i, "PRIMERA"],
  [/matutin/i, "MATUTINA"],
  [/vespertin/i, "VESPERTINA"],
  [/nocturn/i, "NOCTURNA"],
];
const LOTTERY_TITLE: [RegExp, string][] = [
  [/^ciudad/i, "CIUDAD"],
  [/^prov/i, "PROVINCIA"],
  [/^santa ?fe/i, "SANTA_FE"],
  [/^c[oó]rdoba/i, "CORDOBA"],
  [/^entre ?r[ií]os/i, "ENTRE_RIOS"],
  [/^montevideo/i, "MONTEVIDEO"],
];
const HOME_DIV: Record<string, string> = {
  Ciudad: "CIUDAD",
  ProvBsAs: "PROVINCIA",
  SantaFe: "SANTA_FE",
  Cordoba: "CORDOBA",
  EntreRios: "ENTRE_RIOS",
  Montevideo: "MONTEVIDEO",
};
const slotOf = (s: string) => SLOT_WORD.find(([re]) => re.test(s))?.[1];

/** Date of the home page's draws ("Sorteos del Martes 17 de Noviembre"); the year is the latest one not in the future. */
export function parseHomeDate(html: string, today: string) {
  const m = html.match(/id="MainContent_lblFecha">[^<]*?(\d{1,2})\s+de\s+(\p{L}+)/u);
  if (!m || monthIndex(m[2]) < 1) return null;
  let year = Number(today.slice(0, 4));
  if (iso(year, monthIndex(m[2]), Number(m[1])) > today) year--;
  return iso(year, monthIndex(m[2]), Number(m[1]));
}

/** First prize of each draw on the home page: "CIUDAD|PREVIA" → "1452". */
export function parseHomeHeads(html: string) {
  const heads = new Map<string, string>();
  for (const [div, lottery] of Object.entries(HOME_DIV)) {
    const start = html.indexOf(`id="MainContent_CabezasHoy${div}Div"`);
    if (start < 0) continue;
    const chunk = html.slice(start, html.indexOf("</div></div></div>", start) + 1 || start + 6000);
    for (const m of chunk.matchAll(/href="Quiniela-(\w+)\.aspx">(\d{3,5})<\/a>/g)) {
      const slot = slotOf(m[1]);
      if (slot && !heads.has(`${lottery}|${slot}`)) heads.set(`${lottery}|${slot}`, m[2]);
    }
  }
  return heads;
}

/** Every draw on the day page (date given by the caller). */
export function parseDay(html: string, date: string): Reading[] {
  const out: Reading[] = [];
  for (const block of html.split(/<div class="sorteos-enzo">/).slice(1)) {
    const title = text(block.match(/^\s*<div class="[^"]*">([^<]+)<\/div>/)?.[1] ?? "");
    const lottery = LOTTERY_TITLE.find(([re]) => re.test(title))?.[1];
    const slot = slotOf(title);
    if (!lottery || !slot) continue;
    const numbers = [...block.matchAll(/<div class="Num(?: cabeza)?">(\d+)<\/div>/g)].slice(0, 20).map((m) => m[1]);
    const letters = block.match(/<div class="letras[^"]*">([A-Z ]+)<\/div>/)?.[1]?.replace(/\s/g, "") || null;
    const reading: Reading = { date, slot, lottery, numbers, letters };
    if (validReading(reading)) out.push(reading);
  }
  return out;
}

export const jugandoOnline: ResultSource = {
  key: "jugandoonline",
  label: "Jugando Online",
  url: `${BASE}/rHome.aspx`,
  officialFor: [],
  read: async () => {
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });
    const home = await fetchText(`${BASE}/rHome.aspx`);
    const date = parseHomeDate(home, today);
    if (!date) throw new SourceError("Jugando Online: no encontré la fecha de los sorteos en la portada.");
    const heads = parseHomeHeads(home);
    await sleep(3000);
    const day = parseDay(await fetchText(`${BASE}/SorteosQuiniela3.aspx`), date);
    // Same day on both pages: the first prize has to match the home page's.
    return day.filter((r) => heads.get(`${r.lottery}|${r.slot}`) === r.numbers[0]);
  },
};
