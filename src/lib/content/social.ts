/** "@la.brujita", "instagram.com/la.brujita/" or "la.brujita" → "la.brujita"; null if invalid. */
export function normalizeHandle(raw: string) {
  const s = raw.trim().replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/^@/, "").replace(/[/?#].*$/, "");
  return /^[A-Za-z0-9._]{1,30}$/.test(s) ? s.toLowerCase() : null;
}
