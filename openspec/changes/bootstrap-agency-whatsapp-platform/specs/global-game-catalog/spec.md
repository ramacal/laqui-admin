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

### Requirement: Province Pricing with Validity

Base products (official games) MUST be priced per province, because each provincial lottery sets them. Each price MUST have a "valid from" date; the price in effect at a moment is the latest one whose "valid from" has arrived. Platform admins MUST be able to schedule a future price, and past prices MUST be kept. For Quiniela the amount is the minimum per bet line.

#### Scenario: Scheduled price increase

- GIVEN Quini 6 in Buenos Aires costs $2500 valid from 2026-01-01
- AND a price of $3000 valid from 2026-12-01 was scheduled
- WHEN the price is resolved on 2026-11-30
- THEN it is $2500
- AND on 2026-12-01 it is $3000

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

