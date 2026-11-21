// Upload agency logos from a local folder to the public bucket and register them.
//   npm run logos:import                        -> prisma/data/logos
//   npm run logos:import -- path/to/folder
//
// File names follow the style guide: {code}_{kind}.{ext}, e.g. lot_brujita_simbolo.png.
// The code -> agency mapping comes from prisma/data/agencias.local.json (code + slug).
import "dotenv/config";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import type { AgencyAssetKind } from "../src/generated/prisma/enums";
import { prisma } from "../src/lib/prisma";
import { deleteFile, keys, publicUrl, putFile } from "../src/lib/storage";

const folder = process.argv[2] ?? "prisma/data/logos";
const mapping = JSON.parse(readFileSync("prisma/data/agencias.local.json", "utf8")) as {
  agencies: { code: string; slug: string }[];
};
const slugByCode = new Map(mapping.agencies.map((a) => [a.code, a.slug]));

const KIND: Record<string, { kind: AgencyAssetKind; name: string }> = {
  "simbolo.png": { kind: "LOGO_SYMBOL", name: "simbolo" },
  "simbolo.svg": { kind: "LOGO_SYMBOL_VECTOR", name: "simbolo" },
  "logo.png": { kind: "LOGO_MAIN", name: "logo" },
  "logo.svg": { kind: "LOGO_MAIN", name: "logo" },
  "perfil.png": { kind: "PROFILE_PICTURE", name: "perfil" },
};
const MIME: Record<string, string> = { png: "image/png", svg: "image/svg+xml", jpg: "image/jpeg" };

// Walk subfolders too (the Drive layout is assets/{code}/logo/final/).
function listFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? listFiles(path) : [path];
  });
}

async function main() {
  let uploaded = 0;
  for (const path of listFiles(folder)) {
    const file = path.split(/[\\/]/).pop()!.toLowerCase();
    const match = file.match(/^(lot_[a-z0-9]+)_(simbolo|logo|perfil)\.(png|svg)$/);
    if (!match) continue;
    const [, code, variant, ext] = match;
    const spec = KIND[`${variant}.${ext}`];
    const slug = slugByCode.get(code);
    if (!spec || !slug) {
      console.warn(`skip ${file}: unknown agency code or variant`);
      continue;
    }

    const agency = await prisma.agency.findUnique({ where: { slug }, include: { province: true } });
    if (!agency) {
      console.warn(`skip ${file}: agency ${slug} not in the database (run agencies:import first)`);
      continue;
    }

    const body = new Uint8Array(readFileSync(path));
    // A new name per upload (cache-safe); the previous file of that kind is removed after the switch.
    const where = { agencyId_kind: { agencyId: agency.id, kind: spec.kind } };
    const previous = await prisma.agencyAsset.findUnique({ where, select: { storageKey: true } });
    const key = keys.brand(agency, spec.name, ext);
    await putFile("public", key, body, MIME[ext], { immutable: true });
    await prisma.agencyAsset.upsert({
      where,
      create: { agencyId: agency.id, kind: spec.kind, storageKey: key, mimeType: MIME[ext], sizeBytes: body.byteLength },
      update: { storageKey: key, mimeType: MIME[ext], sizeBytes: body.byteLength },
    });
    if (previous && previous.storageKey !== key) await deleteFile("public", previous.storageKey).catch(() => undefined);
    console.log(`${agency.name}: ${spec.kind} -> ${publicUrl(key)}`);
    uploaded++;
  }
  console.log(uploaded ? `${uploaded} archivo(s) subidos.` : `No se encontraron logos en ${folder}.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
