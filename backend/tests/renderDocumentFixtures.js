// Manual visual QA: node tests/renderDocumentFixtures.js. No DB is needed.
const fs = require('fs');
const path = require('path');
const { reportPdf, billPdf } = require('../src/services/pdfService');
const { REFERENCE_FORMAT } = require('../src/services/documentTemplateService');
const QRCode = require('qrcode');
async function run() {
  const output = path.join(__dirname, '../../tmp/pdfs');
  fs.mkdirSync(output, { recursive: true });
  const at = new Date('2026-07-31T10:50:00Z');
  const context = {
    preview: true, patient: { name: 'Sample Patient', age: 32, gender: 'M', registrationNumber: 'SAMPLE-5830', phone: '0000000000' },
    referredName: 'Sample Referring Doctor',
    bill: { billNumber: 'SAMPLE-001', date: at, department: 'BIOCHEMISTRY', totalAmount: 800, paidAmount: 500, dueAmount: 300, discount: 100 },
    items: [{ name: 'Kidney Function Test', price: 900 }],
    report: { registrationNumber: 'SAMPLE-5830', tat: { registered: at, collected: at, received: at, reported: at }, results: [
      { test: 'sugar', testName: 'RANDOM BLOOD SUGAR', value: '76.30', unit: 'mg/dl', flag: 'N' },
      { test: 'urea', testName: 'SERUM UREA', value: '86.20', unit: 'mg/dl', flag: 'H' },
      { test: 'creatinine', testName: 'SERUM CREATININE', value: '6.44', unit: 'mg/dl', flag: 'H' },
      { test: 'calcium', testName: 'ICALCIUM', value: '1.09', unit: 'mmol/l', flag: 'L' }
    ] },
    testMap: { sugar: { referenceRange: '70 - 140', categoryName: 'KIDNEY FUNCTION TEST (KFT)' }, urea: { referenceRange: '19 - 45', categoryName: 'KIDNEY FUNCTION TEST (KFT)' }, creatinine: { referenceRange: '0.72 - 1.43', categoryName: 'KIDNEY FUNCTION TEST (KFT)', interpretation: 'Sample interpretation authored in the Test Database. Reports render the interpretation for each selected test.' }, calcium: { referenceRange: '1.13 - 1.33', categoryName: 'KIDNEY FUNCTION TEST (KFT)' } }
  };
  const qrPng = await QRCode.toBuffer('Format preview - sample data');
  fs.writeFileSync(path.join(output, 'reference-report.pdf'), await reportPdf(context, { qrPng }));
  fs.writeFileSync(path.join(output, 'reference-bill.pdf'), await billPdf(context, { qrPng }));
  const custom = { ...REFERENCE_FORMAT, id: 'custom', name: 'Custom', fontFamily: 'Times-Roman', fontSize: 12, rowPadding: 8, tableStyle: 'banded', accentColor: '#185b86', useReferenceBranding: false, flagPlacement: 'last', patientLayout: 'stacked', reportTitle: 'CUSTOM LAB REPORT' };
  const long = { ...context, profile: { labName: 'Example Diagnostic Centre', documentFormats: [custom], reportFormatId: 'custom', billFormatId: 'custom' }, report: { ...context.report, results: Array.from({ length: 60 }, (_, i) => ({ ...context.report.results[i % 4], testName: `Result ${i + 1} - ${context.report.results[i % 4].testName}` })) } };
  fs.writeFileSync(path.join(output, 'custom-multipage.pdf'), await reportPdf(long, { qrPng }));
  console.log('Rendered three PDF fixtures under tmp/pdfs.');
}
run().catch(error => { console.error(error); process.exitCode = 1; });
