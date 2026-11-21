# Proposal: Ideas y piezas para redes

## Intent

Agencies post on Instagram almost every day, and the posts that work have a hook: a date and a number to play ("Hoy se cumplen 181 años de la Vuelta de Obligado: jugale al 81"). Today each agency invents those posts by hand. Laqui already knows the agency's brand (logo, color) and province, so it can propose today's ideas, compute their numbers, and render a branded picture ready to post.

## Scope

### In Scope

- A bank of ideas that repeats every year: patriotic dates, próceres (birth and death), commemorations and famous people, with day, month, origin year, scope (country, province) and tags.
- Numbers computed for the year being viewed (years elapsed, day, month, origin year) plus fixed extra numbers (a jersey number).
- The traditional meaning of the Quiniela numbers 00–99 ("los sueños"), shown next to each 2-digit number.
- Social accounts of the agency: Instagram handle and the email used for its social accounts.
- Official lotteries by country and jurisdiction (ABM in Plataforma → Loterías) with logo and colors, loaded for the 24 Argentine jurisdictions.
- A picture template in three sizes (story 1080×1920, feed 1080×1350, square 1080×1080) with the province logo, the agency logo, colors and Instagram handle.
- An editable caption per idea, with copy buttons for the caption and for a prompt the user can paste into their own AI chat.

### Out of Scope

- Calling an AI service from Laqui (the user iterates the caption in their own chat).
- Automatic import from Wikidata, football fixtures, farándula and streamers (next change).
- Publishing to Instagram, storing passwords, video/reels.
- An editor for the bank of ideas (seeded for now; admin editing comes later).

## Capabilities

### New Capabilities

- `social-content`: idea bank, number meanings, agency social accounts, province brand, branded pictures and captions.

### Modified Capabilities

- None

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `prisma/schema.prisma` | New | `Country`, `ContentIdea`, `QuinielaNumberMeaning`, `AgencySocialAccount`; organism and brand fields on `Lottery` |
| `prisma/seed.ts` | Modified | Seeds meanings, patriotic dates and próceres |
| `src/lib/content/` | New | Numbers per year, today's ideas, captions, picture rendering |
| `src/app/panel/agencias/[agencyId]/redes/` | New | Social accounts, today's ideas, picture and caption |
| `src/app/panel/redes/` | New | Platform admin: province brand and the bank |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Some traditional meanings are offensive | High | Each meaning has `usable`; unusable ones never appear in posts |
| Political dates or people hurt an agency | Medium | Seed leaves out party politics; tags let agencies skip topics later |
| Gambling advertising rules of the provincial lottery | Medium | Pictures carry an editable responsible-gaming line; review the rules before going live |
| Photos of real people | Medium | No photos in this change; pictures are typographic |

## Rollback Plan

The change only adds tables and nullable columns. Rolling back = drop the new tables/columns and the routes; no existing data changes.

## Success Criteria

- [ ] An agency sees today's and the next days' ideas with their numbers and meanings.
- [ ] It downloads a branded picture in three sizes and copies an editable caption.
- [ ] Its Instagram handle and social email are recorded and shown on the picture.
