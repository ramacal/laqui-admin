// Downloads for the result readers: identified, with a timeout, decoding the page's charset.
import { SourceError } from "@/lib/quiniela/results/types";

const UA = "Mozilla/5.0 (compatible; LaquiBot/1.0; resultados de quiniela para agencias)";

export async function fetchText(url: string, init: RequestInit = {}, timeoutMs = 30_000) {
  const res = await fetch(url, {
    ...init,
    headers: { "User-Agent": UA, "Accept-Language": "es-AR,es", ...(init.headers ?? {}) },
    cache: "no-store",
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new SourceError(`${new URL(url).host} respondió ${res.status}`);
  const charset = res.headers.get("content-type")?.match(/charset=([\w-]+)/i)?.[1] ?? "utf-8";
  const bytes = new Uint8Array(await res.arrayBuffer());
  try {
    return new TextDecoder(charset).decode(bytes);
  } catch {
    return new TextDecoder("utf-8").decode(bytes);
  }
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Plain text of an HTML fragment. */
export const text = (html: string) =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&aacute;/g, "á")
    .replace(/&eacute;/g, "é")
    .replace(/&iacute;/g, "í")
    .replace(/&oacute;/g, "ó")
    .replace(/&uacute;/g, "ú")
    .replace(/\s+/g, " ")
    .trim();

const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
export const monthIndex = (name: string) => MONTHS.indexOf(name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")) + 1;
export const iso = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
