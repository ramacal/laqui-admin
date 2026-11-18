# province-quiniela-calendar Specification

## Purpose

Define province-level standard game availability, Quiniela lotteries, and the Quiniela schedule as a usual week with date exceptions.

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

### Requirement: Weekly Quiniela Pattern

Each province MUST define its usual Quiniela week once: for every draw (La Previa, El Primero, Matutina, Vespertina, Nocturna), which lotteries take part, on which weekdays and at what time. Every entry MUST have a validity period (from, optional until), so a lottery joining or leaving a draw, or a new draw time, takes effect from a date without rewriting the past. The schedule MUST NOT be stored day by day.

#### Scenario: A lottery joins a draw

- GIVEN Matutina has Provincia, Ciudad, Córdoba and Santa Fe
- WHEN an admin adds Entre Ríos to Matutina, Monday to Saturday, from 2026-12-01
- THEN Matutina lists Entre Ríos from 2026-12-01 onwards and not before

#### Scenario: A lottery leaves a draw

- GIVEN Córdoba takes part in Vespertina
- WHEN an admin removes it from Vespertina from 2026-12-01
- THEN Vespertina no longer lists Córdoba from that date, and earlier dates still do

### Requirement: Date Exceptions

Days that differ from the usual week MUST be stored as exceptions on that date only: no draws at all, a draw not held, a lottery not taking part, a lottery taking part in a draw it usually does not, a different draw time, or a different prize expiry. Exceptions MUST record whether they came from the official program or were entered by hand.

#### Scenario: Holiday without draws

- GIVEN a Monday with no draws in the official program
- WHEN the system resolves that date
- THEN it returns no draws, while the other Mondays keep the usual week

#### Scenario: Daily draw schedule is resolved

- GIVEN the usual week and the exceptions of a province
- WHEN the system queries a specific date
- THEN it returns the draws, times, lotteries and draw numbers of that date, and whether the date is covered by a published official program

### Requirement: Calculated Draw Numbers and Prize Expiry

Draw numbers MUST be calculated, not stored per day: each lottery's number in a draw MUST advance by one on every date that draw is held, counted from the nearest known number (an anchor). Publishing an official program MUST store the month's first number of each lottery and draw as anchors. Prize expiry MUST be the draw date plus the province's expiry days, moved to the next business day (not Saturday, Sunday, a national holiday or a bridge day); dates where the official program says otherwise MUST be exceptions.

#### Scenario: Number after a holiday

- GIVEN Matutina Provincia was n.º 9040 on a Saturday and the following Monday has no draws
- WHEN the system resolves Tuesday
- THEN Matutina Provincia is n.º 9041

### Requirement: Lotteries per Draw

Each resolved draw MUST list the lotteries taking part that day, each with its official draw number. A lottery MUST NOT be offered in a draw it is not part of (e.g. Montevideo only in Matutina, Monday to Friday, and Nocturna).

#### Scenario: Montevideo on a Saturday

- GIVEN the usual week has Montevideo in Matutina only from Monday to Friday
- WHEN the system lists Saturday's Matutina lotteries
- THEN Montevideo is not among them

### Requirement: Monthly Program Import Draft

The system MUST support a monthly Quiniela import workflow that produces a reviewable draft before publication. The official program MUST be used as a check against the usual week, not copied: before publishing, the admin MUST see what would change (usual-week entries opened or closed from a date, date exceptions, draw number anchors and number jumps).

#### Scenario: Draft exists before publish

- GIVEN an admin imports a monthly program
- WHEN the parsing process completes
- THEN the system stores a draft and shows its differences with the usual week before anything changes

#### Scenario: A change that continues

- GIVEN the official program has Entre Ríos in Matutina on every Monday-to-Saturday date from 2026-12-01
- WHEN the admin publishes it
- THEN the usual week gets Entre Ríos in Matutina from 2026-12-01, instead of one exception per day

#### Scenario: A one-off difference

- GIVEN the official program has no Nocturna on one Saturday only
- WHEN the admin publishes it
- THEN only that Saturday gets an exception and the usual week is unchanged

### Requirement: Official Program Import (Buenos Aires)

The system MUST import Lotería de la Provincia's monthly program from the official PDF linked on its public site, reading the table by position (not by free text), and MUST create a new draft version only when the PDF changes. The draft MUST be checked (sequential draw numbers, Monday–Saturday days without draws, Sundays with draws) and compared with the weekly schedule published on the site; differences MUST be shown as warnings. An admin MUST be able to upload the PDF by hand when the download is not available. Publishing MUST archive the month's previous published version and replace the exceptions and anchors that version created; exceptions entered by hand are kept. Betting cutoff (minutes before the draw), prize expiry days and the maximum per lottery are province rules.

#### Scenario: Same PDF twice

- GIVEN November's program was imported
- WHEN the job downloads the same PDF again
- THEN no new version is created and the job reminds that it is pending publication if it is still a draft

### Requirement: Scheduled Jobs

Background tasks (program import, holiday sync, later results) MUST run on a cron schedule in Buenos Aires time from a worker process, and MUST be runnable by hand from the admin. Every run MUST be recorded with its trigger, status (ok, needs review, error), summary and error, and a job MUST NOT run twice at the same time.

Every job MUST have a type (Quiniela program, Quiniela results, national holidays), and province-level types MUST name their province and their source (the website they read). The handler MUST be chosen by type and source, so a new province or a second source is a new job of an existing type, not new code paths per job.

#### Scenario: Run by hand

- GIVEN the platform admin opens "Tareas programadas"
- WHEN they press "Correr ahora" on the program import
- THEN the run is recorded as manual with its result, and the next scheduled run is unchanged

#### Scenario: Program of another province

- GIVEN a reader exists for the official site of Santa Fe
- WHEN a "Quiniela program" job is added for Santa Fe with that source
- THEN it runs with the same program import flow as Buenos Aires and is listed under that type and province

#### Scenario: Run history

- GIVEN a job ran several times
- WHEN the admin opens the job
- THEN they see its configuration and every run with its trigger, duration, status, summary and, expanded, its warnings or error
