# agency-administration Specification

## Purpose

Define the administrative identity of an agency (its official file number) and the people who work in it.

## Requirements

### Requirement: Agency File Number

Each agency MUST have a file number ("número de legajo") assigned by the provincial lottery. The file number MUST be unique within the agency's province.

#### Scenario: Duplicate file number in the same province is rejected

- GIVEN an agency with file number `1234` exists in Santa Fe
- WHEN an administrator creates another Santa Fe agency with file number `1234`
- THEN the system rejects it

#### Scenario: Same file number in different provinces is allowed

- GIVEN an agency with file number `1234` exists in Santa Fe
- WHEN an administrator creates a Córdoba agency with file number `1234`
- THEN the system accepts it

### Requirement: Agency Employees

The system MUST let an agency register its employees with first name, last name, CUIL, phone number, and home address. Each employee MUST have an agency role: owner ("dueño"), agency admin, or employee.

#### Scenario: Employee is registered

- GIVEN an agency exists
- WHEN an administrator registers an employee with name, CUIL, phone, and address
- THEN the employee is stored and linked to that agency

### Requirement: CUIL Uniqueness per Agency

The CUIL MUST be stored as 11 digits without separators and MUST be unique within an agency. The same person MAY be registered in more than one agency.

#### Scenario: Same CUIL twice in one agency is rejected

- GIVEN an employee with a CUIL exists in an agency
- WHEN another employee with the same CUIL is registered in that agency
- THEN the system rejects it

### Requirement: Employee Deactivation

The system MUST deactivate employees who leave instead of deleting them, so their history is kept. Deactivating MUST record the exit date ("fecha de egreso"), which MUST NOT be earlier than the hire date. A deactivated employee with a linked login MUST lose access to that agency.

#### Scenario: Former employee is kept with exit date

- GIVEN an active employee hired on 2015-10-26
- WHEN the agency deactivates the employee with exit date 2026-11-30
- THEN the employee remains stored as inactive with that exit date
- AND no longer sees the agency in the panel

#### Scenario: Exit date before hire date is rejected

- GIVEN an employee hired on 2015-10-26
- WHEN someone sets the exit date to 2014-01-01
- THEN the system rejects it

### Requirement: Employee Work and Social Media Data

The system SHOULD store each employee's job title ("puesto"), shift ("turno"), notes, public name for social media, and photo. Appearing on social media MUST require a recorded consent with its date ("permiso firmado").

#### Scenario: Employee without consent is not published

- GIVEN an employee without recorded social media consent
- WHEN content is prepared for the agency's social media
- THEN that employee is not offered for publication

### Requirement: Access Profiles

The system MUST support four access profiles:

- **Platform admin**: manages the whole platform (games, provinces, calendars, all agencies). It belongs to the user, not to any agency.
- **Agency owner** ("dueño"): full control of their agency, including its admins and employees.
- **Agency admin**: manages daily operation (orders, receipts, schedule, game visibility) and MUST NOT manage owners.
- **Agency employee**: works only with orders and receipts of their agency.

Agency roles MUST be scoped to one agency. A user MAY hold roles in several agencies.

#### Scenario: Owner of two agencies

- GIVEN a user is owner of agency A and agency B
- WHEN the user signs in
- THEN the user can manage both agencies

#### Scenario: Employee cannot see another agency

- GIVEN a user is an employee of agency A only
- WHEN the user tries to open agency B orders
- THEN the system denies access

#### Scenario: Agency admin cannot remove the owner

- GIVEN a user is admin of agency A
- WHEN the user tries to deactivate the owner of agency A
- THEN the system denies the action

### Requirement: Optional Login per Employee

An employee record MAY exist without a login (data only). Linking it to a user account grants access according to its role.

#### Scenario: Employee without login

- GIVEN an employee was registered without a user account
- WHEN someone tries to sign in as that employee
- THEN no access is possible until a user account is linked

### Requirement: Google Sign-In

Users MUST sign in with their Google account (SSO). The first sign-in MUST create the user account. A new user without a platform profile or an agency membership MUST see that they have no access yet.

#### Scenario: Employee gains access by email

- GIVEN an owner registered an employee with email `ana@gmail.com`
- WHEN Ana signs in with Google as `ana@gmail.com`
- THEN her user is linked to that employee record and she sees the agency with her role

#### Scenario: Unknown Google user

- GIVEN no employee record has the email `x@gmail.com`
- WHEN that person signs in with Google
- THEN the account is created but the panel shows no agency access

### Requirement: Owner Is the License Holder

Each agency MUST have exactly one active owner in its staff, and that owner MUST be the license holder ("titular") registered with the provincial lottery. The agency MUST NOT store the holder's name separately.

#### Scenario: Staff list shows the titular as owner

- GIVEN La Brujita's license holder is "Pérez, Ana María"
- WHEN an owner or admin opens the agency staff list
- THEN Ana María Pérez appears with the role "Dueño"

### Requirement: Owner Email Assignment

A platform admin MUST be able to assign or change the owner's email. When a person signs in with Google using that email, the agency MUST appear in their panel with the owner role. Changing the email MUST remove access from the previous login.

#### Scenario: Owner signs in for the first time

- GIVEN a platform admin assigned `titular@gmail.com` to La Brujita's owner
- WHEN that person signs in with Google as `titular@gmail.com`
- THEN La Brujita appears in their panel as "Dueño"

#### Scenario: Owner email is changed

- GIVEN La Brujita's owner email is linked to a login
- WHEN the platform admin changes it to another email
- THEN the previous login no longer sees La Brujita
- AND the new email gets access on its next sign-in (or immediately if that user already exists)

#### Scenario: Only platform admins assign owners

- GIVEN a user who is owner or admin of an agency but not platform admin
- WHEN the user tries to change the owner email
- THEN the system denies the action
