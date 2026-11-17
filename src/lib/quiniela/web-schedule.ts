// Lotería de la Provincia's public page "Juegos Tradicionales": the month's draw schedule
// ("Horarios de sorteos del mes de …") and the link to the official monthly program PDF.
// Only used to find the PDF and to cross-check it; the PDF is the source of truth.
import type { QuinielaDrawSlot } from "@/generated/prisma/enums";

export const PBA_GAMES_URL = "https://loteria.gba.gob.ar/juegos-tradicionales";
const UA = "Mozilla/5.0 (compatible; LaquiBot/1.0)";

export type WebScheduleRow = {
  slot: QuinielaDrawSlot;
  montevideo: boolean;
  lotteries: string[]; // our codes
  weekdays: number[]; // 1 = Monday … 6 = Saturday
  time: string; // "10:15"
};
export type WebSchedule = { monthLabel: string | null; rows: WebScheduleRow[]; programPdfUrl: string | null };

const SLOT: Record<string, QuinielaDrawSlot> = {
  "la previa": "PREVIA",
  "el primero": "PRIMERA",
  matutina: "MATUTINA",
  vespertina: "VESPERTINA",
  nocturna: "NOCTURNA",
};
const LOTTERY: Record<string, string> = {
  provincia: "PROVINCIA",
  ciudad: "CIUDAD",
  córdoba: "CORDOBA",
  cordoba: "CORDOBA",
  "santa fe": "SANTA_FE",
  "entre ríos": "ENTRE_RIOS",
  "entre rios": "ENTRE_RIOS",
};
const DAY: Record<string, number> = { lunes: 1, martes: 2, miércoles: 3, miercoles: 3, jueves: 4, viernes: 5, sábados: 6, sabados: 6, sábado: 6, domingos: 0 };

const text = (html: string) =>
  html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/[ \t]+/g, " ")
    .trim();

function weekdays(label: string): number[] {
  const words = label.toLowerCase().replace(/\s+/g, " ").trim();
  const range = words.match(/^(\p{L}+) a (\p{L}+)$/u);
  if (range && DAY[range[1]] !== undefined && DAY[range[2]] !== undefined) {
    const out: number[] = [];
    for (let d = DAY[range[1]]; d <= DAY[range[2]]; d++) out.push(d);
    return out;
  }
  return words.split(/ y |, /).map((w) => DAY[w.trim()]).filter((d) => d !== undefined);
}

/** Parses the page HTML (exported for tests). */
export function parseGamesPage(html: string, baseUrl = PBA_GAMES_URL): WebSchedule {
  const monthLabel = html.match(/Horarios de sorteos del mes de\s*([^<]+)/i)?.[1].trim() ?? null;
  const link = html.match(/href="([^"]+)"[^>]*>\s*Programa Mensual de Quiniela/i)?.[1] ?? null;
  const start = html.indexOf("Horarios de sorteos del mes");
  const table = start >= 0 ? html.slice(start, html.indexOf("</table>", start)) : "";
  const rows: WebScheduleRow[] = [];
  for (const tr of table.match(/<tr[\s\S]*?<\/tr>/gi) ?? []) {
    const cells = (tr.match(/<td[\s\S]*?<\/td>/gi) ?? []).map(text);
    if (cells.length < 3) continue;
    const lines = cells[0].split("\n").map((l) => l.trim()).filter(Boolean);
    const name = lines.filter((l) => !l.includes(",") && !LOTTERY[l.toLowerCase()]).join(" ").toLowerCase();
    if (name.startsWith("juegos")) break; // the second table (other games) starts here
    const montevideo = name.includes("montevideo");
    const slotKey = Object.keys(SLOT).find((k) => name.includes(k));
    const time = cells[2].match(/(\d{1,2})[:.](\d{2})/);
    if (!slotKey || !time) continue;
    const lotteries = montevideo
      ? ["MONTEVIDEO"]
      : lines
          .join(",")
          .split(",")
          .map((l) => LOTTERY[l.trim().toLowerCase()])
          .filter(Boolean);
    rows.push({
      slot: SLOT[slotKey],
      montevideo,
      lotteries,
      weekdays: weekdays(cells[1].replace(/\n/g, " ")),
      time: `${time[1].padStart(2, "0")}:${time[2]}`,
    });
  }
  return { monthLabel, rows, programPdfUrl: link ? new URL(link, baseUrl).toString() : null };
}

export async function fetchGamesPage(): Promise<WebSchedule> {
  const res = await fetch(PBA_GAMES_URL, { headers: { "User-Agent": UA }, cache: "no-store" });
  if (!res.ok) throw new Error(`${PBA_GAMES_URL} respondió ${res.status}`);
  return parseGamesPage(await res.text());
}

/** Downloads a PDF; Google Drive "view" links are turned into direct downloads. */
export async function downloadPdf(url: string): Promise<Uint8Array> {
  const drive = url.match(/drive\.google\.com\/file\/d\/([\w-]+)/);
  const direct = drive ? `https://drive.google.com/uc?export=download&id=${drive[1]}` : url;
  const res = await fetch(direct, { headers: { "User-Agent": UA }, redirect: "follow", cache: "no-store" });
  if (!res.ok) throw new Error(`No se pudo bajar el programa (${res.status}).`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (String.fromCharCode(...bytes.slice(0, 5)) !== "%PDF-") throw new Error("El link del programa no devolvió un PDF.");
  if (bytes.length > 10 * 1024 * 1024) throw new Error("El PDF del programa pesa más de 10 MB.");
  return bytes;
}
