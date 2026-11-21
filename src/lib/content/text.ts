// Texts for posts: labels, dates, suggested caption and the prompt for the user's own AI chat.
// Pure (no database): safe to import from client components.
import type { IdeaNumber } from "./numbers";

export type PresentedIdeaText = {
  headline: string;
  summary: string | null;
  date: string;
  numbers: IdeaNumber[];
  captionTemplate: string | null;
};

const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

export const TOPIC_LABEL = {
  PATRIA: "Fechas patrias",
  PROCERES: "Próceres",
  FUTBOL: "Fútbol",
  DEPORTES: "Deportes",
  FARANDULA: "Farándula",
  MUSICA: "Música",
  STREAMING: "Streamers",
  CULTURA: "Cultura",
} as const;

export const KIND_LABEL = {
  PATRIOTIC_DATE: "Fecha patria",
  BIRTH: "Natalicio",
  DEATH: "Aniversario de muerte",
  COMMEMORATION: "Conmemoración",
  EVENT: "Evento",
} as const;

export const longDate = (date: string) => {
  const [, m, d] = date.split("-").map(Number);
  return `${d} de ${MONTHS[m - 1]}`;
};

export type AgencyText = { name: string; city: string | null; instagram: string | null };

const numberLine = (numbers: IdeaNumber[]) =>
  numbers
    .slice(0, 6)
    .map((n) => (n.meaning ? `${n.value} (${n.meaning})` : n.value))
    .join(" · ");

/** Suggested caption; the user edits it on screen. */
export function suggestedCaption(idea: PresentedIdeaText, agency: AgencyText) {
  if (idea.captionTemplate) return idea.captionTemplate.replaceAll("{agency}", agency.name);
  return [
    `${idea.headline}.`,
    idea.summary,
    "",
    `🎯 Números para jugar hoy: ${numberLine(idea.numbers)}`,
    "",
    `Te esperamos en ${agency.name}${agency.city ? `, ${agency.city}` : ""}.`,
    "Jugá con responsabilidad. Prohibida la venta a menores de 18 años.",
  ]
    .filter((l) => l !== null && l !== undefined)
    .join("\n");
}

/** Prompt for the user's own AI chat. */
export function aiPrompt(idea: PresentedIdeaText, agency: AgencyText, caption: string) {
  return [
    `Soy una agencia de lotería y quiniela de Argentina (${agency.name}${agency.city ? `, ${agency.city}` : ""}${agency.instagram ? `, Instagram @${agency.instagram}` : ""}).`,
    `Quiero un texto para un posteo de Instagram del ${longDate(idea.date)} sobre: ${idea.headline}.`,
    idea.summary ? `Contexto: ${idea.summary}` : null,
    `Números para jugar asociados: ${idea.numbers
      .map((n) => `${n.value} (${n.reason}${n.meaning ? `, en la quiniela "${n.meaning}"` : ""})`)
      .join("; ")}.`,
    "Tono cercano y respetuoso, español rioplatense, 2 o 3 párrafos cortos, algunos emojis y 5 hashtags.",
    "Tiene que cerrar con: \"Jugá con responsabilidad. Prohibida la venta a menores de 18 años.\"",
    "",
    "Este es mi borrador:",
    caption,
  ]
    .filter((l) => l !== null)
    .join("\n");
}
