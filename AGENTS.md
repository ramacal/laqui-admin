# Agent Instructions

## Purpose

This project uses OpenSpec plus local SDD skills as the default workflow for non-trivial product and engineering work.

The product code lives in normal application folders such as `src/`, `prisma/`, and `public/`.
The agent workflow lives in:

- `openspec/`
- `.agents/skills/`

Do not confuse workflow artifacts with runtime application code.

## Default Workflow

For any meaningful feature, refactor, or architectural change:

1. Check `openspec/config.yaml`.
2. Review existing main specs in `openspec/specs/`.
3. Create or continue a change in `openspec/changes/{change-name}/`.
4. Produce artifacts in this order when applicable:
   - `proposal.md`
   - `specs/{domain}/spec.md`
   - `design.md`
   - `tasks.md`
   - `verify-report.md`
5. Implement only after the change artifacts are coherent enough to guide the work.

Small, local, low-risk edits may skip the full flow, but should still respect the domain model and existing specs.

## Artifact Rules

- Main specs live in `openspec/specs/{domain}/spec.md`.
- Active changes live in `openspec/changes/{change-name}/`.
- Archived changes live in `openspec/changes/archive/`.
- New capabilities should become new main specs.
- Changes to existing behavior should be written as delta specs under the active change.

## Skills

Local agent skills live in `.agents/skills/`.

Relevant local skills currently available:

- `frontend-design`
- `sdd-init`
- `sdd-propose`
- `sdd-spec`
- `sdd-design`
- `sdd-tasks`
- `sdd-apply`
- `sdd-verify`
- `sdd-archive`
- `sdd-onboard`
- `sdd-explore`

When the task clearly matches one of these skills, use it.

## Writing Standards

- Use Given/When/Then scenarios in specs.
- Use RFC 2119 keywords where requirements strength matters.
- Prefer explicit domain modeling over ad hoc JSON blobs.
- Keep mobile-first behavior explicit in product decisions.
- Keep agent workflow files concise and operational.

## Project Direction

This product is a guided betting flow for lottery agencies with:

- global game definitions and pricing,
- province-level standard game availability and Quiniela calendar,
- agency-level branding, WhatsApp destination, visibility, and operating schedule,
- customer registration, order persistence, and receipt uploads.

Use this domain model consistently in future specs and implementation.

