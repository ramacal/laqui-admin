// A job's cron schedule in words, for the admin ("Todos los días a las 08:00 y 14:00").
// Covers the shapes the jobs use; anything else is shown as the cron expression itself.
const DAYS = [
  "domingos",
  "lunes",
  "martes",
  "miércoles",
  "jueves",
  "viernes",
  "sábados",
];
const pad = (n: number) => String(n).padStart(2, "0");

function list(items: string[]) {
  return items.length > 1
    ? `${items.slice(0, -1).join(", ")} y ${items[items.length - 1]}`
    : items[0];
}

export function cronText(expr: string): string {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return expr;
  const [min, hour, dom, mon, dow] = parts;
  const every = min.match(/^\*\/(\d+)$/);
  if (every && hour === "*" && dom === "*" && mon === "*" && dow === "*")
    return `Cada ${every[1]} minutos`;
  if (
    !/^\d+$/.test(min) ||
    !/^\d+(,\d+)*$/.test(hour) ||
    dom !== "*" ||
    mon !== "*"
  )
    return expr;
  const times = list(
    hour.split(",").map((h) => `${pad(Number(h))}:${pad(Number(min))}`),
  );
  const at = `a las ${times}`;
  if (dow === "*") return `Todos los días ${at}`;
  if (dow === "1-5") return `De lunes a viernes ${at}`;
  if (dow === "1-6") return `De lunes a sábado ${at}`;
  if (/^\d(,\d)*$/.test(dow))
    return `Los ${list(dow.split(",").map((d) => DAYS[Number(d) % 7]))} ${at}`;
  return expr;
}
