# province-quiniela-calendar Specification

## Purpose

Define province-level standard game availability, Quiniela lotteries, and the explicit daily Quiniela schedule.

## Requirements

### Requirement: Province Standard Availability

The system MUST allow each province to define which games are standardly available within that province.

#### Scenario: Province exposes standard games

- GIVEN a province is configured
- WHEN the system resolves available games for that province
- THEN it returns the province-standard game set

### Requirement: Province Lottery Availability

The system MUST define which Quiniela lotteries can be selected within a province.

#### Scenario: Province exposes lotteries for Quiniela

- GIVEN a province supports Quiniela
- WHEN the public Quiniela flow loads lottery choices
- THEN it returns only lotteries enabled for that province

### Requirement: Explicit Daily Quiniela Schedule

The system MUST publish Quiniela availability explicitly by day and by draw for each province.

#### Scenario: Daily draw schedule is resolved

- GIVEN a published monthly Quiniela program
- WHEN the system queries a specific province and date
- THEN it returns the enabled draws and times for that date

#### Scenario: A day can differ from the default pattern

- GIVEN one day has a different draw time or disabled draw
- WHEN the system queries that date
- THEN it returns that explicit day configuration instead of assuming defaults

### Requirement: Monthly Program Import Draft

The system MUST support a monthly Quiniela import workflow that produces a reviewable draft before publication.

#### Scenario: Draft exists before publish

- GIVEN an admin imports a monthly program
- WHEN the parsing process completes
- THEN the system stores a draft representation before publishing the final daily schedule


### Requirement: Lotteries per Draw

Each published draw MUST list the lotteries taking part that day, each with its official draw number. A lottery MUST NOT be offered in a draw it is not part of (e.g. Montevideo only in Matutina, Monday to Friday, and Nocturna).

#### Scenario: Montevideo on a Saturday

- GIVEN the published program has Montevideo in Matutina only from Monday to Friday
- WHEN the system lists Saturday's Matutina lotteries
- THEN Montevideo is not among them

### Requirement: Official Program Import (Buenos Aires)

The system MUST import Lotería de la Provincia's monthly program from the official PDF linked on its public site, reading the table by position (not by free text), and MUST create a new draft version only when the PDF changes. The draft MUST be checked (sequential draw numbers, Monday–Saturday days without draws, Sundays with draws) and compared with the weekly schedule published on the site; differences MUST be shown as warnings. An admin MUST be able to upload the PDF by hand when the download is not available. Publishing MUST archive the month's previous published version. Betting cutoff (minutes before the draw) and the maximum per lottery are province rules.

#### Scenario: Same PDF twice

- GIVEN November's program was imported
- WHEN the job downloads the same PDF again
- THEN no new version is created and the job reminds that it is pending publication if it is still a draft

### Requirement: Scheduled Jobs

Background tasks (program import, holiday sync, later results) MUST run on a cron schedule in Buenos Aires time from a worker process, and MUST be runnable by hand from the admin. Every run MUST be recorded with its trigger, status (ok, needs review, error), summary and error, and a job MUST NOT run twice at the same time.

#### Scenario: Run by hand

- GIVEN the platform admin opens "Tareas programadas"
- WHEN they press "Correr ahora" on the program import
- THEN the run is recorded as manual with its result, and the next scheduled run is unchanged
