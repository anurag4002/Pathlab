#!/usr/bin/env node
// Scrapes Labsmart panel + test interpretations once into backend fixtures.
//
// Usage:
//   LABSMART_COOKIES="..." node scripts/labsmart/scrapeInterpretations.js
//   npm run labsmart:scrape
//
// Optional:
//   LABSMART_LAB_ID=22707599
//   LABSMART_PLAYWRIGHT_PATH=...
//   LABSMART_CHROMIUM_PATH=...
//   LABSMART_OUT_DIR=tests/fixtures/labsmart

const fs = require('fs');
const path = require('path');
const { launchLabsmartBrowser } = require('./browser');
const { extractPopup } = require('./extractPopup');

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const OUT_DIR = path.resolve(
  __dirname,
  '../../',
  process.env.LABSMART_OUT_DIR || 'tests/fixtures/labsmart'
);

function cleanText(value) {
  return String(value || '').replace(/\nView all\s*$/i, '').trim();
}

async function extractRows(page, listUrl, popupTitle) {
  await page.goto(listUrl, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(1500);
  return page.evaluate(title => {
    const tables = [...document.querySelectorAll('table')];
    const table = tables.find(candidate => /Name/i.test(candidate.innerText)
      && /Interpretation/i.test(candidate.innerText));
    if (!table) return [];
    return [...table.querySelectorAll('tbody tr')].map(row => {
      const cells = [...row.querySelectorAll('td')];
      const button = [...row.querySelectorAll('button')]
        .find(item => item.getAttribute('data-popup-title') === title);
      return {
        name: (cells[1]?.innerText || '').trim(),
        url: button?.getAttribute('data-url') || ''
      };
    });
  }, popupTitle);
}

async function scrapeList({ context, page, origin, listPath, popupTitle, nameLabel, delayMs }) {
  const rows = await extractRows(page, `${origin}${listPath}`, popupTitle);
  console.log(`${listPath}: ${rows.length} rows`);
  const out = [];
  for (const row of rows) {
    if (!row.url) {
      console.warn('skip row without popup url:', row.name);
      continue;
    }
    const response = await context.request.get(`${origin}${row.url}`);
    if (!response.ok()) {
      console.warn('failed', row.name, response.status());
      continue;
    }
    const extracted = extractPopup(await response.text(), nameLabel);
    const record = {
      name: row.name || extracted.name,
      url: row.url,
      text: cleanText(extracted.text),
      html: extracted.html || ''
    };
    out.push(record);
    console.log('  ', record.name, `(${record.text.length} chars)`);
    await sleep(delayMs);
  }
  return out;
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const { browser, context, labId, origin } = await launchLabsmartBrowser();
  const page = await context.newPage();
  try {
    const panels = await scrapeList({
      context,
      page,
      origin,
      listPath: `/${labId}/panel_interpretations`,
      popupTitle: 'Panel interpretation',
      nameLabel: 'Panel name:',
      delayMs: 150
    });
    // Labsmart typo: popup title is "Interpreation"
    const tests = await scrapeList({
      context,
      page,
      origin,
      listPath: `/${labId}/test_interpretations`,
      popupTitle: 'Interpreation',
      nameLabel: 'Test name:',
      delayMs: 120
    });

    const panelsPath = path.join(OUT_DIR, 'panels.website.json');
    const testsPath = path.join(OUT_DIR, 'tests.website.json');
    const metaPath = path.join(OUT_DIR, 'scrape-meta.json');
    fs.writeFileSync(panelsPath, JSON.stringify(panels, null, 2));
    fs.writeFileSync(testsPath, JSON.stringify(tests, null, 2));
    fs.writeFileSync(metaPath, JSON.stringify({
      scrapedAt: new Date().toISOString(),
      labId,
      origin,
      panelCount: panels.length,
      testCount: tests.length
    }, null, 2));

    console.log(`\nwrote ${panels.length} panels -> ${panelsPath}`);
    console.log(`wrote ${tests.length} tests  -> ${testsPath}`);
    if (panels.length < 1 || tests.length < 1) {
      throw new Error('Scrape returned empty results; check LABSMART_COOKIES / lab id.');
    }
  } finally {
    await browser.close();
  }
}

main().catch(error => {
  console.error('FAILED', error.message || error);
  process.exit(1);
});
