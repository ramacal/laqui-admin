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

