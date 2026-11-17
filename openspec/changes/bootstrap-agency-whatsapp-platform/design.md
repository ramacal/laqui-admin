# Design: Bootstrap Agency WhatsApp Betting Platform

## Overview

The system is split into four main capability areas:

1. Global game catalog
2. Province Quiniela calendar
3. Agency public betting flow
4. Orders and receipts

The core design principle is layered configuration:

- Global: game rules and pricing
- Province: standard game availability and Quiniela calendar
- Agency: branding, WhatsApp target, visibility, operating schedule
- Order: persisted transaction intent and receipt lifecycle

## Domain Model Summary

### Global

- `GameDefinition`
- global pricing
- global rule sets

### Province

- `Province`
- `ProvinceGameAvailability`
- `ProvinceQuinielaMonthlyProgram`
- `ProvinceQuinielaProgramDay`
- `ProvinceQuinielaProgramDayDraw`
- `Lottery`
- `ProvinceLotteryAvailability`

### Agency

- `Agency`
- `AgencyGameAvailability`
- `AgencyScheduleRule`
- `AgencyScheduleException`

### Customer and Orders

- `Customer`
- `AgencyCustomer`
- `Order`
- `OrderItem`
- `Receipt`

## Key Decisions

### 1. Explicit Daily Quiniela Schedule

The published Quiniela schedule is stored explicitly per day and per draw. Templates and import JSON may help generate it, but the published state must be materialized day by day.

### 2. Minimal Agency Overrides

Agencies may decide whether to expose a game and define their own operating schedule, but they do not redefine global game rules or province schedules.

### 3. WhatsApp as Handoff, Not Source of Truth

The system persists customer, order, and receipt before and after the WhatsApp handoff. WhatsApp is the delivery channel, not the canonical store of the transaction.

### 4. Structured Quiniela Flow

For Quiniela, the user selects:

- one or more draws,
- one or more lotteries,
- one or more bet lines,
- direct or redoblona mode,
- optional “bajar” behavior.

The total is derived from explicit lines multiplied by selected draws and lotteries.

## Monthly Quiniela Import Flow

1. Admin uploads monthly PDF or source file.
2. System extracts text or images.
3. LLM returns normalized JSON draft.
4. Admin reviews the parsed result.
5. System publishes explicit daily draw configuration for the province.

## Availability Resolution

To determine whether a public betting option is available:

1. The game must be globally active.
2. The game must be available for the agency province.
3. The game must be visible for the agency.
4. For Quiniela, the draw must be enabled on that province day.
5. The agency must be open according to rules and exceptions.

## Implementation Notes

- Start from Prisma and seed data early.
- Keep the JSON import contract strict and reviewable.
- Keep public betting forms mobile-first from the first implementation.


## Data Model Decisions (Prisma, task 1.1)

Implemented in `prisma/schema.prisma` (Prisma 7.10.1, MySQL 8.4 via `@prisma/adapter-mariadb`; local DB in `docker-compose.yml`).

- **Number picks as rows.** MySQL has no array columns, so Quini 6 / Loto Plus numbers live in `OrderItemPick` (one row per number, unique per line).

- **Game rules as typed columns, not JSON.** `GameDefinition` has a `kind` (`QUINIELA` | `NUMBER_PICK`) plus explicit rule columns (`pickCount`, `minNumber`, `maxNumber`, `extraMin`, `extraMax`, `minLineAmount`, `maxDigits`). Loto Plus sub-draws live in `GameModality`.
- **Price snapshots.** `GameDefinition.basePrice` is the current global price; `OrderItem.amount` and `Order.total` store the value at order time so price changes never rewrite history.
- **Monthly programs are versioned.** Re-importing a month creates a new `version`; `rawParse` (audit) and `draft` (reviewed) are the only JSON columns. Only one `PUBLISHED` version per province/month is enforced in application logic.
- **Quiniela multipliers at order level.** Selected draws (`OrderQuinielaDraw`) and lotteries (`OrderQuinielaLottery`) belong to the order; each `OrderItem` is one bet line. Total = Σ line amounts × draws × lotteries.
- **"Bajar"** is modeled as derived lines (`OrderItem.derivedFromId`).
- **Receipt upload link** uses `Order.publicToken`, so the customer never needs an account.

### Open Questions

- Does every lottery run in every draw slot, or must the calendar record lotteries per draw?
- Quiniela placement set: confirm `1 / 5 / 10 / 20`.
- Admin/backoffice users and roles are not modeled yet (auth pending, task 1.3).

## Seed Strategy (task 1.2)

`prisma/seed.ts` (`npm run db:seed`) is idempotent (upserts by natural codes) and separates:

- **Reference data:** 3 games with rules and modalities, 24 provinces (ISO 3166-2:AR codes), 7 Quiniela lotteries.
- **Demo data (dev only):** Santa Fe availability, `agencia-demo`, and a generated PUBLISHED calendar for the current and next month (Mon–Sat, 5 draws). Existing programs are never regenerated, because orders may reference their draws.

Placeholders marked `TODO confirm` in the seed: Quini 6 price, Quiniela minimum line amount, demo draw times.

## Agency Administration (tasks 7.1–7.2)

- `Agency.licenseNumber` holds the "número de legajo", unique per province (`@@unique([provinceId, licenseNumber])`).
- `AgencyEmployee` has one row per person per agency: role (`OWNER` titular, `MANAGER` encargado, `EMPLOYEE`), CUIL (11 digits, unique per agency), phone, optional email, and a structured home address whose province references `Province`. Employees who leave are deactivated, not deleted.
- The contact number of agencies and customers is named `cellphoneNumber`. It is still the WhatsApp number used for the handoff.
- Migration `agency_employees_cellphone` renames columns in place (no data loss) and backfills a `PEND-…` placeholder legajo for existing agencies.

### Open Questions

- Should employees log in to the backoffice? If so, `AgencyEmployee` becomes the link to the auth user.
- Does an employee also need their own HR file number (legajo de empleado)?

## Access Profiles (task 7.4)

- `User` is the login account (Auth.js-compatible shape; `Account`/`Session` tables arrive with the auth setup). `User.platformRole = PLATFORM_ADMIN` is the platform admin profile, not tied to any agency.
- Agency access comes from active `AgencyEmployee` rows linked to the user (`userId`, unique per agency). `EmployeeRole`: `OWNER` (dueño), `ADMIN` (agency admin), `EMPLOYEE`. The old `MANAGER` value was migrated to `ADMIN`.
- An employee without `userId` is data-only and cannot sign in.
- Permission rules (admin cannot manage owners, employees see only their agency) are enforced in the application layer (task 7.5).

## Authentication (task 7.6)

- **Library:** Better Auth 1.7 with the Prisma adapter (MySQL). Auth.js v5 is still beta and its Prisma adapter does not support Prisma 7.
- **Provider:** Google only (`socialProviders.google`). Tables: `User`, `Session`, `Account`, `Verification`.
- **Access linking:** on user creation and on every new session, unlinked `AgencyEmployee` rows whose `email` equals the Google email get `userId` set. Employee emails must be stored lowercase.
- **Routes:** `/api/auth/[...all]` (Better Auth handler), `/login`, `/panel` (server-side session check via `requireAccess()` in `src/lib/access.ts`).

## File Storage

- **Where:** S3-compatible object storage. Local: SeaweedFS 4.51 in `docker-compose.yml` (MinIO no longer publishes Docker images). Production: S3, Cloudflare R2 or Supabase Storage (same code, different env vars). The database stores only the object key and metadata, never the file.
- **Buckets:** `laqui-public` (logos, employee photos for social media; anonymous read) and `laqui-private` (payment receipts, ticket photos; signed URLs only).
- **Layout (both buckets), one folder per agency by province and legajo:**
  - `agencias/{provincia}/{legajo}/logo/{tipo}.{ext}`
  - `agencias/{provincia}/{legajo}/empleados/{employeeId}/foto.{ext}`
  - `agencias/{provincia}/{legajo}/comprobantes/{yyyy}/{mm}/{orderId}/{fileId}.{ext}` (private)
  - `agencias/{provincia}/{legajo}/boletas/{yyyy}/{mm}/{orderId}/{fileId}.{ext}` (private)
  - Agencies without a legajo yet use `pendiente-{agencyId}` instead of the legajo.
- **Keys are stored as written:** if a legajo changes, existing files keep working; new uploads use the new folder.
- **Models:** `AgencyAsset` (logo variants, replaces `Agency.logoUrl`), `Receipt` (customer payment proof), `BetTicket` (tentative: photo of the printed ticket sent to the customer).

## Agency Schedule

- **General schedule:** one `ScheduleTemplate` per owner (`@@unique([ownerUserId])`), shown to users as "Horario general" (no template list, no picker). `Agency.scheduleTemplateId` set = the agency inherits it; `null` = personalized, using its own `AgencyScheduleRule` rows (its single own schedule).
- **Copy on modify:** saving weekly hours on an inheriting agency stores them as its own and clears `scheduleTemplateId`. "Volver al horario general" re-links it and deletes its own weekly rules. When the general schedule is created or saved, the owner's agencies with no hours of their own start inheriting it.
- **Exceptions:** one table `ScheduleException` for both scopes (exactly one of `agencyId` / `templateId`, validated in `src/lib/schedule.ts`: MySQL rejects CHECKs on cascading FK columns (error 3823) and triggers need SUPER with binlog (error 1419)), with `startDate`..`endDate` (inclusive), `kind` (`CLOSED` | `SPECIAL_HOURS`), `reason`, optional `holidayId`, and `ScheduleExceptionSlot` rows for special hours. Replaces the unused `AgencyScheduleException`.
- **Resolution** (`src/lib/schedule.ts`): agency exception > template exception > weekly hours (own or template). Evaluated in the agency's time zone. Times are wall-clock values stored as `TIME`; dates as `DATE`.
- **Holidays:** `Holiday` (date, name, kind) synced from ArgentinaDatos (`https://api.argentinadatos.com/v1/feriados/{year}`, community API mirroring the official calendar) with `npm run holidays:sync` for the current and next year. Reference only: they never close an agency unless turned into an exception. If the API disappears, stored holidays remain and can be edited by hand.
- **Taking bets** (later): agency open AND the Quiniela draw's `closeTime` not passed.
- **Final UI note:** the current panel screens are a validation scaffold. In the final backoffice, an agency's schedule screen should lead with its weekly hours (the default), then date exceptions and holiday shortcuts, and offer "use these hours in other agencies" (templates) as a secondary action.

## Products and Prices

- **Base products** stay as `GameDefinition` (rules, modalities, active). Prices moved to `ProvinceGamePrice` (province, game, amount, validFrom); for Quiniela the amount is the minimum per bet line. The old global `basePrice`/`minLineAmount` were copied into every province offering the game (valid from 2026-01-01) before being dropped.
- **Owner products:** `OwnerProduct` (one list per owner) + `OwnerProductPrice` (unit price history) + `OwnerProductAgency` (where it is offered). Optional sale window `availableFrom`..`availableUntil` (inclusive).
- **Validity:** the price in effect on a date is the row with the latest `validFrom` <= date; a future row is a scheduled change. Same date = correction.
- **Orders:** `Order.gameId` is optional (owner-products-only orders); `OrderItem` kind `OWNER_PRODUCT` keeps product name, quantity and unit price as snapshots.
- **Catalog** (`src/lib/catalog.ts`): base game offered when active + enabled in province + not hidden in agency + price in effect; owner product when active + linked + in window + price in effect.
