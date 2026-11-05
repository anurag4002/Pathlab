# End-to-end tests

Drives the real frontend in a headless browser against the real backend code
and a **throwaway in-memory database**. Nothing is written to the lab
database (catalog and settings are copied from it read-only), no port is
opened for the backend, and SMS / WhatsApp / email are recorded, never sent.

## Run

1. Start the frontend dev server: `npm run frontend` (serves http://localhost:3000).
2. From the repo root:
   - `npm run e2e` — full flow (24 steps): login, billing, payment, bill PDF,
     result entry, sign-off, report PDF, WhatsApp share, public report link,
     Google Reviews, verification, void, patients, daily business + CSV,
     lab profile, branches, users + employee login, USG.
   - `npm run e2e:crawl` — opens every admin route and lists crashes, failed
     requests, console errors and horizontal scroll. `W=390 H=844` for phone
     width; `ONLY=/cases/bills,/lab/reports` to limit routes.

Each step prints PASS / WARN / FAIL. Failure screenshots and downloaded PDFs
go to `e2e/output/` (git-ignored).

## Needs

- `.env` at the repo root with `MONGO_URI` (catalog source, read-only).
- `playwright` (global install, or `PLAYWRIGHT_PATH`), and a Chromium
  (`npx playwright install chromium`, or `CHROME_PATH`).
- `pdftotext` (Poppler or MiKTeX) on PATH, or `PDFTOTEXT`.
- `E2E_BASE` if the frontend is not on http://localhost:3000.
