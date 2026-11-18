// Quiniela results (spec: quiniela-results): what a source reader returns.
import type { QuinielaDrawSlot } from "@/generated/prisma/enums";

/** One draw as a source published it: 20 numbers in prize order, as text ("0031"). */
export type Reading = {
  date: string; // YYYY-MM-DD
  slot: QuinielaDrawSlot;
  lottery: string; // our lottery code (PROVINCIA, CIUDAD…)
  numbers: string[];
  letters?: string | null;
};

export type ResultSource = {
  key: string;
  label: string;
  url: string;
  /** Lotteries this source is the official publisher of. */
  officialFor: string[];
  /** Readings available now (the latest draws the site shows), or of a date when supported. */
  read: (opts: { date?: string; only?: { slot: QuinielaDrawSlot; lottery: string }[] }) => Promise<Reading[]>;
};

export class SourceError extends Error {}

/** A reading must have 20 numbers of the same number of digits (4, or 5 in extraordinary draws). */
export function validReading(r: Reading) {
  return r.numbers.length === 20 && r.numbers.every((n) => /^\d{3,5}$/.test(n)) && new Set(r.numbers.map((n) => n.length)).size === 1;
}
