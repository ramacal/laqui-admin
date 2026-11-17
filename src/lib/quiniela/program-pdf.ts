// Reads Lotería de la Provincia's monthly Quiniela program ("PROGRAMA DE SORTEOS DEL MES DE …")
// by position: pdf.js gives every number with its coordinates, and the program is a fixed table
//   day | La Previa: n.º time lotteries | El Primero … | Matutina … | Montevideo Matutina … |
//   Vespertina … | Montevideo Nocturna … | Nocturna … | Caducidad
// Columns are found from the header labels, rows by their height on the page. The result is a
// draft for an admin to review; checks that fail are returned as warnings, never guessed away.
import path from "node:path";
import type { QuinielaDrawSlot } from "@/generated/prisma/enums";

export type DraftLottery = { code: string; drawNumber: number | null };
export type DraftDraw = { slot: QuinielaDrawSlot; time: string; lotteries: DraftLottery[] };
export type DraftDay = { date: string; prizeExpiry: string | null; draws: DraftDraw[] };
export type ProgramDraft = {
  year: number;
  month: number;
  days: DraftDay[];
  rules: { minBet: number | null; maxBetPerLottery: number | null };
  reference: string | null; // official document number (IF-…)
  warnings: string[];
};

const MONTHS = ["ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"];
const SLOT_LABEL: Record<string, QuinielaDrawSlot> = {
  "LA PREVIA": "PREVIA",
  "EL PRIMERO": "PRIMERA",
  MATUTINA: "MATUTINA",
  VESPERTINA: "VESPERTINA",
  NOCTURNA: "NOCTURNA",
};
// Legend abbreviations → our lottery codes ("1-(P)Lotería de la Provincia … 2-(LC)Lotería de la Ciudad …").
const LEGEND_CODE: Record<string, string> = { P: "PROVINCIA", LC: "CIUDAD", CBA: "CORDOBA", SF: "SANTA_FE", "E.RIOS": "ENTRE_RIOS" };
const DEFAULT_LEGEND: Record<string, string> = { "1": "PROVINCIA", "2": "CIUDAD", "3": "CORDOBA", "4": "SANTA_FE", "5": "ENTRE_RIOS" };

type Item = { s: string; x: number; y: number; w: number };
type Column = { slot: QuinielaDrawSlot; montevideo: boolean; x: number };

async function pageItems(pdf: Uint8Array): Promise<Item[]> {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  // Text extraction only; fonts are not needed but pdf.js warns without them (expects a "/" ending).
  const standardFontDataUrl = path.join(process.cwd(), "node_modules", "pdfjs-dist", "standard_fonts").split(path.sep).join("/") + "/";
  // A copy: pdf.js takes ownership of (detaches) the buffer it reads.
  const doc = await getDocument({ data: pdf.slice(), standardFontDataUrl }).promise;
  if (doc.numPages !== 1) throw new Error(`Se esperaba un programa de 1 página y tiene ${doc.numPages}.`);
  const page = await doc.getPage(1);
  const { height } = page.getViewport({ scale: 1 });
  const content = await page.getTextContent();
  const items: Item[] = [];
  for (const it of content.items) {
    if (!("str" in it) || !it.str.trim()) continue;
    items.push({ s: it.str.trim(), x: it.transform[4], y: height - it.transform[5], w: it.width });
  }
  await doc.destroy();
  return items;
}

const pad = (n: number) => String(n).padStart(2, "0");
const normTime = (t: string) => {
  const [h, m] = t.replace(".", ":").split(":");
  return `${pad(Number(h))}:${m}`;
};

export async function parseProgramPdf(pdf: Uint8Array): Promise<ProgramDraft> {
  const items = await pageItems(pdf);
  const warnings: string[] = [];
  const text = items.map((i) => i.s).join(" ");

  // Month and year from the title.
  const title = text.match(/PROGRAMA DE SORTEOS DEL MES DE\s+([A-ZÁÉÍÓÚ]+)\s+DE\s+(\d{4})/i);
  if (!title) throw new Error("No encontré el título «PROGRAMA DE SORTEOS DEL MES DE …»: ¿es el programa de Quiniela?");
  const month = MONTHS.indexOf(title[1].toUpperCase()) + 1;
  const year = Number(title[2]);
  if (month < 1) throw new Error(`Mes desconocido en el título: ${title[1]}`);

  // Columns: the draw labels of the header; a "MONTEVIDEO" label just above marks Montevideo's.
  const center = (i: Item) => i.x + i.w / 2;
  const labels = items.filter((i) => SLOT_LABEL[i.s.toUpperCase()]);
  const mvd = items.filter((i) => i.s.toUpperCase() === "MONTEVIDEO");
  const columns: Column[] = labels
    .map((l) => ({
      slot: SLOT_LABEL[l.s.toUpperCase()],
      montevideo: mvd.some((m) => Math.abs(center(m) - center(l)) < 40 && m.y < l.y && l.y - m.y < 25),
      x: center(l),
    }))
    .sort((a, b) => a.x - b.x);
  if (columns.filter((c) => !c.montevideo).length < 5) throw new Error("No encontré las 5 columnas de sorteos en el encabezado.");
  const headerBottom = Math.max(...labels.map((l) => l.y));
  const firstColumnX = Math.min(...items.filter((i) => /^\d{4,6}$/.test(i.s)).map((i) => i.x));

  // Legend: "1-(P)Lotería de la Provincia …".
  const legend: Record<string, string> = {};
  for (const m of text.matchAll(/(\d)\s*-\s*\((P|LC|CBA|SF|E\.\s?RIOS)\)/g)) legend[m[1]] = LEGEND_CODE[m[2].replace(/\s/g, "")];
  if (Object.keys(legend).length === 0) warnings.push("No encontré la referencia de loterías: uso 1 Provincia, 2 Ciudad, 3 Córdoba, 4 Santa Fe, 5 Entre Ríos.");
  const lotteryOf = { ...DEFAULT_LEGEND, ...legend };
  for (const [k, v] of Object.entries(legend))
    if (DEFAULT_LEGEND[k] !== v) warnings.push(`La referencia ${k} ahora es ${v} (antes ${DEFAULT_LEGEND[k]}).`);

  // Data rows: below the header, above the footer ("ARTICULO 24°…").
  const footerY = Math.min(...items.filter((i) => /^ARTICULO|^EN CASO|^\*/.test(i.s)).map((i) => i.y), Infinity);
  const body = items.filter((i) => i.y > headerBottom + 5 && i.y < footerY - 2 && i.s.length < 15).sort((a, b) => a.y - b.y || a.x - b.x);
  const rows: Item[][] = [];
  for (const it of body) {
    const last = rows[rows.length - 1];
    if (last && Math.abs(last[0].y - it.y) <= 4) last.push(it);
    else rows.push([it]);
  }

  const days: DraftDay[] = [];
  for (const row of rows) {
    row.sort((a, b) => a.x - b.x);
    const dayItem = row.find((i) => /^\d{1,2}$/.test(i.s) && i.x < firstColumnX - 5);
    const groups: { number: Item; time: Item; lots: Item[] }[] = [];
    let prizeExpiry: string | null = null;
    for (let i = 0; i < row.length; i++) {
      const it = row[i];
      if (it === dayItem) continue;
      const date = it.s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      if (date) prizeExpiry = `${date[3]}-${date[2]}-${date[1]}`;
      else if (/^\d{4,6}$/.test(it.s) && /^\d{1,2}[:.]\d{2}$/.test(row[i + 1]?.s ?? "")) {
        groups.push({ number: it, time: row[i + 1], lots: [] });
        i++;
      } else if (/^[1-9]$/.test(it.s) && groups.length) groups[groups.length - 1].lots.push(it);
    }
    if (!groups.length) continue;
    if (!dayItem) {
      warnings.push(`Fila sin número de día (sorteo n.º ${groups[0].number.s}): la salteé.`);
      continue;
    }
    const day = Number(dayItem.s);
    const date = `${year}-${pad(month)}-${pad(day)}`;
    const draws = new Map<QuinielaDrawSlot, DraftDraw>();
    for (const g of groups) {
      const span = [g.number, ...g.lots];
      const mid = (Math.min(...span.map((s) => s.x)) + Math.max(...span.map((s) => s.x + s.w))) / 2;
      const col = columns.reduce((best, c) => (Math.abs(c.x - mid) < Math.abs(best.x - mid) ? c : best));
      if (Math.abs(col.x - mid) > 90) {
        warnings.push(`${date}: el sorteo n.º ${g.number.s} no cae en ninguna columna.`);
        continue;
      }
      const time = normTime(g.time.s);
      const lotteries: DraftLottery[] = col.montevideo
        ? [{ code: "MONTEVIDEO", drawNumber: Number(g.number.s) }]
        : g.lots.map((l) => ({ code: lotteryOf[l.s], drawNumber: Number(g.number.s) })).filter((l) => l.code);
      if (!lotteries.length) warnings.push(`${date}: el sorteo n.º ${g.number.s} no tiene loterías.`);
      const draw = draws.get(col.slot);
      if (!draw) draws.set(col.slot, { slot: col.slot, time, lotteries });
      else {
        if (draw.time !== time) warnings.push(`${date} ${col.slot}: Montevideo a las ${time} y el resto a las ${draw.time}.`);
        draw.lotteries.push(...lotteries);
      }
    }
    days.push({ date, prizeExpiry, draws: [...draws.values()] });
  }

  // Checks.
  const seen = new Set<string>();
  for (const d of days) {
    if (seen.has(d.date)) warnings.push(`El día ${d.date} aparece dos veces.`);
    seen.add(d.date);
    const wd = new Date(`${d.date}T12:00:00Z`).getUTCDay();
    if (wd === 0) warnings.push(`${d.date} es domingo y tiene sorteos.`);
  }
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  for (let day = 1; day <= daysInMonth; day++) {
    const date = `${year}-${pad(month)}-${pad(day)}`;
    if (new Date(`${date}T12:00:00Z`).getUTCDay() !== 0 && !seen.has(date)) warnings.push(`${date} (lunes a sábado) no tiene sorteos en el programa.`);
  }
  // Draw numbers run one by one along the month, per lottery and slot.
  const last = new Map<string, number>();
  for (const d of [...days].sort((a, b) => a.date.localeCompare(b.date)))
    for (const dr of d.draws)
      for (const l of dr.lotteries) {
        if (l.drawNumber === null) continue;
        const key = `${dr.slot}/${l.code}`;
        const prev = last.get(key);
        if (prev !== undefined && l.drawNumber !== prev + 1) warnings.push(`${d.date} ${dr.slot} ${l.code}: sorteo n.º ${l.drawNumber}, se esperaba ${prev + 1}.`);
        last.set(key, l.drawNumber);
      }

  const minBet = text.match(/Valor m[ií]nimo de la apuesta:\s*\$\s*([\d.]+),?\d*/i);
  const maxBet = text.match(/Valor m[aá]ximo:\s*\$\s*([\d.]+)/i);
  // The official document number may be a footer or an annotation outside the text layer.
  const reference = text.replace(/\s+/g, "").match(/IF-\d{4}-\d+-GDEBA-[A-Z]+/)?.[0] ?? null;
  return {
    year,
    month,
    days: days.sort((a, b) => a.date.localeCompare(b.date)),
    rules: {
      minBet: minBet ? Number(minBet[1].replace(/\./g, "")) : null,
      maxBetPerLottery: maxBet ? Number(maxBet[1].replace(/\./g, "")) : null,
    },
    reference,
    warnings,
  };
}
