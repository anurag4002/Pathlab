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
  for (let i = 1; i <= 100; i++) assert.ok(text.includes(`Unique result ${i}`), `missing row ${i}`);
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
    assert.ok(body.every(run => run.size >= 10.5), 'interpretation text must never shrink to fit the result page');
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
  assert.ok(text.includes('Test Patient') && text.includes('Creatinine') && text.includes('6.44'));
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
