# Proposal: Bootstrap Agency WhatsApp Betting Platform

## Intent

Create the initial source of truth for the greenfield product: a mobile-first guided betting platform for lottery agencies with WhatsApp handoff, province-driven Quiniela calendars, global game definitions, agency-level visibility, and persisted orders with receipts.

## Scope

### In Scope

- Define the initial business capabilities for the platform.
- Establish the domain boundaries for games, provinces, agencies, calendars, customers, orders, and receipts.
- Define the import-oriented monthly Quiniela calendar workflow.
- Define the public betting flow for `Quiniela`, `Quini 6`, and `Loto Plus`.

### Out of Scope

- Concrete UI implementation details beyond behavioral requirements.
- Final Prisma implementation.
- OCR/parser implementation details for PDF imports.
- WhatsApp API integration beyond link-based handoff.

## Capabilities

### New Capabilities

- `global-game-catalog`: Global definitions, pricing, and rules for supported games.
- `province-quiniela-calendar`: Province-level game availability and explicit daily Quiniela schedules.
- `agency-public-betting-flow`: Agency public links, mobile-first guided betting, and agency operating availability.
- `order-and-receipts`: Customer registration, persisted orders, WhatsApp intent generation, and receipt uploads.

### Modified Capabilities

- None

## Approach

Define the platform from the domain inward. Keep game rules global, keep Quiniela calendars explicit by day at province level, keep agency overrides minimal, and treat WhatsApp as a handoff channel rather than the system of record.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `openspec/specs/` | New | New capability specs for the product |
| `openspec/changes/bootstrap-agency-whatsapp-platform/` | New | Proposal, design, tasks, and delta artifacts |
| `src/` | Future | Guided betting flows and backoffice |
| `prisma/` | Future | New domain model |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Over-modeling too early | Medium | Keep first specs domain-focused and implementation-light |
| Province calendar ambiguity | Medium | Treat published daily schedule as explicit source of truth |
| Agency override complexity creep | Medium | Limit agency overrides to visibility and operating hours |

## Rollback Plan

If the domain split proves too granular, collapse the first implementation into fewer modules while preserving the same behavioral specs and data relationships.

## Dependencies

- OpenSpec workflow in `openspec/`
- Local SDD skills in `.agents/skills/`

## Success Criteria

- [ ] Core capabilities are captured as OpenSpec source-of-truth specs.
- [ ] The product domain is consistent across proposal, specs, design, and tasks.
- [ ] Future implementation can start from a stable domain model without revisiting Telegram-era assumptions.

