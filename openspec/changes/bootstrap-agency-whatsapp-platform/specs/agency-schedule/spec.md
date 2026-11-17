# agency-schedule Specification

## Purpose

Define agency opening hours: weekly hours, reusable schedule templates shared by several agencies, date-range exceptions, and the national holiday calendar used as a reference.

## Requirements

### Requirement: Weekly Opening Hours

An agency's weekly hours MUST support several time ranges per weekday (split shifts).

#### Scenario: Split shift

- GIVEN an agency open Monday 08:00–13:00 and 16:00–20:30
- WHEN the system checks Monday 14:00
- THEN the agency is closed
- AND at Monday 16:30 it is open

### Requirement: One General Schedule per Owner

Each owner MUST have at most one "general schedule" (weekly hours and exceptions). Their agencies MUST inherit it by default. Changing it MUST change every agency that still inherits it. The user MUST NOT have to manage several templates or pick one.

#### Scenario: One change, several agencies

- GIVEN La Brujita and Olavarría inherit the owner's general schedule
- WHEN the owner changes the general Saturday hours
- THEN both agencies use the new Saturday hours

### Requirement: Personalized Agency Schedule (copy on modify)

An agency MUST have at most one schedule of its own. Editing the weekly hours of an agency that inherits the general schedule MUST make it "personalized": the edited hours become its own and it stops following the general weekly hours. A personalized agency MUST be able to go back to the general schedule with one action, discarding its own weekly hours.

#### Scenario: Editing one agency personalizes it

- GIVEN El 20 inherits the general schedule
- WHEN the owner edits El 20's Sunday hours
- THEN El 20 is personalized with the edited hours
- AND a later change to the general schedule does not change El 20's hours

#### Scenario: Back to the general schedule

- GIVEN El 20 is personalized
- WHEN the owner chooses "volver al horario general"
- THEN El 20 inherits the general schedule again

### Requirement: Schedule Exceptions

Exceptions MUST cover a date range (one day or more) and MUST be either "closed" or "special hours" with one or more time ranges, plus an optional reason. Exceptions MAY belong to a template (apply to all its agencies) or to one agency. Agency admins MAY add exceptions to their agency; only owners change templates.

#### Scenario: Vacation range

- GIVEN the template has a "closed" exception from 2027-01-02 to 2027-01-15 with reason "Vacaciones"
- WHEN the system checks any agency using it on 2027-01-10
- THEN the agency is closed with reason "Vacaciones"

#### Scenario: Agency exception wins over the template

- GIVEN the template is closed on 2026-12-24
- AND Olavarría has a "special hours" exception on 2026-12-24 from 08:00 to 12:00
- WHEN the system checks Olavarría on 2026-12-24 at 10:00
- THEN Olavarría is open

### Requirement: Opening Resolution Order

To decide whether an agency is open at a given moment (in the agency's time zone), the system MUST use, in order: (1) the agency's exception for that date, (2) the template's exception for that date, (3) the weekly hours (the agency's own if it has no template, otherwise the template's).

### Requirement: National Holidays as Reference

The system MUST keep the official national holiday calendar (date, name, type: fixed, movable, bridge) synchronized from a public source. Holidays MUST NOT close agencies by themselves. Owners SHOULD be able to turn a holiday into a "closed" or "special hours" exception with one action, for a template or a single agency.

#### Scenario: Holiday without exception

- GIVEN 2026-12-25 is a national holiday
- AND the agency has no exception that day
- WHEN the system checks the agency on 2026-12-25 at 10:00
- THEN it uses the weekly hours
- AND it reports that the date is a holiday without an exception, so the panel can warn the owner

#### Scenario: Holiday turned into an exception

- GIVEN the owner clicks "Cerrar" next to "Navidad (25/12)" for the template
- THEN a "closed" exception for 2026-12-25 with reason "Feriado: Navidad" is created in the template
- AND it is linked to that holiday
