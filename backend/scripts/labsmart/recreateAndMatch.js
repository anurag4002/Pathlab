#!/usr/bin/env node
// For every scraped Labsmart report PDF:
//   1) parse results + interpretation blocks from the Labsmart PDF
//   2) recreate the case in Pathlab with matching panel / test interpretations
//   3) PRIMARY assert: interpretation text matches
//   4) SECONDARY assert: result rows still match
//
// Usage:
//   npm run labsmart:recreate-match

process.env.NODE_ENV = process.env.NODE_ENV || 'development';
require('../../src/config/environment');

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const mongoose = require('mongoose');
const Test = require('../../src/models/Test');
require('../../src/models/TestCategory');
const LabProfile = require('../../src/models/LabProfile');
const { reportPdf } = require('../../src/services/pdfService');
const { REFERENCE_FORMAT } = require('../../src/services/documentTemplateService');
const { parseLabsmartReportText } = require('./parseLabsmartReportText');

const REPORTS_DIR = path.resolve(__dirname, '../../tests/fixtures/labsmart/reports');
const OUT_DIR = path.join(REPORTS_DIR, 'pathlab-recreates');
const PANEL_APP = JSON.parse(fs.readFileSync(
  path.resolve(__dirname, '../../tests/fixtures/labsmart/panels.app.json'),
  'utf8'
));
const TEST_ESSAYS = JSON.parse(fs.readFileSync(
  path.resolve(__dirname, '../../tests/fixtures/labsmart/tests.website.json'),
  'utf8'
));
const PDFTOTEXT = process.env.PDFTOTEXT_PATH
  || 'C:\\Users\\Pratyush Mishra\\AppData\\Local\\Programs\\MiKTeX\\miktex\\bin\\x64\\pdftotext.exe';
const INTERP_MIN = Number(process.env.LABSMART_INTERP_MIN || 0.75);
const RESULT_MIN = Number(process.env.LABSMART_MATCH_MIN || 0.65);

function pdftotext(pdfPath, txtPath) {
  const result = spawnSync(PDFTOTEXT, ['-layout', pdfPath, txtPath], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`pdftotext failed for ${pdfPath}`);
  return fs.readFileSync(txtPath, 'utf8');
}

function pageCount(pdf) {
  return (pdf.toString('latin1').match(/\/Type\s*\/Page\b/g) || []).length;
}

function normName(value) {
  return String(value || '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
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

function significantTokens(text) {
  return normName(text)
    .split(' ')
    .filter(token => token.length > 3)
    .filter(token => !/^(THIS|THAT|WITH|FROM|HAVE|BEEN|WERE|THEY|THEIR|INTO|ALSO|ONLY|THAN|THEN|WHEN|WHICH|WHAT|YOUR|MORE|MOST|SUCH|SOME|OVER|UNDER|AFTER|BEFORE|ABOUT|OTHER|BETWEEN)$/i.test(token));
}

function tokenCoverage(actualText, expectedText, label) {
  const haystack = normName(clinicalBody(actualText));
  const tokens = significantTokens(expectedText);
  if (!tokens.length) return { label, hit: 0, total: 0, ratio: 1, missing: [] };
  const missing = tokens.filter(token => !haystack.includes(token));
  const hit = tokens.length - missing.length;
  return {
    label,
    hit,
    total: tokens.length,
    ratio: hit / tokens.length,
    missing: missing.slice(0, 20)
  };
}

function resultCoverage(actualText, expectedParsed) {
  const haystack = normName(clinicalBody(actualText));
  const markers = [];
  for (const row of expectedParsed.results) {
    const tokens = normName(row.testName).split(' ').filter(token => token.length > 1);
    if (tokens.length) markers.push(`N:${tokens.join(' ')}`);
    if (row.value) markers.push(`V:${String(row.value).replace(/[^0-9.]/g, '')}`);
  }
  const unique = [...new Set(markers.filter(Boolean))];
  const missing = unique.filter(marker => {
    if (marker.startsWith('V:')) {
      const value = marker.slice(2);
      if (!value) return false;
      const compact = haystack.replace(/ /g, '');
      return !compact.includes(value.replace(/\./g, '')) && !haystack.includes(value);
    }
    return !marker.slice(2).split(' ').every(token => haystack.includes(token));
  });
  const hit = unique.length - missing.length;
  return {
    label: 'results',
    hit,
    total: unique.length,
    ratio: unique.length ? hit / unique.length : 1,
    missing: missing.slice(0, 20)
  };
}

function findCatalog(testName, catalog) {
  const target = normName(testName);
  const exact = catalog.find(test => normName(test.name) === target);
  if (exact) return exact;
  // Do not let "LYMPHOCYTE" match "NEUTROPHIL LYMPHOCYTE RATIO".
  const bordered = catalog.filter(test => {
    const name = normName(test.name);
    return name.startsWith(`${target} `) || target.startsWith(`${name} `);
  }).sort((a, b) => Math.abs(normName(a.name).length - target.length) - Math.abs(normName(b.name).length - target.length));
  return bordered[0];
}

function findWebsiteEssay(testName) {
  const target = normName(testName);
  return TEST_ESSAYS.find(test => normName(test.name) === target)
    || TEST_ESSAYS.find(test => target.includes(normName(test.name)) || normName(test.name).includes(target));
}

/** Panel from section heading only — never from notes content (avoids LFT→KFT swaps). */
function panelFromHeading(sectionName) {
  const heading = normName(sectionName);
  if (!heading) return null;
  // Generic department labels are not panels.
  if (/^(HAEMATOLOGY|BIOCHEMISTRY|SEROLOGY|CLINICAL PATHOLOGY|PATHOLOGY|IMMUNOLOGY|MICROBIOLOGY)$/.test(heading)) {
    return null;
  }
  return PANEL_APP.find(panel => {
    const name = normName(panel.name);
    if (heading.includes('COMPLETE BLOOD') || heading.includes('CBC')) return /COMPLETE BLOOD COUNT|CBC/.test(name);
    if (heading.includes('LIVER') || /\bLFT\b/.test(heading)) return /LIVER FUNCTION|LFT/.test(name);
    if (heading.includes('KIDNEY') || /\bKFT\b/.test(heading)) return /KIDNEY FUNCTION|KFT/.test(name);
    if (heading.includes('VIRAL')) return /VIRAL/.test(name);
    if (heading.includes('IRON')) return /IRON/.test(name);
    if (heading.includes('THYROID') && heading.includes('FREE')) return /FREE THYROID|FTFT/.test(name);
    if (heading.includes('THYROID')) return /THYROID FUNCTION TEST \(TFT\)/.test(name);
    if (heading.includes('BLOOD SUGAR') || heading.includes('GLUCOSE')) return /BLOOD SUGAR/.test(name);
    return name === heading || heading.includes(name) || name.includes(heading);
  }) || null;
}

/** Labsmart often prints the next standalone analyte after a panel's notes
 *  without a new heading; keep those out of the prior panel. */
function isPanelMember(sectionName, testName) {
  const heading = normName(sectionName);
  // Compact so "R.D.W." / "P-LCR" still match after normName inserts spaces.
  const test = normName(testName).replace(/ /g, '');
  if (heading.includes('COMPLETE BLOOD') || heading.includes('CBC')) {
    return /HEMOGLOBIN|HAEMOGLOBIN|LEUKOCYTE|TLC|DLC|NEUTROPHIL|LYMPHOCYTE|EOSINOPHIL|MONOCYTE|BASOPHIL|PLATELET|RBC|HEMATOCRIT|HCT|MCV|MCHC|MCH|RDW|MPV|PDW|PLCR|NLR|ABS/.test(test);
  }
  if (heading.includes('LIVER') || /\bLFT\b/.test(heading)) {
    return /BILIRUBIN|SGOT|SGPT|AST|ALT|ALKALINE|PROTEIN|ALBUMIN|GLOBULIN|AGRATIO|GGT|GAMMA/.test(test);
  }
  if (heading.includes('KIDNEY') || /\bKFT\b/.test(heading)) {
    return /UREA|CREATININE|URIC|SODIUM|POTASSIUM|PHOSPHORUS|CALCIUM|CHLORIDE|BICARB|BUN/.test(test);
  }
  if (heading.includes('VIRAL')) {
    return /HIV|HBSAG|HCV|HEPATITIS/.test(test);
  }
  if (heading.includes('THYROID')) return /T3|T4|TSH|FT3|FT4/.test(test);
  if (heading.includes('IRON')) return /IRON|FERRITIN|TIBC|UIBC|TRANSFERRIN/.test(test);
  if (heading.includes('BLOOD SUGAR') || heading.includes('GLUCOSE')) return /SUGAR|GLUCOSE|FBS|PPBS|RBS/.test(test);
  return true;
}

function effectiveSection(row) {
  if (!row.section || isPanelMember(row.section, row.testName)) return row.section || 'LAB';
  return 'BIOCHEMISTRY';
}

/** Attach a website test essay only for standalone (non-panel) sections when
 *  the Labsmart PDF printed that essay. Panel sections use panel description
 *  alone — Labsmart does not also dump each member test's long essay. */
function essayFromPdf(testName, interpretationBlocks, hasPanel) {
  if (hasPanel) return '';
  const website = findWebsiteEssay(testName);
  if (!website?.text || !interpretationBlocks.length) return '';
  let best = 0;
  for (const block of interpretationBlocks) {
    const forward = tokenCoverage(website.text, block.text).ratio;
    const reverse = tokenCoverage(block.text, website.text).ratio;
    best = Math.max(best, forward, reverse);
  }
  return best >= 0.5 ? website.text : '';
}

function parseAgeSex(ageSex) {
  const match = String(ageSex || '').match(/(\d+)\s*YRS?\s*\/\s*([MF])/i);
  if (!match) return { age: 30, gender: 'Male' };
  return { age: Number(match[1]), gender: /^f/i.test(match[2]) ? 'Female' : 'Male' };
}

function sectionKeyFor(row, id) {
  return `labsmart:${id}:${normName(row.section || 'LAB').slice(0, 40) || 'LAB'}`;
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 15000 });

  const catalog = await Test.find({}).populate('category', 'name').lean();
  const stored = await LabProfile.findOne().lean();
  // Labsmart print PDFs are denser (smaller footer band, no booking disclaimer).
  const denseFormat = {
    ...REFERENCE_FORMAT,
    ...(stored?.documentFormats?.[0] || {}),
    useReferenceBranding: false,
    footerHeight: 36,
    rowPadding: 2,
    fontSize: 9
  };
  const profile = {
    ...(stored || { labName: 'Parity Lab', reportFormatId: 'reference' }),
    disclaimer: '',
    documentFormats: [denseFormat],
    reportFormatId: denseFormat.id || 'reference'
  };

  const ids = fs.readdirSync(REPORTS_DIR)
    .filter(name => name.endsWith('.pdf') && /^\d+\.pdf$/.test(name))
    .map(name => name.replace(/\.pdf$/, ''));

  const results = [];
  try {
    for (const id of ids) {
      const labPdf = path.join(REPORTS_DIR, `${id}.pdf`);
      const labTxtPath = path.join(REPORTS_DIR, `${id}.txt`);
      const labText = fs.existsSync(labTxtPath) ? fs.readFileSync(labTxtPath, 'utf8') : pdftotext(labPdf, labTxtPath);
      const parsed = parseLabsmartReportText(labText);
      if (!parsed.results.length) {
        results.push({ id, status: 'skip', reason: 'no result rows parsed from Labsmart PDF' });
        console.warn(`SKIP ${id}: no result rows parsed`);
        continue;
      }

      const age = parseAgeSex(parsed.ageSex);
      const reportResults = [];
      const testMap = {};
      const sectionPanels = new Map();
      const essaysUsed = [];

      const normalizedRows = parsed.results.map(row => ({ ...row, section: effectiveSection(row) }));
      for (const row of normalizedRows) {
        const key = normName(row.section);
        if (!sectionPanels.has(key)) sectionPanels.set(key, panelFromHeading(row.section));
      }

      normalizedRows.forEach((row, index) => {
        const catalogTest = findCatalog(row.testName, catalog);
        const fakeId = catalogTest?._id || `tmp-${id}-${index}`;
        const key = sectionKeyFor(row, id);
        const panel = sectionPanels.get(normName(row.section));
        const essay = essayFromPdf(row.testName, parsed.interpretations || [], !!panel);
        if (essay) essaysUsed.push(row.testName);

        reportResults.push({
          test: fakeId,
          testName: catalogTest?.name || row.testName,
          value: row.value,
          unit: row.unit || catalogTest?.unit || '',
          flag: row.flag || undefined,
          referenceRange: row.referenceRange
        });

        const base = catalogTest ? { ...catalogTest } : { _id: fakeId, name: row.testName, unit: row.unit };
        // Panel guidance for named panels; per-test essays only for standalones.
        base.interpretation = essay || '';
        base.sourceInterpretation = undefined;
        if (!panel && !essay && catalogTest?.interpretation) {
          base.interpretation = '';
        }

        testMap[String(fakeId)] = {
          ...base,
          reportSectionKey: key,
          reportSectionName: panel?.name || row.section || 'LAB',
          reportSectionDescription: panel?.description || ''
        };
        testMap[row.testName] = testMap[String(fakeId)];
      });

      const context = {
        profile,
        patient: {
          name: parsed.patient || `Labsmart ${id}`,
          age: age.age,
          gender: age.gender,
          registrationNumber: parsed.registrationNumber || id
        },
        bill: { billNumber: `LS-${id}`, department: 'LAB', referringDoctor: parsed.referredBy },
        report: {
          registrationNumber: parsed.registrationNumber || id,
          results: reportResults
        },
        testMap
      };

      const buffer = await reportPdf(context, {
        letterhead: true,
        footer: true,
        interpretation: true,
        endline: true,
        pageno: true,
        qr: false,
        barcode: false,
        signatures: false
      });

      const ourPdf = path.join(OUT_DIR, `${id}.pdf`);
      const ourTxt = path.join(OUT_DIR, `${id}.txt`);
      fs.writeFileSync(ourPdf, buffer);
      const ourText = pdftotext(ourPdf, ourTxt);

      const interpBlocks = parsed.interpretations || [];
      const interpScores = interpBlocks.map((block, index) =>
        tokenCoverage(ourText, block.text, `interp:${index}:${(block.section || '').slice(0, 24)}`)
      );
      const interpExpected = interpScores.reduce((sum, item) => sum + item.total, 0);
      const interpHit = interpScores.reduce((sum, item) => sum + item.hit, 0);
      const interpRatio = interpExpected ? interpHit / interpExpected : 1;
      const interpMissing = interpScores.flatMap(item => item.missing).slice(0, 25);

      const resultsScore = resultCoverage(ourText, parsed);
      const hasInterp = interpExpected > 0;
      const interpPass = !hasInterp || interpRatio >= INTERP_MIN;
      const resultsPass = resultsScore.ratio >= RESULT_MIN;
      const pass = interpPass && resultsPass;

      const row = {
        id,
        status: pass ? 'pass' : 'fail',
        patient: parsed.patient,
        labsmartRows: parsed.results.length,
        interpretationBlocks: interpBlocks.length,
        interpretationCoverage: Number((interpRatio * 100).toFixed(1)),
        interpretationHit: interpHit,
        interpretationTotal: interpExpected,
        interpretationMissing: interpMissing,
        resultsCoverage: Number((resultsScore.ratio * 100).toFixed(1)),
        resultsMissing: resultsScore.missing,
        panelsUsed: [...new Set([...sectionPanels.values()].filter(Boolean).map(panel => panel.name))],
        essaysUsed: [...new Set(essaysUsed)],
        ourPages: pageCount(buffer),
        ourPdf
      };
      results.push(row);
      console.log(
        `${row.status.toUpperCase()} ${id} ${parsed.patient || ''} `
        + `interp=${row.interpretationCoverage}%(${interpBlocks.length}) `
        + `results=${row.resultsCoverage}% pages=${row.ourPages}`
      );
      if (row.status === 'fail') {
        if (!interpPass) console.error('  interp missing', interpMissing.slice(0, 12).join(', '));
        if (!resultsPass) console.error('  result missing', resultsScore.missing.slice(0, 12).join(', '));
      }
    }
  } finally {
    await mongoose.disconnect();
  }

  const summaryPath = path.join(REPORTS_DIR, 'recreate-match-summary.json');
  const passed = results.filter(item => item.status === 'pass');
  const failed = results.filter(item => item.status === 'fail');
  const skipped = results.filter(item => item.status === 'skip');
  fs.writeFileSync(summaryPath, JSON.stringify({
    matchedAt: new Date().toISOString(),
    primary: 'interpretations',
    interpretationMin: INTERP_MIN,
    resultsMin: RESULT_MIN,
    passed: passed.length,
    failed: failed.length,
    skipped: skipped.length,
    results
  }, null, 2));
  console.log(`\n${passed.length} passed, ${failed.length} failed, ${skipped.length} skipped / ${results.length} total`);
  console.log('summary ->', summaryPath);
  if (failed.length) process.exit(1);
}

main().catch(error => {
  console.error('FAILED', error);
  process.exit(1);
});
