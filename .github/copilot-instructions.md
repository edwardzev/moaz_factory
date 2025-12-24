<!-- Copilot / AI agent instructions for the `moaz_factory` repo -->

# Overview

- **Purpose:** Lightweight production-tracking web app hosted on Vercel; data lives in Airtable.
- **Runtime:** Vercel serverless functions under `api/` + static UI under `public/`.

# Key files

- `public/index.html` — single page UI; loads `/app.js` and includes most styling inline.
- `public/app.js` — main client logic: fetches jobs, renders grouped table, calls API routes on button clicks.
- `api/*.js` — serverless API routes; each exports `default async function handler(req, res)` and uses native `fetch`.

# Data flow (Airtable-backed)

- Browser `GET /api/jobs` → `api/jobs.js` fetches Airtable view and maps fields into rows for the UI.
- Browser actions call:
  - `POST /api/start` → sets `Rikma Machine` and `Outsource North` to `In work North`.
  - `POST /api/cartons` → sets `Carton IN` and `Outsource North` to `Delivered to North`.
  - `POST /api/status` → sets `Outsource North` to an arbitrary status string (UI uses `Arrived to PM North`).
- Attachments are downloaded via `GET /api/download?url=...&filename=...` (host allowlist; avoids open proxy).

# Airtable specifics (do not rename casually)

- Credentials: `process.env.AIRTABLE_TOKEN` (token only). Base/table/view IDs are hard-coded in API files.
- Field names used across routes include: `JOB ID`, `Client name text`, `Job Name`, `Outsource North`, `Mock up`, `Method`, `Carton IN`, `Impressions`, `Impr_left`, `Rikma Machine`, `Impr_log`.
- Machine field: APIs try numeric first, then retry with string on Airtable `422` (supports number vs single-select).

# Frontend conventions

- Keep the row shape from `api/jobs.js` stable (UI relies on `id`, `jobId`, `outsourceNorth`, `mockup`, `impr_left`, `rikmaMachine`, etc.).
- Grouping/sorting is driven by `Outsource North` values and tolerant normalization (`statusKey()` in `public/app.js`), including known misspellings.

# Local dev

- Run locally with Vercel CLI:
  - `npx vercel dev`
- Ensure `AIRTABLE_TOKEN` is set in your environment/Vercel project.

# Gotchas

- Mutations are real Airtable PATCHes; avoid “testing” against production data.
