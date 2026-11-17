# global-game-catalog Specification

## Purpose

Define the global source of truth for supported games, pricing, and game-level rules across the platform.

## Requirements

### Requirement: Global Game Definitions

The system MUST maintain each supported game as a global definition independent from any single agency.

#### Scenario: Supported MVP games exist globally

- GIVEN the platform is initialized
- WHEN an administrator queries supported games
- THEN the system exposes `Quiniela`, `Quini 6`, and `Loto Plus`

### Requirement: Global Pricing

The system MUST define the base price of each supported game at global scope.

#### Scenario: Global price is resolved for Loto Plus

- GIVEN `Loto Plus` is configured
- WHEN a public flow needs the base price
- THEN the system returns the global configured price

### Requirement: Global Rulesets

The system MUST define the behavioral rules of each game at global scope.

#### Scenario: Quiniela rules are not agency-defined

- GIVEN two agencies in the same or different provinces
- WHEN the system resolves Quiniela behavior
- THEN it uses the same global Quiniela rule set

#### Scenario: Loto Plus complete mode is global

- GIVEN `Loto Plus` is active
- WHEN the public flow resolves default mode
- THEN the system uses the global complete-mode definition

