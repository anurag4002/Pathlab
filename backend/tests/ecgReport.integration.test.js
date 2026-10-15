process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'ecg-upload-fixture';
const { before, after, test } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const ModalityCase = require('../src/models/ModalityCase');
const Patient = require('../src/models/Patient');
const { uploadCaseReport, downloadCaseReport, listCases } = require('../src/controllers/modalityController');
const printReport = require('../src/controllers/narrativePdfController').forModel(ModalityCase, 'REPORT');
const { getPDFDocument } = require('../src/services/pdfService');
const { qrBuffer } = require('../src/services/qrService');
require('../src/models/Bill'); require('../src/models/Doctor');
let database, patient, samplePdf;
const admin = { _id: new mongoose.Types.ObjectId(), role: 'Admin' };
async function call(handler, doc, { file, user = admin, query = {} } = {}) {
  const res = { statusCode: 200, headers: {}, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; },
    setHeader(name, value) { this.headers[name] = value; }, type(value) { this.headers.type = value; return this; },
    attachment(name) { this.headers.attachment = name; return this; }, send(bytes) { this.bytes = bytes; return this; } };
  await handler({ params: { id: String(doc?._id || '') }, query, file, user }, res, error => { throw error; });
  return res;
}
const fixture = fields => ModalityCase.create({ patient: patient._id, modality: 'ECG', procedure: 'ECG', createdBy: admin._id, ...fields });
const upload = data => ({ buffer: data, originalname: 'ECG-machine-report.pdf', mimetype: 'application/pdf' });
before(async () => {
  database = await MongoMemoryServer.create(); await mongoose.connect(database.getUri());
  patient = await Patient.create({ name: 'ECG Test Patient', registrationNumber: 'ECG-001', age: 33, gender: 'Female', phone: '9999999999' });
  const PDFDocument = getPDFDocument(); const doc = new PDFDocument();
  const done = new Promise(resolve => { const parts = []; doc.on('data', data => parts.push(data)); doc.on('end', () => resolve(Buffer.concat(parts))); });
  doc.text('ECG MACHINE TRACING - ORIGINAL'); doc.end(); samplePdf = await done;
});
after(async () => { await mongoose.disconnect(); await database?.stop(); });

test('ECG uploads persist in MongoDB and print the original PDF without template additions', async () => {
  const doc = await fixture();
  const saved = await call(uploadCaseReport, doc, { file: upload(samplePdf) });
  assert.equal(saved.statusCode, 200); assert.equal(saved.body.data.status, 'Reported');
  assert.equal(saved.body.data.reportFile.data, undefined, 'binary data must not leak into JSON');
  assert.equal((await ModalityCase.findById(doc._id)).reportFile.data, undefined);
  const fromDatabase = await ModalityCase.findById(doc._id).select('+reportFile.data');
  assert.deepEqual(Buffer.from(fromDatabase.reportFile.data), samplePdf);
  const printed = await call(printReport, doc, { query: { letterhead: '1', footer: '1', watermark: '1' } });
  assert.deepEqual(Buffer.from(printed.bytes), samplePdf, 'ECG PDF must be passed through unchanged');
  const downloaded = await call(downloadCaseReport, doc);
  assert.deepEqual(Buffer.from(downloaded.bytes), samplePdf);
  const list = await call(listCases, null, { query: { modality: 'ECG' } });
  assert.equal(list.body.data.cases[0].reportFile.data, undefined);
});

test('uploaded ECG images become image-only A4 PDFs with no lab lettering', async () => {
  const doc = await fixture(); const image = await qrBuffer('ECG image fixture');
  await call(uploadCaseReport, doc, { file: { buffer: image, originalname: 'ECG.png', mimetype: 'image/png' } });
  const printed = await call(printReport, doc);
  assert.equal(printed.bytes.subarray(0, 5).toString(), '%PDF-');
  const source = printed.bytes.toString('latin1');
  assert.match(source, /\/MediaBox\s*\[0 0 595\.28 841\.89\]/);
  assert.ok(source.includes('/Subtype /Image'));
  assert.ok(!source.includes('/Type /Font'), 'no letterhead or patient-band text is added');
});

test('missing and invalid ECG uploads fail without changing the saved report', async () => {
  const doc = await fixture();
  assert.equal((await call(uploadCaseReport, doc)).statusCode, 400);
  assert.equal((await call(uploadCaseReport, doc, { file: upload(Buffer.from('invalid file')) })).statusCode, 400);
  assert.equal((await ModalityCase.findById(doc._id)).status, 'Registered');
  await assert.rejects(call(printReport, doc), error => error.statusCode === 404);
  assert.equal((await call(downloadCaseReport, doc)).statusCode, 404);
});

test('branch access and signed ECG reports remain protected', async () => {
  const doc = await fixture({ branch: new mongoose.Types.ObjectId() });
  const employee = { ...admin, role: 'Employee', branch: new mongoose.Types.ObjectId() };
  await assert.rejects(call(uploadCaseReport, doc, { file: upload(samplePdf), user: employee }), error => error.statusCode === 403);
  await assert.rejects(call(printReport, doc, { user: employee }), error => error.statusCode === 403);
  await assert.rejects(call(downloadCaseReport, doc, { user: employee }), error => error.statusCode === 403);
  await ModalityCase.updateOne({ _id: doc._id }, { $set: { status: 'Signed' } });
  assert.equal((await call(uploadCaseReport, doc, { file: upload(samplePdf) })).statusCode, 409);
});
