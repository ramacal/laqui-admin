// Ideas for an agency's posts (spec social-content): which ideas fall on which dates,
// their headline and caption, and a prompt to paste into the user's own AI chat.
// Laqui never calls an AI service.
import { prisma } from "@/lib/prisma";
import { ideaNumbers, mainNumber, yearsElapsed } from "./numbers";
export * from "./text";

export type IsoDate = string; // YYYY-MM-DD

/** Today in the agency's timezone. */
export function todayIn(timezone: string): IsoDate {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export function addDays(date: IsoDate, days: number): IsoDate {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export const isIsoDate = (s: unknown): s is IsoDate => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);

async function usableMeanings() {
  const rows = await prisma.quinielaNumberMeaning.findMany({ where: { usable: true } });
  return new Map(rows.map((r) => [r.number, r.meaning]));
}

const ideaInclude = { numbers: { select: { value: true, reason: true } } } as const;

type IdeaRow = NonNullable<Awaited<ReturnType<typeof findIdea>>>;
const findIdea = (id: string) => prisma.contentIdea.findUnique({ where: { id }, include: ideaInclude });

/** Upcoming ideas for an agency: active, in its country or province, from `from` for `days` days. */
export async function upcomingIdeas(agency: { provinceId: string }, from: IsoDate, days: number) {
  const dates = Array.from({ length: days }, (_, i) => addDays(from, i));
  const monthDays = dates.map((d) => ({ month: Number(d.slice(5, 7)), day: Number(d.slice(8, 10)) }));
  const [ideas, meanings, deadTitles] = await Promise.all([
    prisma.contentIdea.findMany({
      where: {
        active: true,
        OR: [{ provinceId: null }, { provinceId: agency.provinceId }],
        AND: [{ OR: monthDays }],
      },
      include: ideaInclude,
      orderBy: { popularity: "desc" },
    }),
    usableMeanings(),
    deceased(),
  ]);
  return dates.map((date) => ({
    date,
    ideas: ideas
      .filter((i) => i.month === Number(date.slice(5, 7)) && i.day === Number(date.slice(8, 10)))
      .map((idea) => present(idea, date, meanings, deadTitles)),
  }));
}

/** One idea on one date, with its texts, or null when it does not belong to the agency's area. */
export async function ideaForAgency(ideaId: string, agency: { provinceId: string }, date: IsoDate) {
  const idea = await findIdea(ideaId);
  if (!idea || (idea.provinceId && idea.provinceId !== agency.provinceId)) return null;
  const [meanings, deadTitles] = await Promise.all([usableMeanings(), deceased()]);
  return present(idea, date, meanings, deadTitles);
}

// People with a death idea, so their birthday says "cumpliría".
async function deceased() {
  const rows = await prisma.contentIdea.findMany({ where: { kind: "DEATH" }, select: { title: true } });
  return new Set(rows.map((r) => r.title));
}

export type PresentedIdea = ReturnType<typeof present>;

function present(idea: IdeaRow, date: IsoDate, meanings: Map<number, string>, deadTitles: Set<string>) {
  const year = Number(date.slice(0, 4));
  const numbers = ideaNumbers(idea, year, meanings);
  const years = yearsElapsed(idea, year);
  const fill = (t: string) => t.replaceAll("{years}", String(years ?? "")).replaceAll("{year}", String(idea.year ?? ""));
  const headline = fill(idea.headline ?? defaultHeadline(idea, years, deadTitles.has(idea.title)));
  return {
    id: idea.id,
    kind: idea.kind,
    topic: idea.topic,
    title: idea.title,
    summary: idea.summary,
    year: idea.year,
    years,
    date,
    headline,
    numbers,
    main: mainNumber(numbers),
    captionTemplate: idea.caption ? fill(idea.caption) : null,
  };
}

function defaultHeadline(idea: IdeaRow, years: number | null, dead: boolean) {
  switch (idea.kind) {
    case "BIRTH":
      if (!years) return `Natalicio de ${idea.title}`;
      if (idea.topic === "PROCERES") return `${years} años del natalicio de ${idea.title}`;
      return dead ? `Hoy ${idea.title} cumpliría ${years} años` : `¡Hoy ${idea.title} cumple ${years} años!`;
    case "DEATH":
      if (!years) return `Recordamos a ${idea.title}`;
      return idea.topic === "PROCERES"
        ? `${years} años del paso a la inmortalidad de ${idea.title}`
        : `Se cumplen ${years} años sin ${idea.title}`;
    default:
      return years ? `${idea.title}: ${years} años` : idea.title;
  }
}

