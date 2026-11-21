# Design: Google Drive de la agencia

## Decisions

| Decision | Rationale |
|----------|-----------|
| Scope `drive.file` only | Non-sensitive scope: no Google security audit. The app can create folders, upload, share and list permissions of its own files, which is all we need. |
| OAuth flow of our own, not Better Auth | The Drive account is often not the sign-in account; Better Auth would link it to the user, not the agency. Same `GOOGLE_CLIENT_ID`/`SECRET`, one more redirect URI. |
| `prompt=select_account consent`, `access_type=offline` | Always lets the user choose the account, and always returns a refresh token. |
| Account email from Drive `about.get` | Keeps the scope list to `drive.file` (no `openid email`). `about.user.permissionId` is the stable account id. |
| Plain `fetch` against Drive REST v3 | Five endpoints; the `googleapis` SDK is large and adds nothing here. |
| No service account | Service accounts have no Drive quota; files must live in the agency's Drive. |
| Shares role in one constant `DRIVE_SHARE_ROLE = "writer"` | One level for everyone, easy to change. |
| Disconnect keeps the row (status `DISCONNECTED`, token deleted) | Reconnecting the same account reuses the folder and knows which shares Laqui created. |

## Model

- `AgencyDriveConnection` (one per agency, `agencyId` unique): `googleEmail`, `googleAccountId` (Drive `permissionId`), `refreshTokenEnc` (nullable; text), `rootFolderId` (`laqui`), `folderId` (`laqui/{agencia}`), `status` (`ACTIVE`, `NEEDS_RECONNECT`, `DISCONNECTED`), `lastError`, `connectedById` → User (SetNull), `connectedAt`, `lastSyncedAt`, timestamps.
- `AgencyDriveShare`: `connectionId` (cascade), `employeeId?` → AgencyEmployee (SetNull), `email`, `state` (`SHARED` = created by Laqui, `MANUAL` = already there, `FAILED`), `permissionId?` (only for `SHARED`), `role`, `error?`; unique `(connectionId, email)`.

## Token encryption (`src/lib/drive/crypto.ts`)

`DRIVE_TOKEN_KEY`: 32 random bytes, base64url, in env. AES-256-GCM, 12-byte random IV, the agency id as additional authenticated data. Stored as `v1.{iv}.{tag}.{ciphertext}` (base64url). Access tokens are kept only in memory (per connection, until 1 minute before expiry).

## OAuth flow

```
Agency page ──"Conectar Google Drive"──▶ GET /api/drive/connect?agencia={id}
   checks role (owner/admin/platform admin)
   state = base64url({agencyId, userId, nonce, exp}) + "." + HMAC
   cookie laqui_drive_nonce = nonce (httpOnly, sameSite=lax, 10 min, path /api/drive)
   302 → accounts.google.com (scope drive.file, offline, select_account consent)
Google ──▶ GET /api/drive/callback?code&state
   verify HMAC, exp, cookie nonce, signed-in user = state.userId, role still allowed
   POST oauth2.googleapis.com/token → refresh_token (must include drive.file in scope)
   GET drive/v3/about?fields=user → email, permissionId
   connect(): folders + save encrypted token + syncAccess()
   302 → /panel/agencias/{id}?drive=conectado | ?drive=error-{code}
```

The HMAC key is derived from `DRIVE_TOKEN_KEY` (`sha256("state:" + key)`), so there is a single secret. Redirect URI: `{NEXT_PUBLIC_APP_URL}/api/drive/callback`.

## Folders

`laqui`: first the `rootFolderId` of another connection with the same `googleAccountId` (if still there and not trashed), then a search `name='laqui' and 'root' in parents and folder and not trashed` (with `drive.file` the search only sees Laqui's own files), else create. Agency folder: the previous `folderId` when the same account reconnects, else search by name inside `laqui` (the agency's `slug`), else create. Section, year and month folders: search by name inside the parent, else create (`redes`, `2026`, `11-noviembre`).

## Sharing sync (`syncDriveAccess(agencyId)`)

Desired = active employees with an email, lowercased, minus the connected account. Current = `AgencyDriveShare` rows + `permissions.list` of the folder.

- Desired, no row: if the folder already has a permission for that email → row `MANUAL`; else `permissions.create` (type user, role writer, Google sends the invitation) → row `SHARED` with the permission id; on Google error → row `FAILED` with the message (retried next sync).
- Desired, row `SHARED` whose permission disappeared: create again (Laqui's staff list rules).
- Row not desired: `SHARED` → `permissions.delete` (404 is fine) then delete row; `MANUAL`/`FAILED` → delete row only.

Called from: connect, `assignOwnerEmail`, the end of `npm run agencies:import`, and "Sincronizar accesos" on the card. A future staff editor MUST call it after each change. Sync failures never block the staff change itself.

## Upload

`src/lib/content/picture.ts` builds the picture of an idea (`ideaPicture(agencyId, ideaId, {format, date, title})`), used by the image route and by the `saveToDrive` server action. The action renders, finds or creates `redes/{yyyy}/{mm-mes}` (`monthFolder(token, folderId, "social", date)`), uploads with `uploadType=multipart` and returns `webViewLink`. File name (`pictureFileName`, the same for the download): `{date}-{title}-{format}.png` under the shared naming rule (`src/lib/names.ts`), e.g. `2026-11-20-vuelta-de-obligado-historia.png`.

**Naming rule.** Every folder and file Laqui creates, in the bucket or in Drive, is lowercase, with no accents or ñ, words joined by `-` and only `a-z 0-9`. `slug("Vía Fortuna")` gives `via-fortuna`. Months are `mm-mes` (`11-noviembre`), so they sort in calendar order.

## Errors

`DriveAuthError` when the token endpoint answers `invalid_grant`, or Drive answers 401 or 403 for insufficient scope: the connection goes to `NEEDS_RECONNECT` with `lastError`, and callers show "Hay que reconectar Google Drive". Other Drive errors are shown as is and leave the status alone.

## Disconnect

Delete the token, status `DISCONNECTED`. Revoke at `oauth2.googleapis.com/revoke` only when no other `ACTIVE` connection has the same `googleAccountId`: revoking any token ends the whole grant of that account for the app.

## Google Cloud setup

Enable the Drive API; add `{APP_URL}/api/drive/callback` as an authorized redirect URI of the same OAuth client; add `drive.file` to the consent screen scopes. While the app is in testing mode only test users can connect and refresh tokens expire after 7 days (the card will ask to reconnect).
