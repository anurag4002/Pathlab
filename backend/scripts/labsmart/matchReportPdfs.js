#!/usr/bin/env node
// Compare scraped Labsmart report PDFs against Pathlab-generated twin PDFs.
//
//   node scripts/labsmart/buildTwins.js
//   npm run labsmart:match-reports

process.env.NODE_ENV = process.env.NODE_ENV || 'development';
require('../../src/config/environment');

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const mongoose = require('mongoose');
const Report = require('../../src/models/Report');
const Patient = require('../../src/models/Patient');
const Bill = require('../../src/models/Bill');
const LabProfile = require('../../src/models/LabProfile');
require('../../src/models/Test');
require('../../src/models/TestCategory');
const { loadReportPrintTests } = require('../../src/services/reportPrintSections');
const { reportPdf } = require('../../src/services/pdfService');

const REPORTS_DIR = path.resolve(__dirname, '../../tests/fixtures/labsmart/reports');
const OUT_DIR = path.join(REPORTS_DIR, 'pathlab-renders');
const PDFTOTEXT = process.env.PDFTOTEXT_PATH
  || 'C:\\Users\\Pratyush Mishra\\AppData\\Local\\Programs\\MiKTeX\\miktex\\bin\\x64\\pdftotext.exe';
const MATCH_MIN = Number(process.env.LABSMART_MATCH_MIN || 0.7);

function pdftotext(pdfPath, txtPath) {
  if (!fs.existsSync(PDFTOTEXT)) throw new Error(`pdftotext not found at ${PDFTOTEXT}`);
  const result = spawnSync(PDFTOTEXT, ['-layout', pdfPath, txtPath], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`pdftotext failed for ${pdfPath}`);
  return fs.readFileSync(txtPath, 'utf8');
}

function pageCount(pdf) {
  return (pdf.toString('latin1').match(/\/Type\s*\/Page\b/g) || []).length;
}

function clinicalBody(text) {
  return String(text || '')
    .replace(/Scan to download/gi, ' ')
    .replace(/Page \d+ of \d+/gi, ' ')
    .replace(/~~~ End of report ~~~/gi, ' ')
    .replace(/Registered on\s*:.*$/gim, ' ')
    .replace(/Collected on\s*:.*$/gim, ' ')
    .replace(/Received on\s*:.*$/gim, ' ')
    .replace(/Reported on\s*:.*$/gim, ' ')
    .replace(/Referred by\s*:.*$/gim, ' ')
    .replace(/Reg\.?\s*no\.?\s*:.*$/gim, ' ')
    .replace(/Age\s*\/\s*Sex\s*:.*$/gim, ' ')
    .replace(/^(Miss\.|Mrs\.|Mr\.|Master\.|Baby\.|Ms\.).*$/gim, ' ');
}

function extractMarkers(text) {
  const body = clinicalBody(text).toUpperCase();
  const markers = new Set();

  // Test / analyte style names.
  for (const match of body.matchAll(/\b([A-Z][A-Z0-9][A-Z0-9 .\/\-',()]{2,60})\b/g)) {
    const name = match[1].replace(/\s+/g, ' ').trim();
    if (name.length < 4) continue;
    if (/^(TEST|VALUE|UNIT|REFERENCE|HAEMATOLOGY|BIOCHEMISTRY|SEROLOGY|CLINICAL|PATHOLOGY|IMMUNOLOGY|COMPLETE|LIVER|KIDNEY|BLOOD|POSSIBLE|CAUSES|HIGH|LOW|NORMAL|PAGE|OF|THE|AND|WITH)$/i.test(name)) continue;
    markers.add(name);
  }

  // Numeric result values with a bit of context (ignore pure dates).
  for (const match of body.matchAll(/\b\d+(?:\.\d+)?\b/g)) {
    const value = match[0];
    if (value.length > 6) continue;
    markers.add(`V:${value}`);
  }

  return [...markers];
}

function coverage(actualText, expectedText) {
  const haystack = clinicalBody(actualText).toUpperCase();
  const markers = extractMarkers(expectedText);
  if (!markers.length) return { hit: 0, total: 0, ratio: 1, missing: [] };
  const missing = markers.filter(marker => {
    if (marker.startsWith('V:')) return !haystack.includes(marker.slice(2));
    return !haystack.includes(marker);
  });
  const hit = markers.length - missing.length;
  return { hit, total: markers.length, ratio: hit / markers.length, missing: missing.slice(0, 20) };
}

async function renderTwin(twin) {
  const report = twin.pathlabReportId
    ? await Report.findById(twin.pathlabReportId).lean()
    : await Report.findOne({ registrationNumber: twin.pathlabRegistration }).lean();
  if (!report) throw new Error(`Pathlab report not found for ${twin.pathlabRegistration || twin.pathlabReportId}`);
  const [patient, bill, profile, testMap] = await Promise.all([
    report.patient ? Patient.findById(report.patient).lean() : null,
    report.bill ? Bill.findById(report.bill).lean() : null,
    LabProfile.findOne().lean(),
    loadReportPrintTests(report)
  ]);
  const buffer = await reportPdf({ report, patient, bill, profile, testMap }, {
    letterhead: true,
    footer: true,
    interpretation: true,
    endline: true,
    pageno: true
  });
  return { report, buffer, pages: pageCount(buffer), registrationNumber: report.registrationNumber };
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const twinsPath = path.join(REPORTS_DIR, 'twins.json');
  if (!fs.existsSync(twinsPath)) {
    throw new Error('twins.json missing — run: node scripts/labsmart/buildTwins.js');
  }
  const twins = JSON.parse(fs.readFileSync(twinsPath, 'utf8'));

  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 15000 });
  const results = [];
  try {
    for (const twin of twins) {
      const labPdf = path.join(REPORTS_DIR, `${twin.labsmartId}.pdf`);
      const labTxt = path.join(REPORTS_DIR, `${twin.labsmartId}.txt`);
      if (!fs.existsSync(labPdf)) {
        results.push({ ...twin, status: 'skip', reason: 'Labsmart PDF missing' });
        continue;
      }
      if (!twin.pathlabRegistration && !twin.pathlabReportId) {
        results.push({ ...twin, status: 'skip', reason: 'No Pathlab twin mapped' });
        continue;
      }

      const labsmartText = fs.existsSync(labTxt) ? fs.readFileSync(labTxt, 'utf8') : pdftotext(labPdf, labTxt);
      let ours;
      try {
        ours = await renderTwin(twin);
      } catch (error) {
        results.push({ ...twin, status: 'fail', reason: error.message });
        console.error(`FAIL ${twin.labsmartId}:`, error.message);
        continue;
      }

      const ourPath = path.join(OUT_DIR, `${ours.registrationNumber || twin.labsmartId}.pdf`);
      const ourTxt = ourPath.replace(/\.pdf$/, '.txt');
      fs.writeFileSync(ourPath, ours.buffer);
      const ourText = pdftotext(ourPath, ourTxt);
      const scored = coverage(ourText, labsmartText);
      const pct = Number((scored.ratio * 100).toFixed(1));
      if (scored.ratio >= MATCH_MIN) {
        results.push({ ...twin, status: 'pass', ourPages: ours.pages, coverage: pct, ourPdf: ourPath });
        console.log(`PASS ${twin.labsmartId} -> ${ours.registrationNumber}: ${pct}% (${scored.hit}/${scored.total}) pages=${ours.pages}`);
      } else {
        results.push({
          ...twin,
          status: 'fail',
          ourPages: ours.pages,
          coverage: pct,
          reason: `only ${pct}% markers matched (${scored.hit}/${scored.total}). Missing eg: ${scored.missing.join(', ')}`,
          ourPdf: ourPath
        });
        console.error(`FAIL ${twin.labsmartId} -> ${ours.registrationNumber}: ${pct}% missing eg ${scored.missing.slice(0, 8).join(', ')}`);
      }
    }
  } finally {
    await mongoose.disconnect();
  }

  const summaryPath = path.join(REPORTS_DIR, 'match-summary.json');
  const passed = results.filter(item => item.status === 'pass');
  const failed = results.filter(item => item.status === 'fail');
  const skipped = results.filter(item => item.status === 'skip');
  fs.writeFileSync(summaryPath, JSON.stringify({
    matchedAt: new Date().toISOString(),
    matchMin: MATCH_MIN,
    passed: passed.length,
    failed: failed.length,
    skipped: skipped.length,
    results
  }, null, 2));
  console.log(`\n${passed.length} passed, ${failed.length} failed, ${skipped.length} skipped`);
  console.log('summary ->', summaryPath);
  if (failed.length) process.exit(1);
}

main().catch(error => {
  console.error('FAILED', error);
  process.exit(1);
});
