#!/usr/bin/env node
// Scrapes full Labsmart lab-report print PDFs into fixtures.
//
// Usage:
//   LABSMART_COOKIES="..." npm run labsmart:scrape-reports
//   LABSMART_COOKIES="..." node scripts/labsmart/scrapeReportPdfs.js 30690438 30693124
//   LABSMART_COOKIES="..." node scripts/labsmart/scrapeReportPdfs.js --recent=100
//
// Default (no args): Last 90 days + Next pagination, up to 100 report PDFs
// (not just the 4 seed CBC/KFT demos).
//
// Writes per report:
//   tests/fixtures/labsmart/reports/{id}.pdf
//   tests/fixtures/labsmart/reports/{id}.txt
//   tests/fixtures/labsmart/reports/manifest.json
//   tests/fixtures/labsmart/reports/coverage.json

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { launchLabsmartBrowser } = require('./browser');

const OUT_DIR = path.resolve(
  __dirname,
  '../../',
  process.env.LABSMART_REPORTS_OUT || 'tests/fixtures/labsmart/reports'
);
const PDFTOTEXT = process.env.PDFTOTEXT_PATH
  || 'C:\\Users\\Pratyush Mishra\\AppData\\Local\\Programs\\MiKTeX\\miktex\\bin\\x64\\pdftotext.exe';

const DEFAULT_REPORTS = [
  { id: '30690438', slug: 'cbc' },
  { id: '30693124', slug: 'kft' },
  { id: '30688430', slug: 'cbc-kft' },
  { id: '30684127', slug: 'multi' }
];

function parseArgs(argv) {
  const recent = argv.find(arg => arg.startsWith('--recent='));
  const ids = argv.filter(arg => /^\d+$/.test(arg));
  // No args => scrape a large recent corpus (not the 4-seed demo).
  return {
    recent: recent ? Number(recent.split('=')[1]) : (ids.length ? 0 : 100),
    ids
  };
}

function extractText(pdfPath, txtPath) {
  if (!fs.existsSync(PDFTOTEXT)) {
    fs.writeFileSync(txtPath, '');
    return { ok: false, reason: 'pdftotext missing' };
  }
  const result = spawnSync(PDFTOTEXT, ['-layout', pdfPath, txtPath], { encoding: 'utf8' });
  return { ok: result.status === 0, reason: result.stderr || '' };
}

function clinicalHints(text) {
  const lines = String(text || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const patient = lines.find(line => /^(Miss\.|Mrs\.|Mr\.|Master\.|Baby\.)/i.test(line)) || '';
  const reg = (text.match(/Reg\.?\s*no\.?\s*:?\s*(\d+)/i) || [])[1] || '';
  const tests = [...text.matchAll(/^[A-Z][A-Z0-9 .,\-\/()]{3,60}$/gm)]
    .map(match => match[0].trim())
    .filter(name => !/^(TEST|VALUE|UNIT|REFERENCE|HAEMATOLOGY|BIOCHEMISTRY|CLINICAL)/i.test(name))
    .slice(0, 80);
  return { patient, reg, sampleTests: [...new Set(tests)].slice(0, 40) };
}

async function collectIdsOnPage(page) {
  return page.evaluate(() => {
    const hrefs = [...document.querySelectorAll('a[href*="/lab_reports/"]')]
      .map(anchor => anchor.getAttribute('href') || '');
    const found = [];
    for (const href of hrefs) {
      const match = href.match(/\/lab_reports\/(\d+)/);
      if (match && !found.includes(match[1])) found.push(match[1]);
    }
    return found;
  });
}

async function clickLabel(page, label) {
  const clicked = await page.evaluate(text => {
    const nodes = [...document.querySelectorAll('button, a, [role="button"], div, span, li')];
    const target = nodes.find(el => (el.textContent || '').trim() === text);
    if (!target) return false;
    target.click();
    return true;
  }, label);
  if (clicked) await page.waitForTimeout(2000);
  return clicked;
}

async function listRecentReportIds(page, origin, labId, limit) {
  await page.goto(`${origin}/${labId}/lab_reports`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(1500);
  // Widen the window so we get more than the default 7-day slice.
  await clickLabel(page, 'Last 90 days') || await clickLabel(page, 'Past 90 days');
  await page.waitForTimeout(2500);

  const found = [];
  let listUrl = page.url();
  for (let pageNo = 1; pageNo <= 50 && found.length < limit; pageNo++) {
    if (pageNo > 1) {
      const next = new URL(listUrl);
      next.searchParams.set('page', String(pageNo));
      await page.goto(next.toString(), { waitUntil: 'networkidle', timeout: 60000 });
      await page.waitForTimeout(1200);
    } else {
      listUrl = page.url();
    }
    const ids = await collectIdsOnPage(page);
    let added = 0;
    for (const id of ids) {
      if (found.includes(id)) continue;
      found.push(id);
      added += 1;
      if (found.length >= limit) break;
    }
    console.log(`list page ${pageNo}: +${added} new (raw ${ids.length}), total ${found.length}`);
    if (!ids.length || added === 0) break;
  }
  return found.slice(0, limit);
}

function buildCoverage(manifest, outDir) {
  const catalog = (() => {
    try {
      return require('../../tests/fixtures/labsmart/tests.website.json').map(item => item.name);
    } catch {
      return [];
    }
  })();
  const seen = new Map();
  for (const report of manifest.filter(item => !item.error)) {
    const txtPath = path.join(outDir, `${report.id}.txt`);
    const text = fs.existsSync(txtPath) ? fs.readFileSync(txtPath, 'utf8') : '';
    const upper = text.toUpperCase();
    for (const name of catalog) {
      if (upper.includes(String(name).toUpperCase())) {
        if (!seen.has(name)) seen.set(name, []);
        seen.get(name).push(report.id);
      }
    }
  }
  const covered = [...seen.keys()].sort();
  const missing = catalog.filter(name => !seen.has(name));
  return {
    reportCount: manifest.filter(item => !item.error).length,
    catalogTests: catalog.length,
    coveredTests: covered.length,
    missingTests: missing.length,
    covered,
    missing,
    byTest: Object.fromEntries([...seen.entries()].map(([name, ids]) => [name, ids]))
  };
}

async function scrapeOne(context, origin, labId, report, outDir) {
  const id = String(report.id);
  const slug = report.slug || id;
  const page = await context.newPage();
  try {
    const url = `${origin}/${labId}/lab_reports/${id}`;
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(2000);
    const title = await page.title();
    if (/sign in|login/i.test(title) || /sign in|login/i.test(page.url())) {
      throw new Error(`Not authenticated while opening report ${id}`);
    }

    const pdfPath = path.join(outDir, `${id}.pdf`);
    const txtPath = path.join(outDir, `${id}.txt`);
    const metaPath = path.join(outDir, `${id}.meta.json`);

    await page.emulateMedia({ media: 'print' });
    await page.pdf({ path: pdfPath, format: 'A4', printBackground: true });
    const extracted = extractText(pdfPath, txtPath);
    const text = fs.existsSync(txtPath) ? fs.readFileSync(txtPath, 'utf8') : '';
    const hints = clinicalHints(text);
    const meta = {
      id,
      slug,
      url,
      scrapedAt: new Date().toISOString(),
      bytes: fs.statSync(pdfPath).size,
      textChars: text.length,
      pdftotext: extracted.ok,
      ...hints
    };
    fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));
    console.log(`[pdf] ${id} (${slug}) ${meta.bytes} bytes patient="${hints.patient}" reg=${hints.reg}`);
    return meta;
  } finally {
    await page.close();
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const { browser, context, labId, origin } = await launchLabsmartBrowser();
  try {
    let targets = [];
    if (args.ids.length) {
      targets = args.ids.map(id => ({ id, slug: id }));
    } else {
      const page = await context.newPage();
      const ids = await listRecentReportIds(page, origin, labId, args.recent || 100);
      await page.close();
      console.log(`recent reports found: ${ids.length}`);
      // Always keep the known seed reports in the corpus too.
      const merged = new Map(DEFAULT_REPORTS.map(item => [item.id, item]));
      for (const id of ids) merged.set(id, merged.get(id) || { id, slug: id });
      targets = [...merged.values()];
    }

    const manifest = [];
    for (const report of targets) {
      try {
        manifest.push(await scrapeOne(context, origin, labId, report, OUT_DIR));
      } catch (error) {
        console.error(`[fail] ${report.id}`, error.message || error);
        manifest.push({ id: report.id, slug: report.slug, error: String(error.message || error) });
      }
    }

    const coverage = buildCoverage(manifest, OUT_DIR);
    const manifestPath = path.join(OUT_DIR, 'manifest.json');
    const coveragePath = path.join(OUT_DIR, 'coverage.json');
    fs.writeFileSync(manifestPath, JSON.stringify({
      scrapedAt: new Date().toISOString(),
      labId,
      count: manifest.length,
      reports: manifest
    }, null, 2));
    fs.writeFileSync(coveragePath, JSON.stringify(coverage, null, 2));
    console.log(`\nwrote ${manifest.filter(item => !item.error).length}/${manifest.length} PDFs -> ${OUT_DIR}`);
    console.log(`coverage: ${coverage.coveredTests}/${coverage.catalogTests} catalog tests seen in PDFs`);
    if (coverage.missing.length) {
      console.log(`missing (${coverage.missing.length}): ${coverage.missing.slice(0, 20).join(', ')}${coverage.missing.length > 20 ? '...' : ''}`);
    }
    console.log(`manifest -> ${manifestPath}`);
    console.log(`coverage -> ${coveragePath}`);
  } finally {
    await browser.close();
  }
}

main().catch(error => {
  console.error('FAILED', error.message || error);
  process.exit(1);
});
