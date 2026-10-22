#!/usr/bin/env node
// Seeds backend/tests/fixtures/labsmart from an existing tmp scrape
// (no live Labsmart session required). Prefer scrapeInterpretations.js when cookies work.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../../..');
const OUT_DIR = path.resolve(__dirname, '../../tests/fixtures/labsmart');

function loadJson(rel) {
  const full = path.join(ROOT, rel);
  if (!fs.existsSync(full)) return null;
  return JSON.parse(fs.readFileSync(full, 'utf8'));
}

function cleanText(value) {
  return String(value || '').replace(/\nView all\s*$/i, '').trim();
}

function normalizePanels(raw) {
  // Prefer named list scrape; fall back to full popup extract + names from list.
  if (Array.isArray(raw) && raw[0]?.name) {
    return raw.map(item => ({
      name: item.name,
      url: item.url || '',
      text: cleanText(item.text),
      html: item.html || ''
    }));
  }
  return [];
}

function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const namedPanels = loadJson('tmp/labsmart-panel-interpretations.json');
  const fullPanels = loadJson('tmp/labsmart-panel-interpretations-full.json');
  const namedTests = loadJson('tmp/labsmart-test-interpretations.json');
  const fullTests = loadJson('tmp/labsmart-test-interpretations-full.json');
  const existingWebsitePanels = loadJson('backend/tests/fixtures/labsmartPanelInterpretations.website.json');
  const existingWebsiteTests = loadJson('backend/tests/fixtures/labsmartTestInterpretations.website.json');

  let panels = normalizePanels(namedPanels);
  if (fullPanels?.length && panels.length) {
    // Merge full popup HTML/text onto named rows by URL when possible.
    const byUrl = new Map(fullPanels.map(item => [item.url, item]));
    panels = panels.map(panel => {
      const full = byUrl.get(panel.url);
      if (!full) return panel;
      return {
        name: panel.name,
        url: panel.url,
        text: cleanText(full.text || panel.text),
        html: full.html || panel.html || ''
      };
    });
  } else if (!panels.length && existingWebsitePanels?.length) {
    panels = normalizePanels(existingWebsitePanels);
  }

  let tests = normalizePanels(namedTests);
  if (fullTests?.length && tests.length) {
    const byUrl = new Map(fullTests.map(item => [item.url, item]));
    tests = tests.map(test => {
      const full = byUrl.get(test.url);
      if (!full) return test;
      return {
        name: test.name || full.name,
        url: test.url,
        text: cleanText(full.text || test.text),
        html: full.html || test.html || ''
      };
    });
  } else if (!tests.length && existingWebsiteTests?.length) {
    tests = normalizePanels(existingWebsiteTests);
  }

  if (!panels.length || !tests.length) {
    throw new Error('No tmp/website Labsmart scrape found to seed from.');
  }

  // Also keep formatted app panel descriptions used by Pathlab rendering.
  const appPanels = loadJson('backend/tests/fixtures/labsmartPanelInterpretations.json')
    || loadJson('tmp/patch-panel-descriptions.cjs'); // may not be JSON

  fs.writeFileSync(path.join(OUT_DIR, 'panels.website.json'), JSON.stringify(panels, null, 2));
  fs.writeFileSync(path.join(OUT_DIR, 'tests.website.json'), JSON.stringify(tests, null, 2));
  if (Array.isArray(appPanels)) {
    fs.writeFileSync(path.join(OUT_DIR, 'panels.app.json'), JSON.stringify(appPanels, null, 2));
  }
  fs.writeFileSync(path.join(OUT_DIR, 'scrape-meta.json'), JSON.stringify({
    scrapedAt: new Date().toISOString(),
    source: 'seeded-from-tmp',
    panelCount: panels.length,
    testCount: tests.length
  }, null, 2));

  console.log(`seeded ${panels.length} panels, ${tests.length} tests -> ${OUT_DIR}`);
}

main();
