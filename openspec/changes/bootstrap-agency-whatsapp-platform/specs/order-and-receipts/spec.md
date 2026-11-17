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

