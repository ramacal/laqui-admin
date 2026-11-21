# Proposal: Google Drive de la agencia

## Intent

Agencies already get branded pictures from Laqui (change `social-content-ideas`), but each one is downloaded to a phone or a PC and lost there. Most agencies run their social networks from a Google account of their own (often not the one the owner uses to sign in to Laqui). Letting each agency connect that Google Drive gives them one shared place for their pictures: a folder `laqui/{agencia}` that Laqui keeps shared with the agency's staff.

## Scope

### In Scope

- Per-agency Google Drive connection with its own OAuth flow (separate from the Laqui sign-in), so the agency can pick any Google account.
- Scope `drive.file` only: Laqui sees and manages only the files and folders it creates.
- Folder `laqui/{agencia}` created on connect; one `laqui` folder per Google account, shared by every agency connected with that account.
- Sharing the agency folder with every active employee that has an email, kept in sync when staff change; only permissions created by Laqui are ever removed.
- "Guardar en Drive" on the post editor: uploads the rendered PNG to `laqui/{agencia}/redes/{yyyy}/{mm-mes}/` and returns the link.
- Disconnect (token revoked when no other agency uses that grant) and "needs reconnection" state for expired or revoked tokens.

### Out of Scope

- Reading or listing the agency's other Drive files (not possible with `drive.file`, on purpose).
- Moving logos or receipts to Drive: Laqui storage stays the source; Drive is the agency's copy.
- Service accounts (no Drive quota) and shared drives.
- A staff editor in the panel (staff still come from the import); it must call the same sync when it exists.
- Background re-sync jobs (sync runs on connect, on staff changes and on demand).

## Capabilities

### New Capabilities

- `agency-google-drive`: connection, folders, staff sharing and picture upload.

### Modified Capabilities

- `social-content`: the post editor gains "Guardar en Drive" (no change to existing scenarios).

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `prisma/schema.prisma` | New | `AgencyDriveConnection`, `AgencyDriveShare`, enums |
| `src/lib/drive/` | New | Token encryption, OAuth, Drive REST client, folders, sharing sync, upload |
| `src/app/api/drive/` | New | `connect` and `callback` route handlers |
| `src/app/panel/agencias/[agencyId]/` | Modified | Drive card on the agency page, actions |
| `src/components/content/post-editor.tsx` | Modified | "Guardar en Drive" |
| `src/lib/content/picture.ts` | New | Picture of an idea, shared by the image route and the upload |
| `scripts/import-agencies.ts` | Modified | Re-sync Drive access after importing staff |
| `.env.example` | Modified | `DRIVE_TOKEN_KEY` |

User-facing impact: owners and agency admins see a "Google Drive" card on the agency page; everyone with access to an agency sees "Guardar en Drive" on a picture once the agency is connected; employees with an email get a Google sharing invitation.

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Refresh token leaked from the database | Low | AES-256-GCM with a key outside the database, bound to the agency id |
| Laqui removes access someone gave by hand | Medium | Only permissions created by Laqui (stored ids) are removed; existing ones are recorded as manual and left alone |
| Google app in testing mode: refresh tokens expire after 7 days | High (until verified) | Connection is marked "needs reconnection"; card offers "Reconectar"; publish the app |
| Employee email is not a Google account | Medium | Sharing fails for that person only; shown on the card with the reason |
| Revoking the token also drops another agency's connection with the same account | Medium | Revoke only when no other agency uses that Google account |

## Rollback Plan

Only new tables and routes. Rolling back = drop `AgencyDriveConnection`, `AgencyDriveShare` and the routes; the folders and files stay in the agencies' Drives (they are theirs). Revoke the grants from Google Cloud if needed.

## Success Criteria

- [ ] An owner connects a Google account other than their login and `laqui/{agencia}` appears in that Drive.
- [ ] Active employees with an email get access; those without one are listed.
- [ ] A picture saved from the editor lands in `laqui/{agencia}/redes/2026/11-noviembre/` and its link is shown.
- [ ] Deactivating an employee removes the access Laqui gave, and nothing else.
