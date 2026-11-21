// One naming rule for every folder and file Laqui creates (storage bucket and Google Drive):
// lowercase, no accents or ñ, words joined by "-", only a-z 0-9. Example: "Vía Fortuna" -> "via-fortuna".

/** "Vuelta de Obligado (historia)" -> "vuelta-de-obligado-historia". Empty input gives "". */
export function slug(text: string, maxLength = 80) {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, maxLength)
    .replace(/^-+|-+$/g, "");
}

/** File name from its parts and extension: fileName(["2026-11-20", "Vuelta de Obligado", "historia"], "PNG") -> "2026-11-20-vuelta-de-obligado-historia.png". */
export function fileName(parts: (string | null | undefined)[], ext: string) {
  const base = parts.map((p) => (p ? slug(p) : "")).filter(Boolean).join("-") || "archivo";
  return `${base.slice(0, 120).replace(/-+$/, "")}.${slug(ext)}`;
}

const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

/** Month folder: 11 -> "11-noviembre" (sorts in calendar order). */
export const monthName = (month: number) => `${String(month).padStart(2, "0")}-${MONTHS[month - 1]}`;
