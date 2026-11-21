# social-content Specification

## Purpose

Help each agency post daily on social networks: a bank of yearly ideas with numbers to play, the traditional meaning of the Quiniela numbers, and branded pictures with an editable caption.

## Requirements

### Requirement: Yearly Idea Bank

The system MUST keep ideas that repeat every year, each with day, month, an optional origin year, a kind (patriotic date, birth, death, commemoration, event), a scope (country or one province) and tags. An idea MUST be loaded once and serve every year.

#### Scenario: Same idea, next year

- GIVEN the idea "Vuelta de Obligado", 20/11, origin year 1845
- WHEN an agency looks at 20/11/2026
- THEN it sees "181 años"
- AND on 20/11/2027 it sees "182 años" without anyone editing the idea

#### Scenario: Province scope

- GIVEN an idea scoped to province B
- THEN agencies of province B see it
- AND agencies of other provinces do not

### Requirement: Numbers to Play

For a given year the system MUST derive the numbers of an idea: years elapsed (2 and 3 digits), day, month, day+month (4 digits) and origin year (3 and 4 digits), plus the idea's fixed extra numbers (for example a jersey number), each with its reason.

#### Scenario: Birthday numbers

- GIVEN a person born 24/06/1987 and extra number 10 "camiseta"
- WHEN viewed in 2026
- THEN the numbers include 39 "cumple 39 años", 24 "día", 06 "mes", 2406 "fecha", 1987 "año" and 10 "camiseta"

### Requirement: Meaning of the Numbers

The system MUST keep the traditional meaning of each number 00–99. A meaning marked not usable MUST NOT appear on pictures or captions.

#### Scenario: Meaning next to a number

- GIVEN 48 means "el muerto que habla"
- WHEN an idea's numbers include 48
- THEN the idea shows "48 · el muerto que habla"

### Requirement: Agency Social Accounts

An agency MAY record one account per network (Instagram first) with the handle and the email registered on that account. Passwords MUST NOT be stored. Only owners, agency admins and platform admins MAY edit them.

#### Scenario: Handle on the picture

- GIVEN the agency's Instagram handle is "@labrujita"
- WHEN a picture is rendered
- THEN it shows "@labrujita"

### Requirement: Official Lotteries

The platform MUST keep the official lotteries as country → province/state/jurisdiction → organism. A lottery MUST belong to one country and MAY belong to one jurisdiction (none = a national lottery). A jurisdiction MUST have at most one official lottery. Platform admins MUST be able to create, edit, deactivate and delete lotteries (name, organism, website, logo, colors, whether Laqui offers its Quiniela draws). A lottery that has draws, results or provinces offering it MUST NOT be deleted, only deactivated, and its code MUST NOT change.

#### Scenario: One lottery per jurisdiction

- GIVEN Buenos Aires already has "Lotería de la Provincia"
- WHEN an admin creates another lottery for Buenos Aires
- THEN the system rejects it and names the existing one

#### Scenario: Lottery in use

- GIVEN the lottery "Provincia" has Quiniela draws
- WHEN an admin tries to delete it
- THEN the system refuses and offers to deactivate it

### Requirement: Lottery Brand

Pictures MUST show the logo of the active official lottery of the agency's province when it has one, and MUST use that lottery's colors when the agency has no color of its own.

### Requirement: Branded Picture

For an idea and a date the system MUST render a picture in story (1080×1920), feed (1080×1350) and square (1080×1080) sizes with the headline, the main number and its meaning, the agency logo and name, the Instagram handle, the province logo and a responsible-gaming line. The user MAY change the headline before downloading.

#### Scenario: Edited headline

- GIVEN the suggested headline "Hoy se cumplen 181 años de la Vuelta de Obligado"
- WHEN the user changes it and downloads the story
- THEN the picture shows the edited headline

### Requirement: Editable Caption

The system MUST suggest a caption for each idea and let the user edit and copy it. It MUST also offer a ready prompt (idea, numbers, agency, tone) to paste into the user's own AI chat. The system MUST NOT call an AI service.
