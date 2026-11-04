const { test } = require('node:test');
const assert = require('node:assert/strict');
const zlib = require('node:zlib');
const { reportPdf, billPdf } = require('../src/services/pdfService');
const { REFERENCE_FORMAT } = require('../src/services/documentTemplateService');

function textOf(pdf) {
  const source = pdf.toString('latin1');
  const streams = [...source.matchAll(/stream\r?\n([\s\S]*?)\nendstream/g)];
  return streams.map(match => {
    try {
      const content = zlib.inflateSync(Buffer.from(match[1], 'latin1')).toString('latin1');
      return [...content.matchAll(/<([\da-f]+)>/gi)].map(m => Buffer.from(m[1], 'hex').toString('latin1')).join('');
    } catch { return ''; }
  }).join('\n');
}
const format = { ...REFERENCE_FORMAT, useReferenceBranding: false };
const context = {
  profile: { labName: 'Test Lab', documentFormats: [format], reportFormatId: 'reference', billFormatId: 'reference' },
  patient: { name: 'Test Patient', age: 32, gender: 'M', registrationNumber: 'TEST-001' },
  report: { registrationNumber: 'TEST-001', results: [{ testName: 'Creatinine', value: '6.44', flag: 'H', referenceRange: '0.72 - 1.43' }] },
  bill: { billNumber: 'BILL-001', totalAmount: 800, paidAmount: 500, dueAmount: 300, discount: 100 },
  items: [{ name: 'Kidney Function Test', price: 900 }]
};
test('bills use their selected format and retain patient and payment details', async () => {
  const invoice = { ...format, id: 'invoice', billTitle: 'CUSTOM INVOICE', tableStyle: 'banded' };
  const pdf = await billPdf({ ...context, profile: { ...context.profile, documentFormats: [format, invoice], billFormatId: 'invoice' } });
  const text = textOf(pdf);
  assert.match(text, /CUSTOM INVOICE/);
  assert.match(text, /Test Patient/);
  for (const value of ['Rs. 900.00', 'Rs. 800.00', 'Rs. 500.00', 'Rs. 300.00']) assert.ok(text.includes(value), value);
});

test('bill header order, case number and investigation labels match the printed bill requirements', async () => {
  const profile = { ...context.profile, registrationNumber: 'LAB-REG-123', phone: '9999999999', address: 'Gonda address' };
  const qrPng = await require('../src/services/qrService').qrBuffer('https://lab.example.com/patient/report');
  const pdf = await billPdf({ ...context, profile, bill: { ...context.bill, billNumber: '0001' } }, { qrPng, qr: true });
  const text = textOf(pdf);
  const labels = ['Test Lab', 'Reg. No. LAB-REG-123', 'Phone No.: 9999999999', 'Gonda address'];
  for (let index = 0; index < labels.length; index++) {
    assert.ok(text.includes(labels[index]), labels[index]);
    if (index) assert.ok(text.indexOf(labels[index - 1]) < text.indexOf(labels[index]));
  }
  for (const label of ['Reg. no. : 0001', 'Bill No: 0001', 'S.No.', 'INVESTIGATIONS', 'Scan to view report']) assert.ok(text.includes(label), label);
  assert.ok(!text.includes('Scan to verify bill'));
});

test('bills use plain A4 or half-A4 paper even when lab letterhead is enabled', async () => {
  const branded = { ...context.profile, documentFormats: [{ ...format, useReferenceBranding: true }] };
  for (const paperSize of ['A4', 'A5']) {
    const pdf = await billPdf({ ...context, profile: branded }, { paperSize, letterhead: true, footer: true, watermark: true, qr: false });
    const source = pdf.toString('latin1');
    assert.ok(!source.includes('/Subtype /Image'), 'bill must have no letterhead, footer artwork or watermark');
    assert.match(source, paperSize === 'A4' ? /\/MediaBox\s*\[0 0 595\.28 841\.89\]/ : /\/MediaBox\s*\[0 0 595\.28 419\.53\]/);
    for (const label of ['Test Lab', 'Test Patient', 'Kidney Function Test', 'Rs. 800.00', 'Rs. 300.00']) assert.ok(textOf(pdf).includes(label), label);
  }
  await assert.rejects(async () => billPdf(context, { paperSize: 'LETTER' }), error => error.statusCode === 400);
});

test('half-A4 bills keep five test lines, QR and payment totals on one page', async () => {
  const qrPng = await require('../src/services/qrService').qrBuffer('https://example.test/bill');
  const items = Array.from({ length: 5 }, (_, i) => ({ name: `Test panel ${i + 1}`, price: 100 }));
  const pdf = await billPdf({ ...context, items, profile: { ...context.profile, address: 'Hospital Road, Basti', phone: '7701302100' } }, { paperSize: 'A5', qrPng });
  assert.equal((pdf.toString('latin1').match(/\/Type\s*\/Page\b/g) || []).length, 1);
  for (const label of ['Test panel 5', 'Balance due', 'Rs. 300.00']) assert.ok(textOf(pdf).includes(label), label);
});
test('multi-page reports retain all rows and repeat patient details and table headings', async () => {
  const results = Array.from({ length: 100 }, (_, i) => ({ testName: `Unique result ${i + 1}`, value: i, referenceRange: '0 - 99' }));
  const pdf = await reportPdf({ ...context, report: { ...context.report, results } });
  const text = textOf(pdf);
  const count = (pdf.toString('latin1').match(/\/Type\s*\/Page\b/g) || []).length;
  assert.ok(count > 1 && count < 20, `expected a bounded multi-page report, got ${count}`);
  for (let i = 1; i <= 100; i++) assert.ok(text.includes(`UNIQUE RESULT ${i}`), `missing row ${i}`);
  // Every page repeats the patient band, as the reference LIS page header does.
  assert.equal((text.match(/Test Patient/g) || []).length, count);
  assert.equal((text.match(/TESTVALUEUNITREFERENCE/g) || []).length, count);
  for (let i = 1; i <= count; i++) assert.ok(text.includes(`Page ${i} of ${count}`));
});
test('long interpretation paragraphs paginate without losing text', async () => {
  const interpretation = Array.from({ length: 250 }, (_, i) => `Note${i + 1}: a long interpretation sentence.`).join('\n');
  const pdf = await reportPdf({ ...context, testMap: { Creatinine: { interpretation } } });
  const text = textOf(pdf);
  for (let i = 1; i <= 250; i++) assert.ok(text.includes(`Note${i}:`), `missing interpretation line ${i}`);
});

test('legacy and rich interpretation paragraphs retain readable type even when results fill the page', async () => {
  for (const rich of [false, true]) {
    const explanation = 'READABLE_BODY_SENTINEL A complete explanation with comfortable paragraph spacing.';
    const interpretation = rich ? `<h3>Clinical significance</h3><p>${explanation}</p>` : `Clinical significance\n${explanation}`;
    const results = Array.from({ length: 24 }, (_, i) => ({ test: 'creatinine', testName: `Creatinine measurement ${i + 1}`, value: '1.2' }));
    const pdf = await reportPdf({ ...context, report: { ...context.report, results }, testMap: { creatinine: { _id: 'creatinine', name: 'Creatinine', interpretation } } });
    const streams = [...pdf.toString('latin1').matchAll(/stream\r?\n([\s\S]*?)\nendstream/g)].flatMap(match => {
      try { return [zlib.inflateSync(Buffer.from(match[1], 'latin1')).toString('latin1')]; } catch { return []; }
    });
    const runs = streams.flatMap(stream => [...stream.matchAll(/BT([\s\S]*?)ET/g)].map(match => ({
      size: Number(match[1].match(/\/\S+\s+([\d.]+)\s+Tf/)?.[1]),
      text: [...match[1].matchAll(/<([\da-f]+)>/gi)].map(m => Buffer.from(m[1], 'hex').toString('latin1')).join('')
    })));
    const body = runs.filter(run => run.text.includes('READABLE_BODY_SENTINEL'));
    assert.ok(body.length > 0, 'the full explanation must be rendered');
    // A standalone test's guidance is set at 85% of body size, as on the
    // Labsmart reference sheet; it must never shrink further to fit a page.
    assert.ok(body.every(run => run.size >= format.fontSize * 0.85 - 0.01), 'interpretation text must never shrink below 85% of body size');
  }
});

test('report-specific interpretation replaces complete catalog guidance and can be blank', async () => {
  const testMap = { Creatinine: { _id: 'catalog-test', name: 'Creatinine', interpretation: 'CATALOG GUIDANCE', description: 'CATALOG DESCRIPTION' } };
  const report = { ...context.report, interpretations: [{ key: 'test:catalog-test', text: 'PATIENT SPECIFIC GUIDANCE' }] };
  const custom = textOf(await reportPdf({ ...context, testMap, report }));
  assert.ok(custom.includes('PATIENT SPECIFIC GUIDANCE'));
  assert.ok(!custom.includes('CATALOG GUIDANCE') && !custom.includes('CATALOG DESCRIPTION'));
  report.interpretations[0].text = '';
  const omitted = textOf(await reportPdf({ ...context, testMap, report }));
  assert.ok(!omitted.includes('PATIENT SPECIFIC GUIDANCE') && !omitted.includes('CATALOG GUIDANCE'));
});

test('inline TLC interpretation replaces only TLC and leaves adjacent ESR guidance in the PDF', async () => {
  const testMap = {
    tlc: { _id: 'tlc', name: 'TLC', reportSectionKey: 'panel:cbc', reportSectionName: 'Blood tests', interpretation: 'ORIGINAL TLC GUIDANCE' },
    esr: { _id: 'esr', name: 'ESR', reportSectionKey: 'panel:cbc', reportSectionName: 'Blood tests', interpretation: 'ORIGINAL ESR GUIDANCE' }
  };
  const report = { ...context.report, results: [{ test: 'tlc', testName: 'TLC', value: '5000' }, { test: 'esr', testName: 'ESR', value: '10' }], interpretations: [{ key: 'result:tlc', text: 'EDITED TLC GUIDANCE' }] };
  const edited = textOf(await reportPdf({ ...context, report, testMap }));
  assert.ok(edited.includes('EDITED TLC GUIDANCE') && edited.includes('ORIGINAL ESR GUIDANCE'));
  assert.ok(!edited.includes('ORIGINAL TLC GUIDANCE'));
  report.interpretations[0].text = '';
  const omitted = textOf(await reportPdf({ ...context, report, testMap }));
  assert.ok(!omitted.includes('ORIGINAL TLC GUIDANCE') && !omitted.includes('EDITED TLC GUIDANCE'));
  assert.ok(omitted.includes('ORIGINAL ESR GUIDANCE'));
});

// Labsmart parity: rules confirmed against printed Labsmart reports.
// Imported categories are created milliseconds apart, as in production.
const haem = { name: 'Haematology', createdAt: new Date('2026-01-01T00:00:00.100Z') };
const sero = { name: 'Serology & Immunology', createdAt: new Date('2026-01-01T00:00:00.200Z') };
const bio = { name: 'Biochemistry', createdAt: new Date('2026-01-01T00:00:00.300Z') };
const pageCount = pdf => (pdf.toString('latin1').match(/\/Type\s*\/Page\b/g) || []).length;

test('Labsmart parity: panels print only panel guidance, not imported member essays or editor round-trips', async () => {
  const imported = 'Physiological basis\nIMPORTED TLC ESSAY about white cells.\nInterpretation\nIncreased in: infections.';
  const testMap = {
    tlc: { _id: 'tlc', name: 'TLC', category: haem, reportSectionKey: 'panel:cbc', reportSectionName: 'Complete Blood Count (CBC)', reportSectionDescription: 'CBC PANEL GUIDANCE', reportSectionOrder: 0, interpretation: imported, sourceInterpretation: { text: imported } },
    hb: { _id: 'hb', name: 'Hemoglobin', category: haem, reportSectionKey: 'panel:cbc', reportSectionName: 'Complete Blood Count (CBC)', reportSectionDescription: 'CBC PANEL GUIDANCE', reportSectionOrder: 1 }
  };
  // The rich editor saves the catalog text as HTML, dropping a heading word.
  const roundTrip = '<h3>Physiological basis</h3><p>IMPORTED TLC ESSAY about white cells.</p><h3>Increased in</h3><p>infections.</p>';
  const report = { ...context.report, results: [{ test: 'tlc', testName: 'TLC', value: '5000' }, { test: 'hb', testName: 'Hemoglobin', value: '14' }], interpretations: [{ key: 'result:tlc', text: roundTrip }] };
  const text = textOf(await reportPdf({ ...context, report, testMap }));
  assert.ok(text.includes('CBC PANEL GUIDANCE'));
  assert.ok(!text.includes('IMPORTED TLC ESSAY'), 'imported member essay must not print inside a panel');
  // Rows follow the panel definition, not result entry order.
  assert.ok(text.indexOf('HEMOGLOBIN') > text.indexOf('TLC'));
  report.interpretations[0].text = '<p>GENUINE LAB EDIT for this patient only.</p>';
  assert.ok(textOf(await reportPdf({ ...context, report, testMap })).includes('GENUINE LAB EDIT'));
});

test('Labsmart parity: departments print in category order, each on its own page with the patient band', async () => {
  const testMap = {
    urea: { _id: 'urea', name: 'Serum Urea', category: bio },
    hiv: { _id: 'hiv', name: 'HIV', category: sero },
    hb: { _id: 'hb', name: 'Hemoglobin', category: haem },
    // A panel must not pull its department ahead of the others.
    lft: { _id: 'lft', name: 'SGOT', category: bio, reportSectionKey: 'panel:lft', reportSectionName: 'LFT', reportSectionOrder: 0 },
    esr: { _id: 'esr', name: 'ESR', category: haem }
  };
  const report = { ...context.report, results: ['urea', 'lft', 'hiv', 'hb', 'esr'].map(id => ({ test: id, testName: testMap[id].name, value: '1' })) };
  const pdf = await reportPdf({ ...context, report, testMap });
  const text = textOf(pdf);
  assert.equal(pageCount(pdf), 3);
  assert.equal((text.match(/Test Patient/g) || []).length, 3);
  const at = label => text.indexOf(label);
  assert.ok(at('HAEMATOLOGY') < at('SEROLOGY & IMMUNOLOGY') && at('SEROLOGY & IMMUNOLOGY') < at('BIOCHEMISTRY'));
});

test('Labsmart parity: standalone tests share one table, guidance sits under its row, method in the row, blanks not dashes', async () => {
  const testMap = {
    creat: { _id: 'creat', name: 'Serum Creatinine', category: bio, unit: 'mg/dl', interpretation: 'CREATININE INLINE GUIDANCE' },
    urea: { _id: 'urea', name: 'Serum Urea', category: bio, unit: 'mg/dl' },
    ratio: { _id: 'ratio', name: 'SGOT/SGPT', category: bio, sourceInterpretation: { method: 'Calculated' } }
  };
  const report = { ...context.report, results: [{ test: 'creat', testName: 'Serum Creatinine', value: '1.2' }, { test: 'urea', testName: 'Serum Urea', value: '30' }, { test: 'ratio', testName: 'SGOT/SGPT', value: '0.9' }] };
  const pdf = await reportPdf({ ...context, report, testMap });
  const text = textOf(pdf);
  assert.equal(pageCount(pdf), 1);
  // Rows after a test's guidance start a new table with its own header, so
  // no group of results is printed without column labels.
  assert.equal((text.match(/TESTVALUEUNITREFERENCE/g) || []).length, 2, 'a new header follows the guidance');
  assert.ok(text.indexOf('CREATININE INLINE GUIDANCE') < text.lastIndexOf('TESTVALUEUNITREFERENCE'));
  assert.equal((text.match(/BIOCHEMISTRY/g) || []).length, 1);
  assert.ok(text.indexOf('SERUM CREATININE') < text.indexOf('CREATININE INLINE GUIDANCE') && text.indexOf('CREATININE INLINE GUIDANCE') < text.indexOf('SERUM UREA'));
  assert.ok(!/Interpretation/.test(text), 'no "<test> - Interpretation" banner for a single standalone test');
  assert.ok(text.includes('Method: Calculated'));
  assert.ok(!/0\.9-/.test(text), 'missing unit/range print blank, not "-"');
});

test('Labsmart parity: thousands grouping, "Mr. NAME / 30 YRS / M" band and inline "Increased in:" lead-ins', async () => {
  const testMap = { tlc: { _id: 'tlc', name: 'Total Leukocyte Count', category: haem, unit: 'cumm', interpretation: 'Increased in\nACUTE INFECTIONS and stress.' } };
  const report = { ...context.report, results: [{ test: 'tlc', testName: 'Total Leukocyte Count', value: '7800', referenceRange: '4800 - 10800' }] };
  const patient = { ...context.patient, title: 'Mr.', name: 'Parity TEST REPORT', age: 30, ageUnit: 'years', gender: 'Male' };
  const text = textOf(await reportPdf({ ...context, patient, report, testMap }));
  assert.ok(text.includes('7,800') && text.includes('4,800 - 10,800'));
  assert.ok(text.includes('Mr. Parity TEST REPORT') && text.includes('30 YRS / M'));
  assert.ok(text.includes('Increased in: ACUTE INFECTIONS'), 'lead-in label runs into its text');
});

test('a panel and its guidance are never cut across pages when they fit on one page', async () => {
  const pageTexts = pdf => [...pdf.toString('latin1').matchAll(/stream\r?\n([\s\S]*?)\nendstream/g)].map(match => {
    try { return [...zlib.inflateSync(Buffer.from(match[1], 'latin1')).toString('latin1').matchAll(/<([\da-f]+)>/gi)].map(m => Buffer.from(m[1], 'hex').toString('latin1')).join(''); } catch { return ''; }
  }).filter(text => /Test Patient/.test(text));
  const filler = Array.from({ length: 30 }, (_, i) => ({ test: `f${i}`, testName: `Filler ${i}`, value: '1' }));
  // Filler is an earlier panel in the same department, so the CBC follows it.
  const testMap = Object.fromEntries(filler.map((r, i) => [r.test, { _id: r.test, name: r.testName, category: haem, reportSectionKey: 'panel:fill', reportSectionName: 'Filler panel', reportSectionOrder: i, reportSectionRank: 1 }]));
  const cbc = Array.from({ length: 14 }, (_, i) => `c${i}`);
  cbc.forEach((id, i) => { testMap[id] = { _id: id, name: `Cbc row ${i}`, category: haem, reportSectionKey: 'panel:cbc', reportSectionName: 'Complete Blood Count (CBC)', reportSectionDescription: 'CBC PANEL NOTE '.repeat(12), reportSectionOrder: i, reportSectionRank: 2 }; });
  const report = { ...context.report, results: [...filler, ...cbc.map(id => ({ test: id, testName: testMap[id].name, value: '2' }))] };
  const pages = pageTexts(await reportPdf({ ...context, report, testMap }));
  const holder = pages.findIndex(text => text.includes('COMPLETE BLOOD COUNT (CBC)'));
  assert.ok(holder > 0, 'panel moved past the filler rows');
  assert.ok(pages[holder].includes('CBC ROW 13') && pages[holder].includes('CBC PANEL NOTE'), 'whole panel with its note on one page');
});

test('result-entry print settings: hide, skip interpretation, new page, department order, same-page categories', async () => {
  const testMap = {
    hb: { _id: 'hb', name: 'Hemoglobin', category: haem, interpretation: 'HB GUIDANCE' },
    esr: { _id: 'esr', name: 'ESR', category: haem },
    urea: { _id: 'urea', name: 'Serum Urea', category: bio, interpretation: 'UREA GUIDANCE' }
  };
  const base = { ...context.report, results: ['hb', 'esr', 'urea'].map(id => ({ test: id, testName: testMap[id].name, value: '1' })) };
  const render = async extra => { const pdf = await reportPdf({ ...context, report: { ...base, ...extra }, testMap }); return { text: textOf(pdf), pages: pageCount(pdf) }; };
  const plain = await render({});
  assert.equal(plain.pages, 2);
  assert.ok(plain.text.includes('HB GUIDANCE') && plain.text.includes('ESR'));
  const hidden = await render({ sectionSettings: [{ key: 'test:esr', printReady: false }, { key: 'test:hb', skipInterpretation: true }] });
  assert.ok(!hidden.text.includes('ESR') && !hidden.text.includes('HB GUIDANCE') && hidden.text.includes('UREA GUIDANCE'));
  const sameSheet = await render({ printCategoriesFromNewPage: false });
  assert.equal(sameSheet.pages, 1);
  const forced = await render({ printCategoriesFromNewPage: false, sectionSettings: [{ key: 'test:urea', newPage: true }] });
  assert.equal(forced.pages, 2);
  const reordered = await render({ departmentOrder: ['Biochemistry', 'Haematology'] });
  assert.ok(reordered.text.indexOf('BIOCHEMISTRY') < reordered.text.indexOf('HAEMATOLOGY'));
});

test('rich text headings, merged table cells and formatting render as PDF content without HTML markup', async () => {
  const rich = '<h2 style="text-align:center">Clinical details</h2><p>Normal <strong>bold phrase</strong> and <em>italic phrase</em> with <u>underlined phrase</u>.</p><table><tbody><tr><th colspan="2"><p>COMBINED HEADER</p></th></tr><tr><td rowspan="2"><p>GROUP LABEL</p></td><td><p>FIRST CELL</p></td></tr><tr><td><p>SECOND CELL</p></td></tr></tbody></table><ul><li><p>Bullet detail</p></li></ul>';
  const pdf = await reportPdf({ ...context, testMap: { Creatinine: { interpretation: rich } } });
  const text = textOf(pdf);
  for (const label of ['Clinical details', 'bold phrase', 'italic phrase', 'underlined phrase', 'COMBINED HEADER', 'GROUP LABEL', 'FIRST CELL', 'SECOND CELL', 'Bullet detail']) assert.ok(text.includes(label), label);
  assert.ok(!text.includes('<table>') && !text.includes('<strong>'));
  assert.ok(pdf.toString('latin1').includes('Helvetica-Oblique'));
});

test('without letterhead omits all branding while retaining patient identity and results', async () => {
  const profile = { ...context.profile, logoUrl: 'uploads/missing.png', documentFormats: [{ ...format, useReferenceBranding: true }] };
  const pdf = await reportPdf({ ...context, profile }, { letterhead: false });
  assert.ok(!pdf.toString('latin1').includes('/Subtype /Image'));
  const text = textOf(pdf);
  assert.ok(!text.includes('Test Lab'));
  assert.ok(text.includes('Test Patient') && /creatinine/i.test(text) && text.includes('6.44'));
});

test('without letterhead reserves letterheadTopMargin for preprinted stationery', async () => {
  const { spawnSync } = require('child_process');
  const { PNG } = require('pngjs');
  const fs = require('fs');
  const os = require('os');
  const path = require('path');
  const pdftoppm = process.env.PDFTOPPM_PATH
    || 'C:\\Users\\Pratyush Mishra\\AppData\\Local\\Programs\\MiKTeX\\miktex\\bin\\x64\\pdftoppm.exe';
  if (!fs.existsSync(pdftoppm)) return;
  const topMargin = 110;
  const pdf = await reportPdf({
    ...context,
    profile: { ...context.profile, letterheadTopMargin: topMargin, disclaimer: '' }
  }, { letterhead: false, footer: false, qr: false, barcode: false, signatures: false, watermark: false });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'preprint-'));
  const pdfPath = path.join(dir, 'report.pdf');
  const prefix = path.join(dir, 'page');
  fs.writeFileSync(pdfPath, pdf);
  const rendered = spawnSync(pdftoppm, ['-png', '-r', '72', '-f', '1', '-l', '1', pdfPath, prefix], { encoding: 'utf8' });
  assert.equal(rendered.status, 0, rendered.stderr || 'pdftoppm failed');
  const img = PNG.sync.read(fs.readFileSync(`${prefix}-1.png`));
  let firstInk = -1;
  for (let y = 0; y < img.height && firstInk < 0; y++) {
    for (let x = 0; x < img.width; x++) {
      const i = (img.width * y + x) << 2;
      if (img.data[i] < 250 || img.data[i + 1] < 250 || img.data[i + 2] < 250) { firstInk = y; break; }
    }
  }
  assert.ok(firstInk >= topMargin - 4, `expected content at/after ${topMargin}px, got ${firstInk}`);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('long tabular interpretations continue across pages with all cells preserved', async () => {
  const interpretation = ['Item\tMeaning\tComment', ...Array.from({ length: 180 }, (_, i) => `Item${i + 1}\tMeaning${i + 1}\tComment${i + 1}`)].join('\n');
  const pdf = await reportPdf({ ...context, testMap: { Creatinine: { interpretation } } });
  const text = textOf(pdf);
  for (let i = 1; i <= 180; i++) for (const label of ['Item', 'Meaning', 'Comment']) assert.ok(text.includes(`${label}${i}`));
  const pages = (pdf.toString('latin1').match(/\/Type\s*\/Page\b/g) || []).length;
  assert.ok(pages > 1 && pages < 20);
  assert.equal((text.match(/Test Patient/g) || []).length, pages);
});

test('saved patient-specific reference range takes precedence over generic catalog bounds', async () => {
  const pdf = await reportPdf({ ...context, testMap: { Creatinine: { normalLow: 0.72, normalHigh: 1.43 } },
    report: { ...context.report, results: [{ testName: 'Creatinine', value: '1.0', referenceRange: '0.55 - 1.13' }] } });
  assert.ok(textOf(pdf).includes('0.55 - 1.13'));
  assert.ok(!textOf(pdf).includes('0.72 - 1.43'));
});
test('disabled barcode, QR, footer and page numbers are honored on bills', async () => {
  const qrPng = await require('qrcode').toBuffer('sample');
  const pdf = await billPdf({ ...context, profile: { ...context.profile, showBarcode: false, showQR: false, showFooterByDefault: false, showPageNumber: false } }, { qrPng });
  assert.ok(!pdf.toString('latin1').includes('/Subtype /Image'));
  assert.ok(!textOf(pdf).includes('Page 1 of'));
  assert.ok(!textOf(pdf).includes('Scan to verify bill'));
});
test('narrative modality reports share the selected report title and end marker', async () => {
  const custom = { ...format, reportTitle: 'CUSTOM REPORT', endOfReportText: 'REPORT COMPLETE' };
  const pdf = await reportPdf({ ...context, profile: { ...context.profile, documentFormats: [custom] }, department: 'USG', findings: 'Sample findings' });
  const text = textOf(pdf);
  assert.match(text, /CUSTOM REPORT/); assert.match(text, /Sample findings/); assert.match(text, /REPORT COMPLETE/);
});
test('reference assets survive missing temporary uploads after a deployment', async () => {
  const profile = { labName: 'PURE PATH LAB', logoUrl: 'uploads/letterheads/missing-logo.png', letterheadUrl: 'uploads/letterheads/missing-header.png', footerUrl: 'uploads/letterheads/missing-footer.png' };
  const pdf = await reportPdf({ ...context, profile });
  const images = pdf.toString('latin1').match(/\/Subtype\s*\/Image\b/g) || [];
  assert.equal(images.length, 4, 'bundled header, watermark, footer and corner must render');
  assert.match(textOf(pdf), /Test Patient/);
  assert.ok(!textOf(pdf).includes('Test Lab'));
});

test('older reports without a range snapshot print only the matching patient range', async () => {
  const testDefinition = { referenceRange: 'Any (age 0d–3d): UP TO 10\nAny (age 12mo–100y): 0.2 - 1.2', normalLow: 0.2, normalHigh: 1.2 };
  const report = { ...context.report, results: [{ test: 'bilirubin', testName: 'Bilirubin', value: 8 }] };
  const pdf = await reportPdf({ ...context, patient: { ...context.patient, age: 2, ageUnit: 'days', gender: 'Female' }, report, testMap: { bilirubin: testDefinition } });
  const text = textOf(pdf);
  assert.ok(text.includes('UP TO 10'));
  assert.ok(!text.includes('0.2 - 1.2'));
  assert.ok(!text.includes('age 12mo'));
});
