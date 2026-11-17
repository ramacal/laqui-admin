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

### Requirement: Official Price with Validity

Each base product (official game) MUST have an official price history. Each price MUST have a "valid from" date; the price in effect at a moment is the latest one whose "valid from" has arrived. Platform admins MUST be able to schedule a future price once for every province, and past prices MUST be kept. For Quiniela the amount is the minimum per bet line.

#### Scenario: Scheduled price increase, once for the whole country

- GIVEN Quini 6 costs $2500 officially valid from 2026-01-01
- AND an official price of $3000 valid from 2026-12-01 was scheduled
- WHEN the price is resolved in Buenos Aires or Santa Fe on 2026-11-30
- THEN it is $2500
- AND on 2026-12-01 it is $3000 in both

### Requirement: Province Price Override (copy on modify)

A platform admin MUST be able to set a province's own price for a game. From then on that province uses its own price history and changes to the official price no longer affect it. The official price in effect at that moment MUST be kept as the province's starting price, so the game stays on sale until a scheduled own price starts. The admin MUST be able to return the province to the official price with one action.

#### Scenario: Province with its own Quiniela minimum

- GIVEN Quiniela's official minimum is $100
- WHEN the admin sets Santa Fe's own minimum to $150 from today
- THEN Santa Fe uses $150 and Buenos Aires keeps $100
- AND a later official change to $120 does not change Santa Fe

#### Scenario: Back to the official price

- GIVEN Santa Fe has its own Quiniela price
- WHEN the admin chooses "volver al precio oficial"
- THEN Santa Fe uses the official price again

#### Scenario: No price yet

- GIVEN a base product offered in a province with no price in effect
- WHEN an agency catalog is built
- THEN that product is not offered for sale

### Requirement: Base Product Availability

A base product MUST be offered at an agency only when it is active globally, enabled in the agency's province, visible in the agency, and has a price in effect.

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

