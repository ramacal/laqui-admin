// Lotería de Santa Fe (official extracts): one page per draw slot in its extracts app, showing
// the latest draw of that slot with the 20 prizes of Nacional (Ciudad), Buenos Aires, Santa Fe,
// Uruguay (Montevideo), Entre Ríos and Córdoba. The draw shown is the first option of the
// "sorteo" selector ("Martes 17 - 8845") in the selected month ("Noviembre 2026").
//   <h3>2 - LOTERIA DE BS. AS.</h3> … <div class="numer">01 </div> <div class="numersorteo">2188 </div>
import type { QuinielaDrawSlot } from "@/generated/prisma/enums";
import { fetchText, iso, monthIndex, sleep } from "@/lib/quiniela/results/http";
import { type Reading, type ResultSource, SourceError, validReading } from "@/lib/quiniela/results/types";

const BASE = "https://apps.loteriasantafe.gov.ar:8443/Extractos/paginas";
const PAGES: Record<QuinielaDrawSlot, string> = {
  PREVIA: "mostrarQuinielaLaPrevia.xhtml",
  PRIMERA: "mostrarQuinielaElPrimero.xhtml",
  MATUTINA: "mostrarQuinielaMatutina.xhtml",
  VESPERTINA: "mostrarQuinielaVespertina.xhtml",
  NOCTURNA: "mostrarQuinielaNocturna.xhtml",
};
const LOTTERY: [RegExp, string][] = [
  [/NACIONAL|CIUDAD/, "CIUDAD"],
  [/BS\.? ?AS|BUENOS AIRES|PROVINCIA/, "PROVINCIA"],
  [/SANTA FE/, "SANTA_FE"],
  // Uruguay is skipped: Santa Fe shows its 3-digit numbers (431), not the 4-digit ones agencies
  // pay on (0431, 9432), so it cannot be compared with the other sources.
  [/URUGUAY|MONTEVIDEO/, "SKIP"],
  [/ENTRE R[IÍ]OS/, "ENTRE_RIOS"],
  [/C[OÓ]RDOBA/, "CORDOBA"],
];

const firstOption = (html: string, id: string) => {
  const select = html.match(new RegExp(`<select id="${id}"[\\s\\S]*?</select>`))?.[0] ?? "";
  return (select.match(/<option[^>]*selected[^>]*>([^<]+)</) ?? select.match(/<option[^>]*>([^<]+)</))?.[1]?.trim() ?? null;
};

/** Parses one slot page (exported for tests). */
export function parseSantaFe(html: string, slot: QuinielaDrawSlot): Reading[] {
  const month = firstOption(html, "form:mesSeleccionado_input")?.match(/^(\p{L}+)\s+(\d{4})$/u);
  const draw = firstOption(html, "form:sorteoSeleccionado_input")?.match(/(\d{1,2})\s*-\s*\d+/);
  if (!month || !draw || monthIndex(month[1]) < 1) throw new SourceError(`Santa Fe ${slot}: no encontré la fecha del sorteo.`);
  const date = iso(Number(month[2]), monthIndex(month[1]), Number(draw[1]));
  const out: Reading[] = [];
  for (const block of html.split(/<h3>/).slice(1)) {
    const title = block.slice(0, block.indexOf("</h3>")).toUpperCase();
    const lottery = LOTTERY.find(([re]) => re.test(title))?.[1];
    if (!lottery || lottery === "SKIP") continue;
    const numbers = [...block.matchAll(/class="numersorteo">\s*(\d+)\s*</g)].slice(0, 20).map((m) => m[1]);
    const reading: Reading = { date, slot, lottery, numbers };
    if (validReading(reading)) out.push(reading);
  }
  return out;
}

export const loteriaSantaFe: ResultSource = {
  key: "loteria-santafe",
  label: "Lotería de Santa Fe",
  url: "https://www.loteriasantafe.gov.ar/la-previa/",
  officialFor: ["SANTA_FE"],
  read: async ({ only }) => {
    const slots = (Object.keys(PAGES) as QuinielaDrawSlot[]).filter((s) => !only || only.some((o) => o.slot === s));
    const out: Reading[] = [];
    for (const [i, slot] of slots.entries()) {
      if (i) await sleep(3000); // a few seconds between pages
      out.push(...parseSantaFe(await fetchText(`${BASE}/${PAGES[slot]}?display=0`), slot));
    }
    return out;
  },
};
