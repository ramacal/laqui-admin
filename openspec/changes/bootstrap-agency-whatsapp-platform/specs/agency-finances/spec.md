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

### Requirement: Cash Sessions per Shift

Each agency MUST record its cash per shift ("caja"): one per day as a single shift, or two (morning and afternoon). The agency MUST set how many it uses per day (1 or 2) to suggest the shift; a day MUST NOT mix a single shift with morning/afternoon, and there MUST be at most one session per agency, date and shift.

#### Scenario: Two shifts

- GIVEN La Brujita works with 2 cash sessions per day
- WHEN the morning session of 2026-11-18 is open
- THEN another morning session for that day is rejected
- AND an afternoon session can be opened

#### Scenario: Single shift on Saturday

- GIVEN a single-shift session exists on Saturday
- WHEN someone opens a morning session that Saturday
- THEN the system rejects it

### Requirement: Cash Session Lifecycle

Any staff member of the agency MUST be able to open a session with an opening cash amount (suggested: the counted cash of the previous session), record its movements (customer payments by payment method, prize payouts, small expenses), and close it with the counted cash. Closing MUST show the totals per payment method, prizes paid, expected cash (opening + cash in − cash out) and the difference with the counted cash. A non-zero difference MUST be recorded as a cash adjustment so the cash balance matches reality. A closed session MUST NOT change; only owners and agency admins may reopen it, which cancels its adjustment.

#### Scenario: Close with a difference

- GIVEN a session opened with $20.000 in cash
- AND $50.000 cash payments and $15.000 cash prizes were recorded
- WHEN it is closed with $54.000 counted
- THEN expected cash is $55.000, the difference is −$1.000
- AND a −$1.000 cash adjustment linked to the session is recorded

#### Scenario: Movements go to their payment method

- GIVEN an open session
- WHEN a $3.000 payment by Mercado Pago is recorded
- THEN the Mercado Pago balance increases by $3.000 and the expected cash does not change

### Requirement: Daily Lotería Settlement Ticket

Every day the Lotería terminal prints a settlement ticket with a due date ("VTO"), a net amount, whether it will be debited from or credited to the agency's savings account, the account number, and the print date and time. The owner or an agency admin MUST be able to load it once per agency and issue date, with an optional photo stored privately. Loading it MUST create one movement in the agency's bank account dated on the due date (Lotería debit or credit); editing it MUST update that movement and voiding it MUST void the movement. If the account number differs from the agency's bank account, the system MUST warn before saving. Until the due date, it MUST be shown as an upcoming debit or credit.

#### Scenario: Debit loaded from the ticket

- GIVEN a ticket printed on 2026-11-17 for $450.000,00 to be debited on 2026-11-18
- WHEN the admin loads it
- THEN the bank account shows "Próximo débito: $450.000,00 el 18/11"
- AND from 2026-11-18 its balance includes the debit

#### Scenario: Same day loaded twice

- GIVEN the 2026-11-17 ticket of La Brujita was loaded
- WHEN someone loads another ticket for La Brujita issued on 2026-11-17
- THEN the system rejects it

#### Scenario: Missing tickets are flagged

- GIVEN no ticket was loaded for a weekday in the last two weeks
- WHEN the settlements list is shown
- THEN that day is flagged as missing
