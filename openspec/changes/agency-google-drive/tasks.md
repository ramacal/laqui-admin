# Tasks: Google Drive de la agencia

## Phase 1: Model

- [x] Schema: `AgencyDriveConnection`, `AgencyDriveShare`, enums; migration `agency_google_drive`
- [x] `DRIVE_TOKEN_KEY` in `.env.example`

## Phase 2: Drive library (`src/lib/drive/`)

- [x] `crypto.ts`: AES-256-GCM token encryption, signed OAuth state
- [x] `google.ts`: auth URL, code exchange, refresh with in-memory cache, revoke, Drive fetch with `DriveAuthError`
- [x] `folders.ts`: `laqui` reuse, agency folder, year/month folders
- [x] `sharing.ts`: `syncDriveAccess` (only Laqui-created permissions removed)
- [x] `connection.ts`: connect, disconnect, upload, needs-reconnect marking

## Phase 3: Routes and panel

- [x] `GET /api/drive/connect`, `GET /api/drive/callback`
- [x] Agency page: Drive card (account, folder link, with access / manual / failed / no email), sync, reconnect, disconnect
- [x] `src/lib/content/picture.ts` shared by the image route and the upload
- [x] Post editor: "Guardar en Drive" with the link
- [x] Re-sync after `assignOwnerEmail` and after `npm run agencies:import`

## Phase 4: Verify

- [x] Typecheck and lint
- [ ] Manual run with a real Google account (needs the Google Cloud steps)
- [ ] Future staff editor calls `syncDriveAccess`
