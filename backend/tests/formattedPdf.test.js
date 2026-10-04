const { test } = require('node:test');
const assert = require('node:assert/strict');
const zlib = require('node:zlib');
const { reportPdf, billPdf } = require('../src/services/pdfService');
const { REFERENCE_FORMAT } = require('../src/services/documentTemplateService');

function textOf(pdf) {
  const source = pdf.toString('latin1');
  const streams = [...source.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)];
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
