# agency-google-drive Specification

## Purpose

Let each agency keep its pictures in its own Google Drive: a folder `laqui/{agencia}` that Laqui creates, shares with the agency's staff and fills with the pictures saved from the post editor.

## Requirements

### Requirement: Separate Drive Connection

Owners, agency admins and platform admins MUST be able to connect one Google account per agency through an OAuth flow that is separate from the Laqui sign-in. The flow MUST request only the `drive.file` scope, offline access, and MUST let the user pick any Google account (account chooser and consent every time). Employees MUST NOT connect or disconnect.

#### Scenario: Connect the social media account

- GIVEN Marta, owner of "Agencia La Esquina", signed in to Laqui as marta.titular@example.com
- WHEN she clicks "Conectar Google Drive" and picks laesquina.redes@example.com
- THEN the agency is connected to laesquina.redes@example.com
- AND her Laqui sign-in is still marta.titular@example.com

#### Scenario: Employee cannot connect

- GIVEN Juan is an employee of the agency
- THEN he does not see "Conectar Google Drive"
- AND opening the connect URL by hand is refused

#### Scenario: Forged callback

- GIVEN a callback whose state was not issued to this browser and user, or is older than 10 minutes
- THEN no connection is stored
- AND the user sees "No se pudo conectar"

#### Scenario: Drive permission unchecked

- GIVEN the user unchecks the Drive permission on Google's consent screen
- THEN no connection is stored
- AND the user is told to accept the Drive permission

### Requirement: Token Protection

The refresh token MUST be stored encrypted at rest (AES-256-GCM) with a key that is not in the database, bound to its agency. Laqui MUST NOT store access tokens in the database.

#### Scenario: Token copied to another agency

- GIVEN an encrypted token copied from agency A's row into agency B's row
- THEN decrypting it for agency B fails

### Requirement: Agency Folder

On connect the system MUST create the folder `laqui/{agencia}` at the root of the connected Drive. When the same Google account already has a `laqui` folder created by Laqui (for another agency or an earlier connection), it MUST be reused instead of creating a second one. Reconnecting the same account for the same agency MUST reuse its agency folder.

#### Scenario: Two agencies, one account

- GIVEN "Agencia La Esquina" is connected with redes@example.com
- WHEN "Agencia El Trébol" connects with redes@example.com
- THEN that Drive has one `laqui` folder with `agencia-la-esquina` and `agencia-el-trebol` inside

#### Scenario: Different account

- GIVEN the agency was connected with cuenta1@example.com
- WHEN it connects with cuenta2@example.com
- THEN a new `laqui/{agencia}` is created in cuenta2's Drive
- AND nothing in cuenta1's Drive is touched

### Requirement: Staff Access

The agency folder MUST be shared (one level, writer) with the email of every active employee of the agency that has an email, except the connected account itself. Access MUST be added when an employee is hired, reactivated or gets an email, and removed when they leave, are deactivated or lose the email. The system MUST remove only permissions it created; a permission that already existed when Laqui tried to share MUST be recorded as manual and never removed. The agency page MUST show who has access, who got it by hand, who could not get it (and why), and who has no email.

#### Scenario: Hire

- GIVEN the agency is connected
- WHEN Lucía Gómez (lucia@example.com) is loaded as an active employee
- THEN lucia@example.com gets writer access to `laqui/{agencia}`
- AND the card lists her under "Con acceso"

#### Scenario: Leave

- GIVEN Laqui shared the folder with lucia@example.com
- WHEN Lucía is deactivated
- THEN that permission is removed

#### Scenario: Access given by hand

- GIVEN the owner shared the folder from Drive with pedro@example.com before Laqui did
- WHEN Pedro is deactivated
- THEN Pedro keeps the access the owner gave him

#### Scenario: No email

- GIVEN Carlos is active and has no email
- THEN the card lists him under "Sin email: no pueden recibir acceso"

#### Scenario: Not a Google account

- GIVEN an employee's email has no Google account and Google refuses the share
- THEN the other employees still get access
- AND the card lists that employee with "No se pudo compartir"

### Requirement: Folder Layout

Inside `laqui/{agencia}` the system MUST separate files by purpose and then by month. Social media files (pictures, and reels later) go to `redes/{yyyy}/{mm-mes}/`, and reports (cash closings, settlements, fiados) go to `reportes/{yyyy}/{mm-mes}/`. The month comes from the date the file is about, not the day it is saved. Section, year and month folders MUST be created only when a file needs them.

#### Scenario: A report and a picture of the same month

- GIVEN the agency is connected
- WHEN a picture for 20/11/2026 and a report for November 2026 are saved
- THEN the picture is in `laqui/{agencia}/redes/2026/11-noviembre/`
- AND the report is in `laqui/{agencia}/reportes/2026/11-noviembre/`

### Requirement: Save Picture to Drive

Anyone with access to the agency MUST be able to save the picture being edited (selected format, date and title) to `laqui/{agencia}/redes/{yyyy}/{mm-mes}/` (for example `redes/2026/11-noviembre`, from the picture's date), creating the section, year and month folders when missing, and MUST get the link to the saved file. When the agency is not connected, the editor MUST say so instead of offering the button.

#### Scenario: Save a story

- GIVEN the agency is connected and an idea for 20/11/2026 in "Historia / reel"
- WHEN the user clicks "Guardar en Drive"
- THEN a PNG named like `2026-11-20-vuelta-de-obligado-historia.png` is in `laqui/{agencia}/redes/2026/11-noviembre/`
- AND the editor shows "Abrir en Drive"

### Requirement: Expired or Revoked Access

When Google rejects the refresh token (expired, revoked, or Drive permission removed), the system MUST mark the connection as needing reconnection, stop calling Drive for it, and show "Reconectar" on the agency page and a notice on the post editor.

#### Scenario: Revoked from Google account settings

- GIVEN the agency removed Laqui from its Google account's third-party access
- WHEN someone clicks "Guardar en Drive"
- THEN the upload fails with "Hay que reconectar Google Drive"
- AND the agency page shows the connection as needing reconnection

### Requirement: Disconnect

Owners, agency admins and platform admins MUST be able to disconnect Drive. Disconnecting MUST delete the stored token and revoke it at Google unless another agency is connected with the same Google account (revoking ends the whole grant of that account). The folder, files and shares MUST stay in the agency's Drive.

#### Scenario: Disconnect

- GIVEN the agency is connected and no other agency uses that account
- WHEN the owner clicks "Desconectar"
- THEN the token is revoked and deleted
- AND `laqui/{agencia}` and its files remain in that Drive
