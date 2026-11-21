# Tasks: Grupo de agencias y sus dueños

## Phase 1: Model (additive)

- [x] Schema: `AgencyGroup`, `AgencyGroupOwner`, `AgencyGroupEvent`; `Agency.groupId` (nullable for now) and `titular*`; `groupId` on `ScheduleTemplate` and `OwnerProduct`; migration
- [x] `scripts/migrate-groups.ts` with `--dry-run`: groups from current OWNER rows, titulares, schedule and products (images keep their keys until phase 4)
- [x] Run the dry run on local data and review the plan with the user; applied 2026-11-20

## Phase 2: Access and domain

- [x] `getAccess` returns owned groups; link pending owner emails on sign-in
- [x] `agencyRole` with the group rule (legacy OWNER rows ignored; `ownsGroup`, `currentGroupId`)
- [x] `schedule.ts`, `finance.ts`, products: "agencies of a group" instead of "of an owner user"; `ownerUserId` optional
- [x] Staff screens hide legacy OWNER rows; agency summary shows Titular and Grupo; owner email form removed
- [x] Import script and seed create groups and titulares
- [ ] Drive sharing: share the agency folder with the group owners too (today they get it only through legacy OWNER rows)

## Phase 3: Panel

- [x] Sidebar and board from group ownership plus memberships (via `getAccess`)
- [x] `/panel/grupo`: owners list, add by email, remove (not the last), activity
- [x] Titular form with email and the access question (Dueño del grupo / Administrador / Sin acceso)
- [x] Move agency to another group with type-the-name confirmation
- [x] Plataforma → Grupos y agencias: create a group with its first owner email, add agencies to it (logo, address and staff from the agency page)

## Phase 4: Cleanup (after checking the panel)

- [ ] Delete OWNER rows; drop `OWNER` from `EmployeeRole`; make `Agency.groupId` required; drop `ownerUserId` columns
- [ ] Move owner product images to `grupos/{group-slug}/…` and delete the old keys
- [ ] Verify every scenario in `specs/agency-groups/spec.md`
