# agency-public-betting-flow Specification

## Purpose

Define agency-level public entry points, game visibility, operating availability, and the guided betting behavior shown to end users.

## Requirements

### Requirement: Public Agency Link

The system MUST expose a public route per agency.

#### Scenario: Agency landing exists

- GIVEN an agency has a public slug
- WHEN a user opens the agency URL
- THEN the system shows the agency public experience

### Requirement: Agency Game Visibility

The system MUST allow an agency to decide whether to expose each province-allowed game.

#### Scenario: Agency hides a province-allowed game

- GIVEN a province allows a game
- AND the agency marks it as hidden
- WHEN a user opens the agency link
- THEN the game does not appear in that agency public flow

### Requirement: Agency Operating Availability

The system MUST allow an agency to define weekly operating hours and date-specific exceptions.

#### Scenario: Agency is closed by exception

- GIVEN a valid province draw exists for today
- AND the agency has a closed exception for today
- WHEN a user reaches the public flow
- THEN the system marks betting as unavailable for that agency

### Requirement: Mobile-First Guided Flow

The public betting flow MUST be optimized for mobile-first guided completion.

#### Scenario: Mobile-first flow loads required controls

- GIVEN a user enters from a mobile device
- WHEN the public flow renders
- THEN the system presents touch-friendly, step-based controls

### Requirement: Quiniela Guided Capture

The Quiniela flow MUST guide users through draw selection, lottery selection, line creation, totals, and WhatsApp handoff.

#### Scenario: Quiniela line total is computed

- GIVEN a user has selected draws, lotteries, and one or more bet lines
- WHEN the summary is displayed
- THEN the system shows the resulting total before WhatsApp handoff

