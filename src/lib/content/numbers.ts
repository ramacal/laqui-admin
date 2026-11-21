// Numbers to play for an idea in a given year (spec social-content "Numbers to Play").
// Pure: the idea is stored once and its numbers are derived for every year.

export type IdeaNumber = {
  value: string; // with leading zeros: "06", "2406"
  reason: string;
  meaning?: string; // traditional meaning, only for 2 digits and usable ones
};

type IdeaLike = {
  kind: "PATRIOTIC_DATE" | "BIRTH" | "DEATH" | "COMMEMORATION" | "EVENT";
  day: number;
  month: number;
  year: number | null;
  numbers: { value: number; reason: string }[];
};

const pad = (n: number, digits: number) => String(n).padStart(digits, "0");

/** Years elapsed in `viewYear`, or null when the idea has no origin year (or it is in the future). */
export function yearsElapsed(idea: Pick<IdeaLike, "year">, viewYear: number) {
  if (!idea.year) return null;
  const years = viewYear - idea.year;
  return years > 0 ? years : null;
}

export function ideaNumbers(idea: IdeaLike, viewYear: number, meanings: Map<number, string> = new Map()): IdeaNumber[] {
  const years = yearsElapsed(idea, viewYear);
  const list: IdeaNumber[] = [];
  const add = (value: string, reason: string) => {
    if (list.some((n) => n.value === value)) return;
    list.push({ value, reason, meaning: value.length === 2 ? meanings.get(Number(value)) : undefined });
  };

  if (years) {
    const label = idea.kind === "BIRTH" ? `cumple ${years}` : `${years} años`;
    add(pad(years % 100, 2), label);
    if (years >= 100) add(pad(years % 1000, 3), label);
  }
  for (const n of idea.numbers) add(pad(n.value, n.value < 100 ? 2 : String(n.value).length), n.reason);
  add(pad(idea.day, 2), "día");
  add(pad(idea.month, 2), "mes");
  add(`${pad(idea.day, 2)}${pad(idea.month, 2)}`, "fecha");
  if (idea.year) {
    add(pad(idea.year % 1000, 3), `año ${idea.year}`);
    add(String(idea.year), "año");
  }
  return list;
}

/** The number the picture shows big: years elapsed, else the first fixed number, else the day. */
export function mainNumber(numbers: IdeaNumber[]) {
  return numbers.find((n) => n.value.length === 2) ?? numbers[0];
}
