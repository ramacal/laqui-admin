// Sync the national holiday calendar from ArgentinaDatos (community API that
// mirrors the official calendar). Reference data only: holidays never close an
// agency by themselves (spec agency-schedule).
//   npm run holidays:sync              -> current and next year
//   npm run holidays:sync -- 2028      -> a specific year
import "dotenv/config";
import type { HolidayKind } from "../src/generated/prisma/enums";
import { prisma } from "../src/lib/prisma";

const API = "https://api.argentinadatos.com/v1/feriados";
const KIND: Record<string, HolidayKind> = { inamovible: "FIXED", trasladable: "MOVABLE", puente: "BRIDGE" };

type ApiHoliday = { fecha: string; tipo: string; nombre: string };

async function syncYear(year: number) {
  const res = await fetch(`${API}/${year}`, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`${API}/${year} -> HTTP ${res.status}`);
  const list = (await res.json()) as ApiHoliday[];

  const seen: string[] = [];
  for (const h of list) {
    const kind = KIND[h.tipo] ?? "BRIDGE";
    if (!KIND[h.tipo]) console.warn(`  tipo desconocido "${h.tipo}" en ${h.fecha} -> BRIDGE`);
    const date = new Date(`${h.fecha}T00:00:00.000Z`);
    const saved = await prisma.holiday.upsert({
      where: { date_name: { date, name: h.nombre } },
      create: { date, name: h.nombre, kind },
      update: { kind },
    });
    seen.push(saved.id);
  }

  // Holidays removed from the official calendar (e.g. a bridge day that was revoked).
  // Exceptions created from them stay; they only lose the link (onDelete: SetNull).
  const { count: removed } = await prisma.holiday.deleteMany({
    where: {
      source: "argentinadatos",
      date: { gte: new Date(Date.UTC(year, 0, 1)), lt: new Date(Date.UTC(year + 1, 0, 1)) },
      id: { notIn: seen },
    },
  });

  console.log(`${year}: ${list.length} feriados${removed ? `, ${removed} eliminados del calendario oficial` : ""}`);
}

async function main() {
  const arg = Number(process.argv[2]);
  const now = new Date().getUTCFullYear();
  const years = Number.isInteger(arg) && arg > 2000 ? [arg] : [now, now + 1];
  for (const year of years) await syncYear(year);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
