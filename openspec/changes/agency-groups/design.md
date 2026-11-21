# Design: Grupo de agencias y sus dueños

## Model

```prisma
model AgencyGroup {
  id        String   @id @default(cuid())
  slug      String   @unique // via src/lib/names.ts, used in storage keys
  name      String           // "Agencias Pérez"
  agencies  Agency[]
  owners    AgencyGroupOwner[]
  events    AgencyGroupEvent[]
  schedule  ScheduleTemplate?
  products  OwnerProduct[]
  createdAt DateTime @default(now())
}

model AgencyGroupOwner {
  groupId   String
  userId    String?  // null until the invited email signs in
  email     String   // lowercase Google email; matching links the login
  addedById String?
  createdAt DateTime @default(now())
  @@id([groupId, email])
  @@index([userId])
}

model AgencyGroupEvent {      // audit log, append-only
  id        String   @id @default(cuid())
  groupId   String
  kind      AgencyGroupEventKind // OWNER_ADDED, OWNER_REMOVED, AGENCY_MOVED_IN, AGENCY_MOVED_OUT
  actorId   String?
  detail    String   // human-readable, e.g. "agregó a x@gmail.com"
  createdAt DateTime @default(now())
}

// Agency gains:
//   groupId        String  (required after migration)
//   titularFirstName String?, titularLastName String?, titularCuil String? @db.VarChar(11),
//   titularEmail String? (lowercase; only used to offer access, never grants it by itself)
// ScheduleTemplate: ownerUserId → groupId (@@unique([groupId]))
// OwnerProduct:     ownerUserId → groupId
// EmployeeRole:     OWNER removed (phase 2)
```

**Why owners in their own table and not as `AgencyEmployee` rows:** owners are per group, not per agency; a row per agency would have to be kept in sync on every agency added or moved. Pending owners (email without a user yet) follow the same rule employees already use: the email matches the Google login.

**Why the titular is columns on `Agency` and not a person table:** it is one person per agency, legal data, no login. A separate table adds joins without a use today.

## Access

`getAccess()` adds `ownedGroups: { id, name, agencies }[]`, read through `AgencyGroupOwner` by `userId`. When a user signs in, rows with their email and `userId = null` are linked (same hook that links employees today).

`agencyRole(access, agencyId)`:

1. Platform admin → `OWNER`.
2. The agency's group is in `ownedGroups` → `OWNER`.
3. Otherwise the membership role (`ADMIN` or `EMPLOYEE`).

`OWNER` stays as the *computed* access level in TypeScript (a union type `AccessRole = "OWNER" | EmployeeRole`), so every `canX(role)` helper keeps working. It is removed only from the database enum.

The sidebar and the board list: agencies of owned groups first, then memberships in other agencies. If the user owns several groups (rare), agencies are grouped by group name.

## Data flow of the migration

Phase 1 (additive, one migration + one script `scripts/migrate-groups.ts` with `--dry-run`):

1. For each distinct `userId` among active `OWNER` rows, create a group named after the user and an owner row with their email.
2. Set `Agency.groupId` from its `OWNER` row's user. Agencies with no linked owner get a group of their own, with the owner email pending if the row has one.
3. Copy the `OWNER` row's first and last name and CUIL into `Agency.titular*`. Names that equal the group name (a placeholder titular) are left empty, so the screen shows "Titular pendiente".
4. Point `ScheduleTemplate` and `OwnerProduct` at the new group. Product images keep their keys; they move to `grupos/{group-slug}/…` in phase 2 cleanup.

Phase 2 (after verifying in the panel): delete `OWNER` rows, drop `OWNER` from `EmployeeRole`, drop `ownerUserId` columns, delete the old image keys.

## Screens

- **Plataforma → Grupos** (platform admin): list of groups; "Nuevo grupo" asks name + first owner email; inside a group, "Agregar agencia" with legajo, provincia, titular, WhatsApp and logo. This is how a new agenciero is onboarded.
- **Sidebar:** Inicio · Agencias · Configuración general (Horario general, Productos y precios, Personas del grupo). Only for owners.
- **Personas del grupo** (`/panel/grupo`): owners with "pendiente" for emails not yet signed in; add by email; remove (disabled for the last one); last 20 events.
- **Titular form** (agency onboarding and agency summary): name, CUIL, email. If the email is not a group owner, a required radio "¿Qué acceso le das?": Dueño del grupo / Administrador de esta agencia / Sin acceso. Same transaction creates the `AgencyGroupOwner` row or the `AgencyEmployee` membership.
- **Agency summary:** "Titular" block (editable by owners) and "Grupo" line; the current "Cargá el email del dueño" form goes away.
- **Personal:** no owner row; roles are Administrador and Empleado.
- **Move agency:** at the bottom of the agency summary, owners only, with the type-the-name confirmation.
