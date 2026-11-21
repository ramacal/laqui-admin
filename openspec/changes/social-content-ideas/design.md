# Design: Ideas y piezas para redes

## Model

- `ContentIdea`: `kind` (PATRIOTIC_DATE, BIRTH, DEATH, COMMEMORATION, EVENT), `topic` (enum: PATRIA, PROCERES, FUTBOL, DEPORTES, FARANDULA, MUSICA, STREAMING, CULTURA), `title`, `month`, `day`, `year?` (origin), `provinceId?` (null = whole country), `summary?`, `headline?` and `caption?` (templates with `{years}`, `{year}`, `{agency}`), `popularity`, `active`, `source` (SEED, MANUAL, WIKIDATA) + `sourceKey`, unique together so seeds and imports upsert.
- `ContentIdeaNumber`: fixed extra numbers of an idea (`value`, `reason`), a table rather than JSON (AGENTS.md: explicit modeling).
- `QuinielaNumberMeaning`: `number` 0–99 unique, `meaning`, `usable`.
- `AgencySocialAccount`: `agencyId`, `network` (INSTAGRAM, FACEBOOK, TIKTOK), `handle`, `email?`; unique `(agencyId, network)`. No passwords.
- `Province`: `logoKey?` (public storage `provincias/{code}/marca/logo-{n}.png`), `brandPrimaryColor?`, `brandSecondaryColor?`.

Decision: births and deaths of the same person are two ideas (different headline and numbers); a person table can come with the Wikidata import.

## Numbers (src/lib/content/numbers.ts)

Pure function `ideaNumbers(idea, year)`: years elapsed, day, month, ddmm, origin year, extras. The "main number" for the picture is the 2-digit years elapsed (`years % 100`), else the first extra, else the day.

## Rendering

`next/og` `ImageResponse` (satori + resvg, already bundled with Next: no new dependency) in a route handler `GET /panel/agencias/[agencyId]/redes/[ideaId]/imagen?formato=story|feed|cuadrado&fecha=YYYY-MM-DD&titulo=…`. It checks the same access as the page. Logos are read from storage and converted to PNG data URIs with sharp (satori does not read WebP). Fonts: Source Sans 3 TTF files fetched once from Google Fonts and cached in memory; if that fails it falls back to the default font. Pure texts (labels, caption, AI prompt) live in `text.ts` so the client editor can import them without Prisma.

## Captions

Plain templates per kind with placeholders; the screen keeps the edited text in the browser only (copy and download, nothing stored). "Copiar prompt para IA" builds a prompt with the idea, numbers, meanings, agency name, city and handle.

## Today

`ideasFor(agency, from, days)` returns active ideas whose month/day fall in the range and whose province is null or the agency's, sorted by date then popularity. Dates use the agency timezone.

## Official lotteries (added 2026-11-20)

Hierarchy: `Country` (ISO code) → `Province` (province, state or jurisdiction; `countryId`) → `Lottery` (official organism). The existing `Lottery` table (the Quiniela "lotteries": Ciudad, Provincia, …) gains `countryId`, `provinceId?` (unique: one official lottery per jurisdiction; null = national), `fullName` (organism), `website`, `logoKey`, `brandPrimaryColor`, `brandSecondaryColor` and `quinielaDraws` (Laqui offers its draws; the 7 lotteries Laqui already handled keep it). Brand fields moved from `Province` to `Lottery`.

Decision: one table instead of a separate `LotteryAuthority`, since each organism draws one Quiniela. Split it if an organism ever runs several.

Data: the 24 ALEA members (alea.org.ar/miembros) in `prisma/data/lotteries.ts`; logos are downloaded by `npm run lotteries:logos` (margins trimmed, PNG, `loterias/{code}/logo-{n}.png`). Lotería Nacional S.E. is not an ALEA member; its Quiniela is drawn by Lotería de la Ciudad, so there is no "Nacional" row. Pictures put the lottery logo on a white pill, since most published logos are JPGs on white.
