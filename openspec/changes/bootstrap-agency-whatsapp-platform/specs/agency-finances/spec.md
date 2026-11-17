# agency-finances Specification

## Purpose

Track where each agency's money is (its bank account, cash, digital wallets, card terminals), the movements in and out (including Lotería settlements), and the resulting balances, for the agency and as totals for the owner.

## Requirements

### Requirement: Payment Methods per Agency

Each agency MUST have its own list of payment methods ("medios de cobro"). A payment method MUST belong to exactly one agency. Types: cash, bank account, digital wallet (Mercado Pago, Cuenta DNI, MODO…), card terminal, other. Each type MUST store its own fields (bank, holder, CBU/CVU, alias, provider, merchant/terminal number) plus a free reference for the owner. An agency MUST have exactly one bank account.

#### Scenario: Defaults for every agency

- GIVEN a new agency
- WHEN its finances are first used
- THEN it has a "Efectivo" cash method and its bank account method

#### Scenario: Owner adds Mercado Pago

- GIVEN La Brujita
- WHEN the owner adds a digital wallet "Mercado Pago" with alias "agencia.brujita"
- THEN it appears among La Brujita's payment methods with its own balance

#### Scenario: Second bank account is rejected

- GIVEN La Brujita already has its bank account
- WHEN someone adds another bank account to La Brujita
- THEN the system rejects it

### Requirement: Opening Balance and Calculated Balance

Each payment method MUST have an opening balance at a date. Its balance at any date MUST be calculated as opening balance + money in − money out of non-voided movements up to that date; it MUST NOT be stored, so it never drifts.

#### Scenario: Balance after movements

- GIVEN cash opened with $10.000 on 2026-11-01
- AND $5.000 came in and $3.000 went out afterwards
- WHEN the balance is shown
- THEN it is $12.000

### Requirement: Movements

Agency owners and admins MUST be able to record movements: date, amount, in or out, type (Lotería debit, Lotería credit, customer payment, prize payout, expense, adjustment, other), description, reference (e.g. settlement number), and origin (manual now; Lotería ticket and cash closing later). Movements MUST NOT be deleted: a wrong movement is voided and stays visible as voided.

#### Scenario: Voided movement

- GIVEN a $3.000 expense recorded by mistake
- WHEN it is voided
- THEN the balance no longer includes it
- AND it remains in the history marked as voided

### Requirement: Transfers between Payment Methods

Moving money between two payment methods of the same agency (e.g. depositing cash in the bank, withdrawing Mercado Pago to the bank) MUST be recorded as one transfer: money out of one and into the other, linked together, without changing the agency's total.

#### Scenario: Cash deposited in the bank

- GIVEN cash $50.000 and bank $100.000
- WHEN $20.000 is transferred from cash to the bank
- THEN cash is $30.000, bank is $120.000, and the agency total stays $150.000

### Requirement: Access and Owner Totals

Finances MUST be visible only to the agency's owner and admins (and platform admins). The owner MUST see the totals of all their agencies.

#### Scenario: Employee cannot see finances

- GIVEN a user who is an employee of La Brujita
- WHEN they open La Brujita's finances
- THEN the system denies access
