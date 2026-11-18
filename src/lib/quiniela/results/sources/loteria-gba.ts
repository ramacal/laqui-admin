// Lotería de la Provincia (official for La Provincia): loteria.gba.gob.ar/resultados shows the
// day's five Quiniela draws, each with its date, draw number and 20 prizes ("----" until drawn).
//   <div class="sorteo"><h3>Quiniela Matutina…</h3> <p class="fechaSorteo">18/11/2026</p>
//   <p class="nSorteo">Sorteo N°9054</p> <div class="bolillas"> <span>01</span> <span>5964</span> …
import type { QuinielaDrawSlot } from "@/generated/prisma/enums";
import { fetchText } from "@/lib/quiniela/results/http";
import { type Reading, type ResultSource, validReading } from "@/lib/quiniela/results/types";

const URL_ = "https://loteria.gba.gob.ar/resultados";
const SLOT: Record<string, QuinielaDrawSlot> = {
  "la previa": "PREVIA",
  "el primero": "PRIMERA",
  matutina: "MATUTINA",
  vespertina: "VESPERTINA",
  nocturna: "NOCTURNA",
};

/** Parses the results page (exported for tests). */
export function parseGba(html: string): Reading[] {
  const out: Reading[] = [];
  for (const block of html.split(/<div class="sorteo">/).slice(1)) {
    const title = block.match(/<h3>\s*Quiniela\s+([^<]+?)\s*</i)?.[1]?.toLowerCase().trim();
    const slot = title ? SLOT[title] : undefined;
    const date = block.match(/class="fechaSorteo">\s*(\d{2})\/(\d{2})\/(\d{4})/);
    if (!slot || !date) continue;
    // Each block runs to the next draw; the last one also holds the rest of the page, so take
    // only its first 20 prizes.
    const numbers = [...block.matchAll(/<span>(\d{2})<\/span>\s*<span>([\d-]+)<\/span>/g)].slice(0, 20).map((m) => m[2]);
    const reading: Reading = { date: `${date[3]}-${date[2]}-${date[1]}`, slot, lottery: "PROVINCIA", numbers };
    if (validReading(reading)) out.push(reading);
  }
  return out;
}

export const loteriaGba: ResultSource = {
  key: "loteria-gba",
  label: "Lotería de la Provincia",
  url: URL_,
  officialFor: ["PROVINCIA"],
  read: async () => parseGba(await fetchText(URL_)),
};
