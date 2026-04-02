# Architecture

This project is prepared for future deployment with clear ownership boundaries.

## Frontend

- `index.html`
- `styles.css`
- `app.config.js`
- `app.api.js`
- `app.state.js`
- `app.dashboard.js`
- `app.instructors.js`
- `app.schedule.js`
- `app.settlement.js`
- `app.admin.js`
- `app.bootstrap.js`
- `app.js` (legacy note only)

These files are the static UI layer served under `/app`.

Frontend responsibilities are split as follows:

- `app.config.js`: deployment-specific runtime values such as API base URL
- `app.api.js`: shared HTTP helpers
- `app.state.js`: seed data, state, shared helpers
- `app.dashboard.js`: dashboard and personal settings
- `app.instructors.js`: instructor list, profile, reviews
- `app.schedule.js`: schedule list, calendar, modal handling
- `app.settlement.js`: dispatch and settlement UI
- `app.admin.js`: admin settings and SMTP helpers
- `app.bootstrap.js`: startup and global render entry

## Backend

- `server/index.js`
- `server/create-app.js`
- `server/config.js`
- `server/routes/`
- `server/services/`
- `server/storage/`

Backend responsibilities are split as follows:

- `routes/`: HTTP endpoint definitions
- `services/`: business logic such as SMTP and PDF generation
- `storage/`: file-based persistence adapters
- `config.js`: runtime path and environment resolution

Composition is dependency-injected in `create-app.js`:

- storage providers are created first
- services receive stores as dependencies
- routes receive services and stores as dependencies

This keeps future DB or object-storage migration localized to the storage layer.

## Storage

File-based storage is isolated under `server/data/`.

- `server/data/logs/`
- `server/data/uploads/receipts/`

This makes later migration easier:

- email logs -> relational DB or document DB
- receipt files -> object storage such as S3, Blob Storage, or NAS

Storage contracts:

- `server/storage/interfaces.js`
- `server/storage/index.js`

## Deployment Notes

- Static frontend can move to CDN or separate frontend hosting later.
- Backend can move to a dedicated Node server without changing business logic.
- Frontend API target can be changed in `app.config.js`.
- Storage root can be overridden with `APP_STORAGE_DIR`.
