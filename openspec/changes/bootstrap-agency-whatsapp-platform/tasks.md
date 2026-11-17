# Tasks: Bootstrap Agency WhatsApp Betting Platform

## 1. Infrastructure

- [x] 1.1 Establish the initial Prisma schema for the greenfield domain
- [x] 1.2 Add initial seed strategy for global games, provinces, lotteries, and default schedules
- [ ] 1.3 Define environment variable contract for auth, database, and storage

## 2. Global Game Catalog

- [x] 2.1 Model global game definitions and pricing
- [x] 2.2 Encode initial rules for `Quiniela`, `Quini 6`, and `Loto Plus`
- [ ] 2.3 Define how game rules are surfaced to public flows

## 3. Province Quiniela Calendar

- [x] 3.1 Model province game availability
- [x] 3.2 Model lotteries available per province
- [x] 3.3 Model monthly Quiniela import drafts and published daily schedules
- [ ] 3.4 Define JSON contract for monthly Quiniela imports

## 4. Agency Public Flow

- [x] 4.1 Model agency visibility for games
- [x] 4.2 Model agency operating schedule and date exceptions
- [ ] 4.3 Define public route behavior for agency landing and game entry
- [ ] 4.4 Define mobile-first Quiniela flow behavior
- [ ] 4.5 Define mobile-first Quini 6 and Loto Plus flow behavior

## 5. Orders and Receipts

- [x] 5.1 Model customer registration by WhatsApp number
- [x] 5.2 Model persisted orders and line items
- [ ] 5.3 Define WhatsApp intent payload generation
- [x] 5.4 Model receipt upload and review lifecycle

## 6. Verification

- [ ] 6.1 Review all specs for domain consistency
- [ ] 6.2 Confirm no Telegram/chat-session assumptions remain
- [ ] 6.3 Confirm province and agency responsibilities are clearly separated


## 7. Agency Administration

- [x] 7.1 Model agency file number (legajo), unique per province
- [x] 7.2 Model agency employees (CUIL, phone, address, role, active)
- [ ] 7.3 Validate CUIL format (11 digits, check digit) in the application layer
- [x] 7.4 Model users, platform admin profile, and agency roles (owner, admin, employee)
- [ ] 7.5 Enforce role permissions in the application layer once auth is in place
- [x] 7.6 Google SSO with Better Auth (login page, protected panel, link employees by email)

## 8. File Storage

- [x] 8.1 MinIO in docker-compose with public and private buckets
- [x] 8.2 AgencyAsset and BetTicket models; per-agency storage layout
- [x] 8.3 Storage module (keys, upload, public URL, signed URL)
- [ ] 8.4 Import agency logos and show them in the panel (code ready; waiting for the logo files)
