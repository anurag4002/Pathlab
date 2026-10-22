const { before, test } = require('node:test');
const assert = require('node:assert/strict');
const zlib = require('node:zlib');
const appPanels = require('./fixtures/labsmart/panels.app.json');
const { reportPdf } = require('../src/services/pdfService');
const { REFERENCE_FORMAT } = require('../src/services/documentTemplateService');
const {
  assertCovers,
  loadLabsmartWebsiteSource
} = require('./helpers/labsmartParity');

let website;

before(async () => {
  website = await loadLabsmartWebsiteSource();
});

function textOf(pdf) {
  return [...pdf.toString('latin1').matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)].map(match => {
    try {
      const stream = zlib.inflateSync(Buffer.from(match[1], 'latin1')).toString('latin1');
      return [...stream.matchAll(/<([\da-f]+)>/gi)].map(m => Buffer.from(m[1], 'hex').toString('latin1')).join('');
    } catch {
      return '';
    }
  }).join('\n');
}

function pageCount(pdf) {
  return (pdf.toString('latin1').match(/\/Type\s*\/Page\b/g) || []).length;
}

const format = { ...REFERENCE_FORMAT, useReferenceBranding: false };
const profile = {
  labName: 'Parity Lab',
  documentFormats: [format],
  reportFormatId: 'reference',
  showLetterheadByDefault: false,
  showFooterByDefault: false,
  showWatermark: false,
  showBarcode: false,
  showQR: false,
  showSignatures: false
};
const patient = { name: 'Parity Patient', age: 40, gender: 'Male', registrationNumber: 'PARITY-001' };
const printOptions = {
  letterhead: false, footer: false, watermark: false, barcode: false, qr: false,
  signatures: false, pageno: true, interpretation: true, endline: true
};

const membersByPanel = {
  'Complete Blood Count (CBC)': ['Hemoglobin', 'Total Leukocyte Count'],
  'Kidney Function Test (KFT)': ['Creatinine', 'Blood Urea'],
  'Liver Function Test (LFT)': ['Serum Bilirubin (Indirect)', 'SGPT (ALT)'],
  'Blood Sugar Fasting & PP': ['Blood Sugar Fasting', 'Blood Sugar PP'],
  'Iron Studies': ['Iron', 'TIBC'],
  'Thyroid Function Test (TFT)': ['T3', 'TSH'],
  'Free Thyroid Function Test (FTFT)': ['Free T4', 'TSH'],
  'Viral Marker': ['HbsAg', 'Anti HCV']
};

async function renderFromWebsitePanel(labsmartPanel) {
  const app = appPanels.find(panel => panel.name === labsmartPanel.name);
  assert.ok(app, labsmartPanel.name);
  const members = membersByPanel[labsmartPanel.name] || [`${labsmartPanel.name} A`, `${labsmartPanel.name} B`];
  const essaySamples = website.tests.slice(0, 2);
  const results = [];
  const testMap = {};
  members.forEach((name, index) => {
    const id = `m-${index}`;
    const essay = essaySamples[index % essaySamples.length];
    results.push({ test: id, testName: name, value: String(10 + index), unit: 'U/L', referenceRange: '0 - 40' });
    testMap[id] = {
      _id: id,
      name,
      reportSectionKey: `panel:${labsmartPanel.name}`,
      reportSectionName: labsmartPanel.name,
      reportSectionDescription: app.description,
      interpretation: essay.text,
      sourceInterpretation: { text: essay.text, method: 'Calculated' }
    };
  });
  const pdf = await reportPdf({
    profile,
    patient,
    bill: { billNumber: 'PARITY', department: 'LAB' },
    report: { registrationNumber: 'PARITY-001', results },
    testMap
  }, printOptions);
  return { pdf, text: textOf(pdf), pages: pageCount(pdf) };
}

test('PDF for every Labsmart website panel matches that panel interpretation', async () => {
  assert.equal(website.panels.length, 8);
  const failures = [];
  for (const panel of website.panels) {
    const { text, pages } = await renderFromWebsitePanel(panel);
    try {
      assertCovers(text, panel.text, `PDF ${panel.name}`, 0.85);
      assert.equal((text.match(/~~~ End of report ~~~/g) || []).length, 1, panel.name);
      assert.ok(pages >= 1 && pages <= 4, `${panel.name} pages=${pages}`);
      assert.ok(!/method\s*:\s*calculated/i.test(text), panel.name);
    } catch (error) {
      failures.push(error.message);
    }
  }
  assert.equal(failures.length, 0, failures.join('\n') || 'ok');
});

test('PDF for every Labsmart website test interpretation matches when printed alone', async () => {
  const batchSize = 8;
  const failures = [];
  for (let start = 0; start < website.tests.length; start += batchSize) {
    const batch = website.tests.slice(start, start + batchSize);
    const results = [];
    const testMap = {};
    batch.forEach((item, index) => {
      const id = `t-${start + index}`;
      results.push({ test: id, testName: item.name, value: '1', unit: '-', referenceRange: '-' });
      testMap[id] = {
        _id: id,
        name: item.name,
        reportSectionKey: `test:${id}`,
        reportSectionName: item.name,
        interpretation: item.text,
        sourceInterpretation: { text: item.text }
      };
    });
    const pdf = await reportPdf({
      profile,
      patient,
      bill: { billNumber: `BATCH-${start}`, department: 'LAB' },
      report: { registrationNumber: 'PARITY-001', results },
      testMap
    }, printOptions);
    const text = textOf(pdf);
    for (const item of batch) {
      try {
        assertCovers(text, item.text, `PDF test ${item.name}`, 0.8);
      } catch (error) {
        failures.push(error.message);
      }
    }
    assert.equal((text.match(/~~~ End of report ~~~/g) || []).length, 1, `batch ${start}`);
  }
  assert.equal(failures.length, 0, failures.slice(0, 10).join('\n') || 'ok');
});

test('multi-panel PDF matches all 8 Labsmart website panel interpretations together', async () => {
  const results = [];
  const testMap = {};
  website.panels.forEach((panel, panelIndex) => {
    const app = appPanels.find(item => item.name === panel.name);
    const members = membersByPanel[panel.name] || [`${panel.name} A`];
    members.forEach((name, index) => {
      const id = `x-${panelIndex}-${index}`;
      results.push({ test: id, testName: name, value: '1', unit: 'U/L', referenceRange: '0 - 40' });
      testMap[id] = {
        _id: id,
        name,
        reportSectionKey: `panel:${panel.name}`,
        reportSectionName: panel.name,
        reportSectionDescription: app.description,
        interpretation: website.tests[panelIndex].text,
        sourceInterpretation: { text: website.tests[panelIndex].text }
      };
    });
  });
  const pdf = await reportPdf({
    profile,
    patient,
    bill: { billNumber: 'MULTI', department: 'LAB' },
    report: { registrationNumber: 'PARITY-001', results },
    testMap
  }, printOptions);
  const text = textOf(pdf);
  const failures = [];
  for (const panel of website.panels) {
    try {
      assertCovers(text, panel.text, `multi ${panel.name}`, 0.8);
    } catch (error) {
      failures.push(error.message);
    }
  }
  assert.equal(failures.length, 0, failures.join('\n') || 'ok');
  assert.equal((text.match(/~~~ End of report ~~~/g) || []).length, 1);
  assert.ok(pageCount(pdf) >= 2 && pageCount(pdf) <= 14);
});
