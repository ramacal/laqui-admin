// notitimba.com: the 20 prizes of any draw by date, lottery and slot from
//   POST /lots/cfms/prmsEq.php?a=2026-11-17&b=1&c=2
// which answers "4" (digits) + 20 numbers of 6 characters + "|2026-11-17|LA PROVINCIA|2|EQTX".
// Its robots.txt asks for one request per minute (Crawl-delay: 60) between 02:00 and 07:45
// (Visit-time), and its terms allow the data for official agencies (not to republish it): the job
// runs at night, waits a minute between requests and only asks for draws not yet confirmed.
import type { QuinielaDrawSlot } from "@/generated/prisma/enums";
import { fetchText, sleep } from "@/lib/quiniela/results/http";
import { type Reading, type ResultSource, SourceError, validReading } from "@/lib/quiniela/results/types";

const URL_ = "https://notitimba.com/lots/cfms/prmsEq.php";
const LOTTERY_INDEX: Record<string, number> = { CIUDAD: 0, PROVINCIA: 1, SANTA_FE: 2, CORDOBA: 3, ENTRE_RIOS: 4, MONTEVIDEO: 5 };
const SLOT_INDEX: Record<QuinielaDrawSlot, number> = { PREVIA: 0, PRIMERA: 1, MATUTINA: 2, VESPERTINA: 3, NOCTURNA: 4 };
const CRAWL_DELAY_MS = 60_000;
const MAX_REQUESTS = 20; // per run: ~20 minutes

/** Parses one answer (exported for tests). Null when the draw has no result. */
export function parseNotitimba(body: string, expected: { date: string; slot: QuinielaDrawSlot; lottery: string }): Reading | null {
  const [digitsAndNumbers, date] = body.trim().split("|");
  if (!digitsAndNumbers || date !== expected.date) return null;
  const digits = Number(digitsAndNumbers[0]);
  const raw = digitsAndNumbers.slice(1);
  if (!(digits >= 3 && digits <= 5) || raw.length !== 120) return null;
  const numbers = Array.from({ length: 20 }, (_, i) => raw.slice(i * 6, i * 6 + 6).slice(-digits));
  const letters = body.split("|")[4]?.trim() || null;
  const reading: Reading = { ...expected, numbers, letters };
  return validReading(reading) ? reading : null;
}

export const notitimba: ResultSource = {
  key: "notitimba",
  label: "NotiTimba",
  url: "https://notitimba.com/lots/",
  officialFor: [],
  read: async ({ date, only }) => {
    if (!date || !only) throw new SourceError("NotiTimba se consulta por fecha y solo por los sorteos que faltan confirmar.");
    const out: Reading[] = [];
    for (const [i, draw] of only.filter((d) => d.lottery in LOTTERY_INDEX).slice(0, MAX_REQUESTS).entries()) {
      if (i) await sleep(CRAWL_DELAY_MS);
      const url = `${URL_}?a=${date}&b=${LOTTERY_INDEX[draw.lottery]}&c=${SLOT_INDEX[draw.slot]}`;
      const reading = parseNotitimba(await fetchText(url, { method: "POST" }), { date, ...draw });
      if (reading) out.push(reading);
    }
    return out;
  },
};
