# quiniela-results Specification

## Purpose

Know the official result (the 20 prizes) of every Quiniela draw the agencies sell, reading it from several websites and trusting it only when the sources agree. No official results API exists: the sources are the official sites of the lotteries and well-known result sites.

## Requirements

### Requirement: Readings per Source

The system MUST store what each source published for a draw (date, draw slot, lottery, the 20 numbers in order, letters when published) separately from the consolidated result, with when it was read and by which job run. A later reading from the same source for the same draw MUST replace the previous one and keep when it changed.

#### Scenario: Two sources read the same draw

- GIVEN the Santa Fe official site and Jugando Online both publish Provincia Matutina of 2026-11-17
- WHEN their jobs run
- THEN there are two readings for that draw, one per source

### Requirement: Consolidated Result

For each draw (date, slot, lottery) the system MUST keep one result with a status:

- **Confirmed**: all readings agree on the 20 numbers and either at least two sources read it or one of them is official for that lottery.
- **Pending**: a single non-official source read it.
- **In conflict**: sources disagree on any of the 20 numbers.

A conflict MUST be resolved by an admin choosing one of the published versions; the decision MUST be recorded with who made it. Only confirmed results MAY be used to compute prizes or be shown as results.

#### Scenario: Aggregator alone

- GIVEN only notitimba read Montevideo Nocturna
- WHEN the result is consolidated
- THEN it is pending until another source agrees

#### Scenario: Sources disagree

- GIVEN the official site says prize 7 is 7528 and another source says 7258
- WHEN the result is consolidated
- THEN it is in conflict, the screen shows that position for each source, and an admin can choose the right one

### Requirement: Respect each Source

Readers MUST identify themselves, read at a moderate pace and follow each site's published rules (robots.txt crawl delay and visit window). A source that publishes the latest draws without a date MUST only be accepted when its date can be established (e.g. cross-checked with the same site's dated page).

#### Scenario: Visit window

- GIVEN notitimba's robots.txt asks for one request per minute between 02:00 and 07:45
- WHEN its job runs
- THEN it runs at night, waits a minute between requests and only asks for draws still not confirmed
