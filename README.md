# Instructor Management Web App

This project is organized for easier deployment and post-deployment maintenance.

## Structure

```text
webapp/
  index.html
  styles.css
  app.config.js
  app.api.js
  app.state.js
  app.dashboard.js
  app.instructors.js
  app.schedule.js
  app.settlement.js
  app.admin.js
  app.bootstrap.js
  app.js
  server/
    index.js
    create-app.js
    config.js
    routes/
    services/
    storage/
    data/
      logs/
      uploads/
        receipts/
```

## Frontend

- `index.html`: entry HTML
- `styles.css`: shared styles
- `app.config.js`: runtime deployment config
- `app.api.js`: HTTP helpers
- `app.state.js`: seed data, global state, shared helpers
- `app.dashboard.js`: dashboard and personal settings
- `app.instructors.js`: instructor list and profile management
- `app.schedule.js`: schedule list, calendar, schedule modal
- `app.settlement.js`: dispatch and settlement screens
- `app.admin.js`: admin settings, SMTP verification, grade and transport settings
- `app.bootstrap.js`: app startup and global render cycle
- `app.js`: legacy note file only

## Backend

- `server/index.js`: server bootstrap
- `server/create-app.js`: Express app composition
- `server/config.js`: environment and storage path resolution
- `server/routes/`: API routes
- `server/services/`: business logic such as mail sending
- `server/storage/`: file-based storage adapters

The backend now uses an injectable composition flow:

- `createStorageProviders()` builds storage dependencies
- `createMailerService()` receives storage dependencies
- route factories receive services and stores from `create-app.js`

This means later DB migration can be handled by replacing the storage provider layer first.

## Storage

Current storage is file-based:

- `server/data/logs/`
- `server/data/uploads/receipts/`

This can later be replaced with:

- DB tables for logs and metadata
- Object storage or NAS for file attachments

## Run

```bash
cd instructor_management_app/webapp
npm install
copy .env.example .env
npm run start
```

## Check

```bash
npm run check
```

## Environment

Key `.env` values:

```env
PORT=4000
HOST=127.0.0.1
APP_STORAGE_DIR=server/data
SMTP_HOST=ezsmtp.bizmeka.com
SMTP_PORT=465
SMTP_USER=root@rootconsulting.co.kr
SMTP_PASS="password#example"
MAIL_FROM=root@rootconsulting.co.kr
MAIL_FROM_NAME=루트컨설팅
```

Notes:

- Quote SMTP passwords when they include `#` or spaces.
- `SMTP_PORT=465` is treated as secure SMTP.
- `APP_STORAGE_DIR` can be changed when moving to another server.

## Deployment Guidance

### Frontend hosting

If the frontend is hosted separately later, update `app.config.js`:

```js
window.IMS_CONFIG = {
  apiBaseUrl: "https://api.example.com",
  storageKey: "ims_app_v4"
};
```

### Backend hosting

The backend can run independently as a Node service. Required checks:

- valid `.env`
- writable upload directory
- reachable SMTP server

### Future DB migration

Recommended order:

1. move email logs to DB
2. move receipt metadata to DB
3. move receipt files to external storage

The current code already isolates storage logic under `server/storage/`, so replacement work stays localized.

## Storage Replacement Point

If you later move from file storage to DB/object storage, the main replacement target is:

- [server/storage/index.js](c:\Users\한소연\Desktop\vscodetest\instructor_management_app\webapp\server\storage\index.js)

Expected contracts are defined in:

- [server/storage/interfaces.js](c:\Users\한소연\Desktop\vscodetest\instructor_management_app\webapp\server\storage\interfaces.js)

Current implementations:

- [email-log-store.js](c:\Users\한소연\Desktop\vscodetest\instructor_management_app\webapp\server\storage\email-log-store.js)
- [receipt-store.js](c:\Users\한소연\Desktop\vscodetest\instructor_management_app\webapp\server\storage\receipt-store.js)
