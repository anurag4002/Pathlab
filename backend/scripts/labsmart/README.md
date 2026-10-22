# Labsmart scrape + PDF match

## 1) Interpretations (once)

```bash
cd backend
set LABSMART_COOKIES=browser_uuid=...; _azurite_session=...
npm run labsmart:scrape
```

Writes `tests/fixtures/labsmart/panels.website.json` (8) and `tests.website.json` (~82).

## 2) Full report PDFs (what we match)

These are **full printed lab reports**, not the 4 demo CBC/KFT samples only.

```bash
# default: Last 90 days, paginated, up to 100 report PDFs
npm run labsmart:scrape-reports

# or N most recent
node scripts/labsmart/scrapeReportPdfs.js --recent=80

# or specific ids
node scripts/labsmart/scrapeReportPdfs.js 30690438 30684127
```

Writes under `tests/fixtures/labsmart/reports/`:

- `{id}.pdf` — Labsmart print PDF
- `{id}.txt` — pdftotext extract
- `manifest.json`
- `coverage.json` — which catalog tests appear across the PDF corpus

## 3) Recreate each Labsmart PDF in Pathlab and match

Labsmart patients are not the same Mongo patients, so we **parse each Labsmart PDF’s result rows + interpretation blocks**, recreate that case with `reportPdf` (panel descriptions from `panels.app.json`), then compare.

**Primary assert:** interpretation token coverage (≥75%, override with `LABSMART_INTERP_MIN`).  
**Secondary assert:** result-row coverage (≥65%, override with `LABSMART_MATCH_MIN`).

```bash
npm run labsmart:recreate-match
```

Writes Pathlab renders under `tests/fixtures/labsmart/reports/pathlab-recreates/` and `recreate-match-summary.json`.

## 4) Visual PDF parity (layout)

After recreate-match, render each Labsmart vs Pathlab PDF to page images and score pixel diff (letterhead/footer bands masked):

```bash
npm run labsmart:visual-match
```

Writes `visual-match-summary.json` and failing page diffs under `tests/fixtures/labsmart/reports/visual-diffs/`.

Overrides: `LABSMART_VISUAL_MAX_DIFF` (default 0.18), `LABSMART_VISUAL_MASK_TOP` / `_BOTTOM`, `PDFTOPPM_PATH`.

## Seed without live cookies

```bash
npm run labsmart:seed-fixtures
npm run labsmart:seed-reports
```
