<!-- Copilot / AI agent instructions for the `ahmed_factory` repo -->

# Quick orientation

- **Purpose:** Small production-tracking web app served on Vercel. Static frontend under `public/` and two serverless API routes in `api/` that proxy/modify an Airtable base.
- **Runtime:** Vercel serverless functions (Node). API files export a default async `handler(req, res)` and use native `fetch`.

# Important files

- `public/index.html` — main UI (loads `/app.js`).
- `public/app.js` — primary client logic: loads `/api/jobs`, posts to `/api/log`, optimistic UI and reloads. Prefer editing this file for frontend changes.
- `api/jobs.js` — GET handler: reads Airtable and maps fields (see field names like `JOB ID`, `Impressions`).
- `api/log.js` — POST handler: validates input, PATCHes the Airtable record, appends a timestamped line to `Impr_log`.
- `README.md`, `vercel.json`, `tsconfig.json` — minimal config and hints for local dev.

# Architecture & data flow (concise)

- Browser -> fetch `/api/jobs` to retrieve list (serverless GET reads Airtable, maps records).
- Browser -> POST `/api/log` with `{ id, qty, machine }` to record progress (serverless POST patches Airtable record, updates `Impr_left` and `Impr_log`).
- Airtable credentials are read from `process.env.AIRTABLE_TOKEN` in the API handlers.

# Conventions and patterns to follow

- API handlers: default export asynchronous function named `handler(req, res)`. Return JSON with `res.json(...)` and use `res.status(code).json(...)` for errors (see `api/jobs.js`, `api/log.js`).
- Use `fetch` for external calls (no Axios). Follow existing error handling patterns: check `r.ok`, return upstream payload when appropriate.
- Airtable integration: code currently hard-codes `BASE_ID` and `TABLE_ID`; only token is read from env. Be careful changing IDs — tests and data depend on those fields.
- Frontend expects `id` (Airtable record id) on each row. Keep that shape when changing the API output.
- UI files are plain ES modules / vanilla JS; there is no bundler configured. Edit `public/app.js` directly.

# Local dev & deploy commands

- Run locally with the Vercel dev CLI (no `npm` scripts are defined):

  - Install (if needed): `pnpm install` or `npm install` (repo uses a `pnpm-lock.yaml`).
  - Start local dev server: `npx vercel dev` or `vercel dev` (if Vercel CLI installed).

- Environment: set `AIRTABLE_TOKEN` in your environment or in Vercel's dashboard before running dev or deploy.

# Safety notes & gotchas

- There are two `app.js` files in the repo root and in `public/`. The served client script is `public/app.js` (referenced by `public/index.html`). Prefer editing `public/app.js`.
- The API handlers perform direct `PATCH` calls to Airtable. When testing, use a disposable Airtable base or verify inputs carefully — `api/log.js` mutates `Impr_left` and appends to `Impr_log`.
- Timezone / timestamp: `api/log.js` formats timestamps using `Asia/Jerusalem`. Keep this in mind if altering display logic.

# Examples to copy/paste

- Fetch jobs (server->client): see `public/app.js` load() uses `fetch('/api/jobs', { cache: 'no-store' })` and expects an array of `{ id, jobId, impressions, impr_left, rikmaMachine, impr_log }`.
- POST logging (client->server): `fetch('/api/log', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, qty, machine }) })` — match the same payload shape.

# When you change things

- If you modify API response shapes, update `public/app.js` render/format logic accordingly (search for `jobId`, `impr_left`, `impr_log`).
- If you add dependencies, update a `package.json` scripts+deps and include a simple `dev` script that runs `vercel dev` for convenience.

# Questions for the maintainer

- Should Airtable `BASE_ID` / `TABLE_ID` become env vars instead of being hard-coded?
- Do you prefer adding a `dev` script to `package.json` (e.g., `"dev":"vercel dev"`)?

---
If any of these points are unclear or you want the file adjusted to your preferences (more examples, stricter rules, or different wording), tell me what to change and I'll update it.
