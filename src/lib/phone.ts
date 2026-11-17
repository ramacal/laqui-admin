// Argentine cellphones. Stored as WhatsApp uses them: "549" + area code (no 0) + number (no 15),
// digits only, e.g. "5491155550000". Input can be written any usual way: "011 15 5555-0000",
// "11 5555 0000", "+54 9 11 5555-0000", "2284 15 551234"... Area codes have 2 to 4 digits, so
// libphonenumber's Argentine numbering plan decides where the area code ends and drops the 15.
import { parsePhoneNumberWithError } from "libphonenumber-js/max";

export class PhoneError extends Error {}

/** "011 15 5555-0000" → "5491155550000". Throws PhoneError if it is not an Argentine cellphone. */
export function normalizeCellphone(raw: string): string {
  const input = raw.trim();
  if (!/\d/.test(input)) throw new PhoneError("Escribí el celular con código de área.");
  let national: string;
  try {
    national = parsePhoneNumberWithError(input, "AR").nationalNumber;
  } catch {
    throw new PhoneError("No se entiende el celular: escribilo con código de área (ej.: 11 5555-0000).");
  }
  national = national.replace(/^9(?=\d{10}$)/, ""); // "+54 9 …": the 9 marks a mobile
  if (national.length !== 10)
    throw new PhoneError("Al celular le falta o le sobra un número: código de área + número son 10 dígitos (ej.: 11 5555-0000).");
  const mobile = parsePhoneNumberWithError(`+549${national}`);
  if (!mobile.isValid()) throw new PhoneError("Ese celular no existe en Argentina: revisá el código de área.");
  return `549${national}`;
}

/** Same as normalizeCellphone, but an empty input is null (optional fields). */
export function optionalCellphone(raw: string | null | undefined): string | null {
  return raw && raw.trim() ? normalizeCellphone(raw) : null;
}

/** "5491155550000" → "+54 9 11 5555-0000" (readable, with the area code). */
export function formatCellphone(stored: string | null | undefined): string | null {
  if (!stored) return null;
  try {
    return parsePhoneNumberWithError(`+${stored}`).formatInternational();
  } catch {
    return `+${stored}`;
  }
}

/** DNI: 7 or 8 digits, dots and spaces allowed when typing. Empty → null. */
export function optionalDni(raw: string | null | undefined): string | null {
  const digits = (raw ?? "").replace(/[.\s-]/g, "");
  if (!digits) return null;
  if (!/^\d{7,8}$/.test(digits)) throw new PhoneError("El DNI tiene 7 u 8 números.");
  return digits;
}
