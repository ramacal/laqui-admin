// Reference data for social content (spec social-content). Public facts, safe to commit.
//
// Meanings: the traditional "quiniela de los sueños" list. Lists vary between sources;
// review before going live. usable = false keeps offensive meanings off every post.
// Ideas: patriotic dates and próceres repeat every year. Party politics is left out on purpose.

type Kind = "PATRIOTIC_DATE" | "BIRTH" | "DEATH" | "COMMEMORATION" | "EVENT";
type Topic = "PATRIA" | "PROCERES" | "FUTBOL" | "DEPORTES" | "FARANDULA" | "MUSICA" | "STREAMING" | "CULTURA";

export type SeedIdea = {
  key: string;
  kind: Kind;
  topic: Topic;
  title: string;
  day: number;
  month: number;
  year?: number;
  province?: string; // province code; none = whole country
  summary?: string;
  headline?: string;
  popularity: number;
  numbers?: { value: number; reason: string }[];
};

const NOT_USABLE = new Set([55, 57, 74, 78]);

const MEANINGS = [
  "los huevos", "el agua", "el niño", "San Cono", "la cama", "el gato", "el perro", "el revólver", "el incendio", "el arroyo",
  "la leche", "el palito", "el soldado", "la yeta", "el borracho", "la niña bonita", "el anillo", "la desgracia", "la sangre", "el pescado",
  "la fiesta", "la mujer", "el loco", "el cocinero", "el caballo", "la gallina", "la misa", "el peine", "los cerros", "San Pedro",
  "Santa Rosa", "la luz", "el dinero", "Cristo", "la cabeza", "el pajarito", "la manteca", "el dentista", "las piedras", "la lluvia",
  "el cura", "el cuchillo", "las zapatillas", "el balcón", "la cárcel", "el vino", "los tomates", "el muerto", "el muerto que habla", "la carne",
  "el pan", "el serrucho", "madre e hijo", "el barco", "la vaca", "los gallegos", "la caída", "el jorobado", "el ahogado", "las plantas",
  "la Virgen", "la escopeta", "la inundación", "el casamiento", "el llanto", "el cazador", "las lombrices", "la víbora", "los sobrinos", "los vicios",
  "el muerto sueño", "los excrementos", "la sorpresa", "el hospital", "los negros", "los besos", "las llamas", "las piernas", "la ramera", "el ladrón",
  "la bocha", "las flores", "la pelea", "el mal tiempo", "la iglesia", "la linterna", "el humo", "los piojos", "el Papa", "la rata",
  "el miedo", "el excusado", "el médico", "el enamorado", "el cementerio", "los anteojos", "el marido", "la mesa", "la lavandera", "los hermanos",
];

export const NUMBER_MEANINGS = MEANINGS.map((meaning, number) => ({
  number,
  meaning,
  usable: !NOT_USABLE.has(number),
}));

export const CONTENT_IDEAS: SeedIdea[] = [
  // ─── Fechas patrias y conmemoraciones ───
  { key: "san-lorenzo", kind: "PATRIOTIC_DATE", topic: "PATRIA", title: "Combate de San Lorenzo", day: 3, month: 2, year: 1813, popularity: 40, summary: "Primera batalla del Regimiento de Granaderos a Caballo de San Martín." },
  { key: "memoria", kind: "COMMEMORATION", topic: "PATRIA", title: "Día Nacional de la Memoria por la Verdad y la Justicia", day: 24, month: 3, year: 1976, popularity: 60 },
  { key: "malvinas", kind: "COMMEMORATION", topic: "PATRIA", title: "Día del Veterano y de los Caídos en la Guerra de Malvinas", day: 2, month: 4, year: 1982, popularity: 90, headline: "{years} años de Malvinas. Gloria a nuestros héroes" },
  { key: "trabajador", kind: "COMMEMORATION", topic: "PATRIA", title: "Día del Trabajador", day: 1, month: 5, popularity: 50 },
  { key: "escarapela", kind: "COMMEMORATION", topic: "PATRIA", title: "Día de la Escarapela", day: 18, month: 5, year: 1812, popularity: 40 },
  { key: "revolucion-mayo", kind: "PATRIOTIC_DATE", topic: "PATRIA", title: "Revolución de Mayo", day: 25, month: 5, year: 1810, popularity: 100, headline: "{years} años de la Revolución de Mayo", summary: "Primer Gobierno Patrio." },
  { key: "periodista", kind: "COMMEMORATION", topic: "CULTURA", title: "Día del Periodista", day: 7, month: 6, year: 1810, popularity: 20, summary: "Primer número de La Gazeta de Buenos Ayres, fundada por Mariano Moreno." },
  { key: "derechos-malvinas", kind: "COMMEMORATION", topic: "PATRIA", title: "Día de la Afirmación de los Derechos Argentinos sobre Malvinas", day: 10, month: 6, year: 1829, popularity: 30 },
  { key: "bandera", kind: "PATRIOTIC_DATE", topic: "PATRIA", title: "Día de la Bandera", day: 20, month: 6, year: 1820, popularity: 90, summary: "Paso a la Inmortalidad de Manuel Belgrano, creador de la bandera." },
  { key: "independencia", kind: "PATRIOTIC_DATE", topic: "PATRIA", title: "Día de la Independencia", day: 9, month: 7, year: 1816, popularity: 100, headline: "{years} años de la Independencia", summary: "Congreso de Tucumán." },
  { key: "amigo", kind: "COMMEMORATION", topic: "CULTURA", title: "Día del Amigo", day: 20, month: 7, popularity: 80, numbers: [{ value: 20, reason: "día del amigo" }] },
  { key: "folklore", kind: "COMMEMORATION", topic: "MUSICA", title: "Día del Folklore", day: 22, month: 8, popularity: 30 },
  { key: "maestro", kind: "COMMEMORATION", topic: "PATRIA", title: "Día del Maestro", day: 11, month: 9, year: 1888, popularity: 60, summary: "Paso a la Inmortalidad de Domingo Faustino Sarmiento." },
  { key: "primavera", kind: "COMMEMORATION", topic: "CULTURA", title: "Día de la Primavera y del Estudiante", day: 21, month: 9, popularity: 70 },
  { key: "diversidad-cultural", kind: "COMMEMORATION", topic: "PATRIA", title: "Día del Respeto a la Diversidad Cultural", day: 12, month: 10, year: 1492, popularity: 30 },
  { key: "tradicion", kind: "COMMEMORATION", topic: "CULTURA", title: "Día de la Tradición", day: 10, month: 11, year: 1834, popularity: 50, summary: "Natalicio de José Hernández, autor del Martín Fierro." },
  { key: "soberania", kind: "PATRIOTIC_DATE", topic: "PATRIA", title: "Día de la Soberanía Nacional", day: 20, month: 11, year: 1845, popularity: 70, headline: "{years} años de la Vuelta de Obligado", summary: "Combate de la Vuelta de Obligado en el río Paraná contra la flota anglo-francesa." },
  { key: "democracia", kind: "COMMEMORATION", topic: "PATRIA", title: "Día de la Restauración de la Democracia", day: 10, month: 12, year: 1983, popularity: 40 },
  { key: "navidad", kind: "EVENT", topic: "CULTURA", title: "Navidad", day: 25, month: 12, popularity: 90, numbers: [{ value: 25, reason: "día" }] },
  { key: "anio-nuevo", kind: "EVENT", topic: "CULTURA", title: "Año Nuevo", day: 1, month: 1, popularity: 90 },

  // ─── Próceres: natalicio y paso a la inmortalidad ───
  { key: "san-martin-nace", kind: "BIRTH", topic: "PROCERES", title: "José de San Martín", day: 25, month: 2, year: 1778, popularity: 70 },
  { key: "san-martin-muere", kind: "DEATH", topic: "PROCERES", title: "José de San Martín", day: 17, month: 8, year: 1850, popularity: 90, summary: "Libertador de Argentina, Chile y Perú." },
  { key: "belgrano-nace", kind: "BIRTH", topic: "PROCERES", title: "Manuel Belgrano", day: 3, month: 6, year: 1770, popularity: 60 },
  { key: "sarmiento-nace", kind: "BIRTH", topic: "PROCERES", title: "Domingo Faustino Sarmiento", day: 15, month: 2, year: 1811, popularity: 40 },
  { key: "guemes-nace", kind: "BIRTH", topic: "PROCERES", title: "Martín Miguel de Güemes", day: 8, month: 2, year: 1785, popularity: 30 },
  { key: "guemes-muere", kind: "DEATH", topic: "PROCERES", title: "Martín Miguel de Güemes", day: 17, month: 6, year: 1821, popularity: 50 },
  { key: "moreno-nace", kind: "BIRTH", topic: "PROCERES", title: "Mariano Moreno", day: 23, month: 9, year: 1778, popularity: 20 },
  { key: "moreno-muere", kind: "DEATH", topic: "PROCERES", title: "Mariano Moreno", day: 4, month: 3, year: 1811, popularity: 20 },
  { key: "brown-nace", kind: "BIRTH", topic: "PROCERES", title: "Guillermo Brown", day: 22, month: 6, year: 1777, popularity: 20 },
  { key: "brown-muere", kind: "DEATH", topic: "PROCERES", title: "Guillermo Brown", day: 3, month: 3, year: 1857, popularity: 20 },
  { key: "azurduy-nace", kind: "BIRTH", topic: "PROCERES", title: "Juana Azurduy", day: 12, month: 7, year: 1780, popularity: 30 },
  { key: "azurduy-muere", kind: "DEATH", topic: "PROCERES", title: "Juana Azurduy", day: 25, month: 5, year: 1862, popularity: 20 },
  { key: "alberdi-nace", kind: "BIRTH", topic: "PROCERES", title: "Juan Bautista Alberdi", day: 29, month: 8, year: 1810, popularity: 20 },
  { key: "hernandez-muere", kind: "DEATH", topic: "CULTURA", title: "José Hernández", day: 21, month: 10, year: 1886, popularity: 20 },

  // ─── Provincia de Buenos Aires ───
  { key: "la-plata", kind: "EVENT", topic: "PATRIA", title: "Fundación de La Plata", day: 19, month: 11, year: 1882, province: "B", popularity: 60, headline: "La Plata cumple {years} años", summary: "Capital de la provincia de Buenos Aires." },

  // ─── Fútbol ───
  { key: "messi-nace", kind: "BIRTH", topic: "FUTBOL", title: "Lionel Messi", day: 24, month: 6, year: 1987, popularity: 100, numbers: [{ value: 10, reason: "camiseta" }] },
  { key: "maradona-nace", kind: "BIRTH", topic: "FUTBOL", title: "Diego Armando Maradona", day: 30, month: 10, year: 1960, popularity: 90, numbers: [{ value: 10, reason: "camiseta" }] },
  { key: "maradona-muere", kind: "DEATH", topic: "FUTBOL", title: "Diego Armando Maradona", day: 25, month: 11, year: 2020, popularity: 90, numbers: [{ value: 10, reason: "camiseta" }] },
  { key: "mundial-2022", kind: "EVENT", topic: "FUTBOL", title: "Argentina campeón del mundo en Qatar", day: 18, month: 12, year: 2022, popularity: 100, numbers: [{ value: 3, reason: "tercera estrella" }] },
];
