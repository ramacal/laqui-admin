# owner-products Specification

## Purpose

Let agency owners sell their own products (raffles, ticket fractions, scratch cards, agency draws) alongside the official games, with simple loading: one list per owner, offered in the agencies they choose.

## Requirements

### Requirement: Owner Product List

An owner MUST be able to create products in a single list of their own: name, optional description and photo, unit price, active flag, and an optional availability window (from / until). Products MUST belong to the owner, not to a single agency.

#### Scenario: Owner loads a raffle once

- GIVEN an owner of four agencies
- WHEN they create "Rifa de fin de año" at $2000
- THEN the product exists once in their list

### Requirement: Offer per Agency

For each product the owner MUST choose the agencies where it is offered (one, several, or all of their agencies). A product exclusive to one agency is a product offered only there.

#### Scenario: Product only in one agency

- GIVEN "Sorteo de La Brujita" is offered only in La Brujita
- WHEN El 20's catalog is built
- THEN that product is not in it

### Requirement: Unit Price with Validity

Owner product prices MUST have a "valid from" date, like base products. The owner MAY schedule a future price; past prices MUST be kept.

#### Scenario: Price change from a date

- GIVEN "Raspadita" costs $500 valid from 2026-11-01
- AND $600 valid from 2026-12-15
- WHEN a customer orders on 2026-12-20
- THEN the unit price is $600

### Requirement: Availability over Time

A product MUST only be offered when it is active, today is within its availability window (if set), and it has a price in effect.

#### Scenario: Raffle after its draw

- GIVEN "Rifa de fin de año" is available until 2026-12-31
- WHEN the catalog is built on 2027-01-02
- THEN the raffle is not offered

### Requirement: Ordered by Quantity

Customers MUST order owner products by quantity; the order MUST store the unit price in effect at that moment.

#### Scenario: Two units

- GIVEN "Rifa de fin de año" costs $2000
- WHEN a customer orders 2 units
- THEN the order line is 2 × $2000 = $4000 and keeps $2000 even if the price changes later

### Requirement: Sale Mode of Owner Products

Owner products MUST also say whether they are physical (counted in the cash register, the default) or not.

#### Scenario: Raffle counted in the cash register

- GIVEN "Rifa de fin de año" is a physical owner product offered in La Brujita
- WHEN La Brujita's cash session is closed
- THEN the raffle has its own line counted by quantity
