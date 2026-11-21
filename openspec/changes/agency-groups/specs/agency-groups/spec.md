# Spec: agency-groups

## Purpose

People who own agencies run them as a group: one or more owners, several agencies, one general schedule and one product list. Each agency keeps its own legal titular and its own staff.

## Requirements

### Requirement: Every agency belongs to one group

Every agency MUST belong to exactly one `AgencyGroup`. A group MUST have a name and MAY have one or more agencies.

#### Scenario: Platform admin onboards a new agenciero

- GIVEN a platform admin in Plataforma → Grupos
- WHEN they create group "Agencias Pérez" with owner email "x@gmail.com"
- THEN the group exists with that owner marked "pendiente"
- AND the platform admin can add agencies to the group (legajo, provincia, titular, WhatsApp, logo)
- AND when "x@gmail.com" signs in with Google, they are the group's owner and see its agencies

#### Scenario: Owner with one agency

- GIVEN a group with one agency and one owner
- WHEN the owner uses the panel
- THEN the screens do not mention the group until it has a second agency or a second owner

### Requirement: Group owners are equal

A group MUST have at least one owner. Every owner MUST have the same permissions: see and manage every agency of the group, its staff, its money, the general schedule, the products and prices, and the group's owners.

#### Scenario: Three owners see the same group

- GIVEN a group with four agencies and owners A, B and C
- WHEN B signs in with their own Google account
- THEN B sees the four agencies, the board and "Configuración general"
- AND B sees the same general schedule and products as A and C

#### Scenario: Any owner changes shared settings

- GIVEN owners A and B of a group
- WHEN B changes the general schedule
- THEN every agency of the group that inherits it shows the new hours
- AND A sees the change

### Requirement: Adding and removing owners

An owner MUST be able to add another owner by Google email and remove an owner. The last owner of a group MUST NOT be removable. Every addition and removal MUST be logged with who did it and when.

#### Scenario: Add an owner who has never signed in

- GIVEN an owner adds the email of a person who has no Laqui account
- WHEN that person signs in with Google using that email
- THEN they are an owner of the group

#### Scenario: Remove the last owner

- GIVEN a group with a single owner
- WHEN that owner tries to remove themselves
- THEN the action is rejected with "El grupo tiene que tener al menos un dueño"

### Requirement: Titular is agency data

Each agency MUST record its titular (the person on the Lotería license) as data: first name, last name and, optionally, CUIL and Google email. Being titular MUST NOT by itself grant any access. The titular MAY be pending while it is not loaded.

When the titular is loaded with an email that is not already an owner of the group, the form MUST ask which access to give: "Dueño del grupo", "Administrador de esta agencia" or "Sin acceso". There MUST NOT be a silent default. When the email already belongs to a group owner, the question MUST NOT be shown.

#### Scenario: Titular joins as group owner

- GIVEN a platform admin or owner adds agency "La Brujita" to a group
- AND loads titular A with email "a@gmail.com", not an owner of the group
- WHEN they pick "Dueño del grupo" and save
- THEN "a@gmail.com" is an owner of the group (pending until they sign in)
- AND the addition is logged

#### Scenario: Titular with access to one agency

- GIVEN the same form
- WHEN they pick "Administrador de esta agencia"
- THEN A gets an Administrador membership in "La Brujita" only

#### Scenario: Titular already owner

- GIVEN titular email "b@gmail.com" is already an owner of the group
- WHEN the titular is saved
- THEN no access question is shown and nothing changes in access

#### Scenario: Titular differs from the owners

- GIVEN agency "El 20" whose titular is person P
- AND the group owners are A and B, not P
- WHEN A opens the agency summary
- THEN the summary shows "Titular: P" and "Grupo: {group name}"
- AND P has no access unless added as owner or staff

### Requirement: Per-agency roles

Inside an agency, a person MAY be Administrador or Empleado. Owners of the agency's group MUST NOT need a per-agency membership. An Administrador MUST manage Administradores and Empleados of that agency, its cash, fiados, finances and schedule exceptions. An Administrador MUST NOT see "Configuración general".

#### Scenario: Administrador of one agency

- GIVEN M is Administrador of "La Brujita" only
- WHEN M signs in
- THEN M sees "La Brujita" and no other agency
- AND the sidebar has no "Configuración general"

#### Scenario: Owner who also works in an agency

- GIVEN A is owner of the group and also has an Empleado membership in "El 20"
- WHEN A opens "El 20"
- THEN A acts as owner (the higher access wins)

### Requirement: Moving an agency to another group

An owner MUST be able to move an agency to another group they also own, or to a group by one of its owners' email. The action MUST ask the user to type the agency's name. The agency's cash, fiados, finances and staff MUST move with it. The action MUST be logged in both groups.

#### Scenario: Selling an agency

- GIVEN owner A moves "Olavarría" to the group of owner Z
- WHEN A types "Olavarría" and confirms
- THEN "Olavarría" no longer appears for A
- AND it appears for Z with its full history
- AND it inherits the general schedule of Z's group unless it has personalized hours
