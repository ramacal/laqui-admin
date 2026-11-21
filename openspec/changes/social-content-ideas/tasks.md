# Tasks: Ideas y piezas para redes

## Phase 1: Model

- [x] Schema: ContentIdea, QuinielaNumberMeaning, AgencySocialAccount, Province brand fields; migration
- [x] Seed: meanings 00–99 (usable flags), patriotic dates, próceres, a few famous people

## Phase 2: Domain

- [x] `src/lib/content/numbers.ts` numbers per year
- [x] `src/lib/content/ideas.ts` ideas for an agency and range, captions and AI prompt
- [x] `src/lib/content/render.tsx` branded picture in three sizes

## Phase 3: Panel

- [x] `/panel/agencias/[id]/redes`: social accounts form + upcoming ideas
- [x] `/panel/agencias/[id]/redes/[ideaId]`: pictures, editable headline and caption, copy buttons
- [x] `/panel/redes`: the bank and the meanings (read-only)
- [x] Country → province → official lottery; Plataforma → Loterías ABM
- [x] Load the 24 official lotteries (ALEA) and their logos (`npm run lotteries:logos`)

## Phase 4: Next change

- [ ] Admin editing of the bank
- [ ] Wikidata import (births/deaths by province, popularity by sitelinks)
- [ ] Football fixtures, farándula, streamers
