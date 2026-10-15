process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'report-pdf-integration';
const { before, after, test } = require('node:test');
const assert = require('node:assert/strict');
const zlib = require('node:zlib');
const path = require('node:path');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Report = require('../src/models/Report');
const Patient = require('../src/models/Patient');
const Bill = require('../src/models/Bill');
const BillItem = require('../src/models/BillItem');
const Test = require('../src/models/Test');
const TestPanel = require('../src/models/TestPanel');
const Signature = require('../src/models/Signature');
const Doctor = require('../src/models/Doctor');
const TestCategory = require('../src/models/TestCategory');
const storageService = require('../src/services/storageService');
const { reportPdfDownload } = require('../src/controllers/reportController');
let database, patient, testDefinition, panel, doctor;
const admin = { _id: new mongoose.Types.ObjectId(), role: 'Admin' };

before(async () => {
  database = await MongoMemoryServer.create();
  await mongoose.connect(database.getUri());
  const category = await TestCategory.create({ name: 'Biochemistry' });
  patient = await Patient.create({ name: 'PDF Patient Identity', registrationNumber: 'PDF-001', age: 32, gender: 'Female', phone: '9999999999' });
  doctor = await Doctor.create({ name: 'PDF Referring Doctor', phone: '9999999999' });
  testDefinition = await Test.create({ name: 'ALT', code: 'ALT', price: 0, category: category._id, sampleType: 'Blood', interpretation: 'Clinical significance\nComplete catalog explanation.' });
  panel = await TestPanel.create({ name: 'Liver Function Test', price: 0, tests: [testDefinition._id] });
});
after(async () => { await mongoose.disconnect(); await database?.stop(); });

async function fixture() {
  const bill = await Bill.create({ billNumber: `PDF-${new mongoose.Types.ObjectId()}`, patient: patient._id, totalAmount: 0, dueAmount: 0, createdBy: admin._id, referringDoctor: doctor._id });
  await BillItem.create({ billId: bill._id, itemType: 'TestPanel', itemId: panel._id, name: panel.name, price: 0 });
  return Report.create({ patient: patient._id, bill: bill._id, registrationNumber: 'PDF-001', uploadedBy: admin._id, entryMode: 'inhouse', results: [{ test: testDefinition._id, testName: 'ALT', value: '42', unit: 'U/L' }] });
}
async function render(report, query = {}, user = admin, requestHeaders = {}) {
  const headers = {};
  const res = { statusCode: 200, setHeader(name, value) { headers[name] = value; }, send(bytes) { this.bytes = bytes; return this; }, status(code) { this.statusCode = code; return this; }, end() { return this; } };
  await reportPdfDownload({ params: { id: String(report._id) }, query, user, headers: requestHeaders }, res, error => { throw error; });
  return { bytes: res.bytes, headers, status: res.statusCode };
}
function textOf(pdf) {
  return [...pdf.toString('latin1').matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)].map(match => {
    try {
      const stream = zlib.inflateSync(Buffer.from(match[1], 'latin1')).toString('latin1');
      return [...stream.matchAll(/<([\da-f]+)>/gi)].map(m => Buffer.from(m[1], 'hex').toString('latin1')).join('');
    } catch { return ''; }
  }).join('\n');
}

test('parallel PDF loading retains patient, referring doctor, panel, guidance and QR', async () => {
  const report = await fixture();
  const { bytes, headers } = await render(report);
  assert.equal(headers['Content-Type'], 'application/pdf');
  const text = textOf(bytes);
  for (const label of ['PDF Patient Identity', 'PDF Referring Doctor', 'LIVER FUNCTION TEST', '42', 'Complete catalog explanation.']) assert.ok(text.includes(label), label);
  assert.ok((await Report.findById(report._id)).qrToken, 'PDF creates the persistent verification token');
});

test('successive previews reflect changed results and interpretation immediately', async () => {
  const report = await fixture();
  const before = await render(report, { qr: '0' });
  await Report.updateOne({ _id: report._id }, { $set: { 'results.0.value': '97', interpretations: [{ key: `result:${testDefinition._id}`, text: 'UPDATED CLINICAL EXPLANATION' }] } });
  const after = await render(report, { qr: '0' });
  assert.ok(!textOf(before.bytes).includes('UPDATED CLINICAL EXPLANATION'));
  assert.ok(textOf(after.bytes).includes('UPDATED CLINICAL EXPLANATION'));
  assert.ok(textOf(after.bytes).includes('97'));
});

test('disabled QR and signature options avoid token writes and branding in preprinted mode', async () => {
  const report = await fixture();
  const { bytes } = await render(report, { letterhead: '0', qr: '0', signatures: '0' });
  assert.equal((await Report.findById(report._id)).qrToken, null);
  assert.ok(!bytes.toString('latin1').includes('/Subtype /Image'));
  assert.ok(textOf(bytes).includes('PDF Patient Identity'));
});

test('asynchronous signature loading preserves the recorded signatory', async () => {
  const report = await fixture();
  const signature = await Signature.create({ name: 'RECORDED PATHOLOGIST', title: 'MD Pathology', imageUrl: 'pdf-signature-test-image' });
  report.signatures = [{ signature: signature._id, signedBy: admin._id, signedAt: new Date() }];
  await report.save();
  const original = storageService.getFilePath;
  storageService.getFilePath = function (value) {
    return value === 'pdf-signature-test-image' ? path.resolve(__dirname, '../src/assets/document-formats/reference-watermark.jpg') : original.call(this, value);
  };
  try {
    const { bytes } = await render(report, { letterhead: '0', qr: '0' });
    const text = textOf(bytes);
    assert.ok(text.includes('RECORDED PATHOLOGIST') && text.includes('MD Pathology'));
    assert.ok(bytes.toString('latin1').includes('/Subtype /Image'));
  } finally { storageService.getFilePath = original; }
});

test('parallel loading still checks branch access before reading report dependencies', async () => {
  const report = await fixture();
  report.branch = new mongoose.Types.ObjectId(); await report.save();
  await render(report); // Warm cache must never bypass the authorization check.
  await assert.rejects(render(report, {}, { ...admin, role: 'Employee', branch: new mongoose.Types.ObjectId() }), error => error.statusCode === 403);
  assert.ok((await Report.findById(report._id)).qrToken);
  await assert.rejects(render({ _id: new mongoose.Types.ObjectId() }), error => error.statusCode === 404);
});

test('unchanged PDFs reuse rendered bytes and client ETags revalidate without regeneration', async () => {
  const report = await fixture();
  const first = await render(report);
  const second = await render(report);
  assert.equal(first.headers['X-Report-PDF-Cache'], 'MISS');
  assert.equal(second.headers['X-Report-PDF-Cache'], 'HIT');
  assert.equal(first.headers.ETag, second.headers.ETag);
  assert.deepEqual(first.bytes, second.bytes);
  const { reportPdfCache } = require('../src/services/reportPdfCache');
  reportPdfCache.clear(); // Client-held PDFs also survive a cold server cache.
  const revalidated = await render(report, {}, admin, { 'if-none-match': first.headers.ETag });
  assert.equal(revalidated.status, 304);
  assert.equal(revalidated.bytes, undefined);
  assert.equal(revalidated.headers['X-Report-PDF-Cache'], 'REVALIDATED');
  const without = await render(report, { letterhead: '0' });
  assert.notEqual(without.headers.ETag, first.headers.ETag);
});

test('concurrent first previews retain one QR token and share the generated PDF', async () => {
  const report = await fixture();
  const [first, second] = await Promise.all([render(report), render(report)]);
  assert.equal(first.headers.ETag, second.headers.ETag);
  assert.deepEqual(first.bytes, second.bytes);
  assert.ok(['HIT', 'SHARED'].includes(second.headers['X-Report-PDF-Cache']) || ['HIT', 'SHARED'].includes(first.headers['X-Report-PDF-Cache']));
});

test('catalog, patient and lab format edits invalidate a PDF even when the report itself is unchanged', async () => {
  const report = await fixture();
  const first = await render(report, { qr: '0' });
  await Test.updateOne({ _id: testDefinition._id }, { $set: { interpretation: 'FRESH CATALOG EXPLANATION' } });
  const catalogEdit = await render(report, { qr: '0' }, admin, { 'if-none-match': first.headers.ETag });
  assert.equal(catalogEdit.status, 200);
  assert.notEqual(catalogEdit.headers.ETag, first.headers.ETag);
  assert.ok(textOf(catalogEdit.bytes).includes('FRESH CATALOG EXPLANATION'));
  await Patient.updateOne({ _id: patient._id }, { $set: { name: 'CORRECTED PATIENT IDENTITY' } });
  const patientEdit = await render(report, { qr: '0' }, admin, { 'if-none-match': catalogEdit.headers.ETag });
  assert.notEqual(patientEdit.headers.ETag, catalogEdit.headers.ETag);
  assert.ok(textOf(patientEdit.bytes).includes('CORRECTED PATIENT IDENTITY'));
  const LabProfile = require('../src/models/LabProfile');
  const profile = await LabProfile.create({ showWatermark: false });
  const formatEdit = await render(report, { qr: '0' }, admin, { 'if-none-match': patientEdit.headers.ETag });
  assert.notEqual(formatEdit.headers.ETag, patientEdit.headers.ETag);
  await LabProfile.deleteOne({ _id: profile._id });
});
