# order-and-receipts Specification

## Purpose

Define customer identification, persisted betting orders, WhatsApp intent generation, and receipt upload behavior.

## Requirements

### Requirement: Customer Registration by WhatsApp

The system MUST identify customers primarily by WhatsApp number.

#### Scenario: Existing customer is reused

- GIVEN a customer already exists for a WhatsApp number
- WHEN that number is submitted again
- THEN the system reuses the existing customer record

### Requirement: Persisted Order Before WhatsApp

The system MUST persist the order and its items before opening WhatsApp.

#### Scenario: Order exists before handoff

- GIVEN a user is ready to send a valid bet
- WHEN the handoff is requested
- THEN the system has already persisted the customer, order, and order items

### Requirement: WhatsApp Intent Generation

The system MUST generate a structured WhatsApp message directed to the agency destination number.

#### Scenario: WhatsApp intent is generated

- GIVEN an agency and valid order
- WHEN the system creates the handoff
- THEN it returns a message and destination URL for WhatsApp

### Requirement: Receipt Upload Lifecycle

The system MUST support uploading and associating a payment receipt with an existing order.

#### Scenario: Receipt is attached to order

- GIVEN an order exists
- WHEN a user uploads a receipt image
- THEN the system stores the receipt and links it to that order


### Requirement: Bet Ticket Photo (tentative)

> Tentative: confirm with agencies how the printed ticket is delivered before building the UI.

After loading a bet, the agency SHOULD be able to upload a photo of the printed lottery ticket ("boleta") and link it to the order, so the customer receives proof of play. An order MAY have more than one ticket photo (one per draw or lottery).

#### Scenario: Agency sends the ticket photo

- GIVEN an order whose payment receipt was reviewed
- WHEN an agency employee uploads the photo of the printed ticket
- THEN the system stores it privately, links it to the order, and records who uploaded it

### Requirement: Private File Storage

Payment receipts and ticket photos MUST be stored privately and MUST only be viewable through short-lived signed links generated for users with access to that agency.

#### Scenario: Receipt link from another agency is denied

- GIVEN a user who is an employee of agency A only
- WHEN the user requests a receipt of agency B
- THEN the system does not generate a link
