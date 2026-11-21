# Proposal: Grupo de agencias y sus dueños

## Intent

Today "dueño" means an `AgencyEmployee` row with role `OWNER`, and that same row is also the license holder ("titular"). The general schedule (`ScheduleTemplate`) and the owner's own products (`OwnerProduct`) belong to one `User`.

That mixes three things that are different in real life:

- the **titular**: the person on the Lotería license (one per agency, legal data, often never logs in);
- the **people who run the business**: often a family, several of them, each with their own Google account;
- the **shared settings**: one general schedule and one product list for all their agencies.

Real case: four agencies with four different titulares, all loaded with the same Google email, so one login is "owner" of all four. One agency shows the group name as its titular. Two other family members cannot see the shared settings without sharing that login.

## Scope

### In Scope

- A **group of agencies** (`AgencyGroup`) that owns the agencies, the general schedule and the owner products.
- **Group owners** (`AgencyGroupOwner`): several accounts, all equal. They see every agency in the group, the board, and "Configuración general".
- The **titular** becomes agency data (name, CUIL), with no login. It may or may not match an owner.
- Per-agency roles become **Administrador** and **Empleado** only. `OWNER` leaves `EmployeeRole`.
- Safeguards: a group always keeps at least one owner; adding or removing owners and moving an agency to another group are logged; moving an agency asks the user to type its name.
- A "Personas del grupo" screen under Configuración general, where owners add another owner by Google email.
- Data migration of the current agencies, with no manual steps.

### Out of Scope

- Roles inside the group (owner who can only see, owner who can only edit prices). This can be added later as a role on `AgencyGroupOwner`.
- Billing, plans, or anything Laqui charges the group.
- Moving cash, fiados and finances history between groups (they stay with the agency, which keeps its id).
- An admin who works in some agencies of the group without being an owner. That already works with per-agency Administrador memberships.

## Capabilities

### New Capabilities

- `agency-groups`: group of agencies, group owners, titular as agency data, access rules derived from the group.

### Modified Capabilities

- `agency-administration`: `OWNER` removed from per-agency roles; admins manage admins and employees.
- `agency-schedule`: the general schedule belongs to the group, not to a user.
- `owner-products`: owner products belong to the group.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `prisma/schema.prisma` | Modified | New `AgencyGroup`, `AgencyGroupOwner`, `AgencyGroupEvent`; `Agency.groupId`, `Agency.titular*`; `ScheduleTemplate.groupId`, `OwnerProduct.groupId`; `OWNER` removed from `EmployeeRole` |
| `src/lib/access.ts` | Modified | `getAccess` returns owned groups; `agencyRole` gives `OWNER` to group owners |
| `src/lib/schedule.ts`, `finance.ts`, `staff.ts`, `catalog.ts` | Modified | "Agencies of an owner" become "agencies of a group" |
| `src/app/panel/layout.tsx`, `page.tsx`, `panel-nav.tsx` | Modified | The board and the sidebar come from group ownership plus memberships |
| `src/app/panel/agencias/[agencyId]/` | Modified | Agency summary shows Titular and Grupo separately; staff screens drop the owner row |
| `src/app/panel/grupo/` | New | "Personas del grupo": owners list, add by email, remove, activity log |
| `scripts/import-agencies.ts`, `prisma/seed.ts` | Modified | Create the group and set titulares instead of OWNER rows |
| Storage keys | Modified | Owner product images move from `duenos/{userId}/…` to `grupos/{group-slug}/…` (names via `src/lib/names.ts`) |

## User-facing impact

- Owners see the same board and sidebar as today. "Configuración general" gets one more entry, "Personas del grupo".
- Other owners (for example two family members) see exactly the same thing with their own Google accounts.
- The agency summary shows "Titular" (legal) and "Grupo" separately.
- A user with one agency and no extra owners never sees the word "grupo": the group is created for them and stays in the background.

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Migration attaches an agency to the wrong group | Low | Group = the distinct `userId` of current OWNER rows; a dry-run script prints the plan before it runs |
| An owner removes the others | Low | Last owner cannot be removed; every owner change is logged with who and when |
| Code still checks `role === "OWNER"` on memberships | Medium | `OWNER` leaves the enum, so TypeScript flags every leftover use |
| Owner product image URLs change | Low | Copy objects to the new keys before switching; old keys deleted after verification |

## Rollback Plan

The migration is additive first: new tables and columns are filled while `OWNER` rows stay. The code switches to the group. Only a later migration drops the `OWNER` rows and enum value. Rolling back before that step means reverting the code; the old rows are still there.

## Success Criteria

- [ ] Three Google accounts are owners of the same group and all see its four agencies, the board and Configuración general.
- [ ] Each agency shows its real titular, independent of who logs in.
- [ ] Editing the general schedule or a product as any owner changes it for every agency in the group.
- [ ] The last owner of a group cannot be removed.
- [ ] An Administrador of one agency sees only that agency and no Configuración general.
