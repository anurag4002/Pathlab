// An outsourced report's files can be published to the patient one at a time:
// a test back from the outside lab is shared while the others are still out.
// Unpublished files never leave the lab (portal, referrer, public QR link);
// lab staff can still download everything. Older files count as published.
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'report-file-publishing';
const { before, after, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Patient = require('../src/models/Patient');
const Bill = require('../src/models/Bill');
const Report = require('../src/models/Report');
const Test = require('../src/models/Test');
const TestCategory = require('../src/models/TestCategory');
const Sequence = require('../src/models/Sequence');
const Doctor = require('../src/models/Doctor');
const Activity = require('../src/models/Activity');
for (const model of ['Agent', 'User', 'Branch', 'TestPackage', 'TestPanel', 'USGCase', 'XrayCase', 'ModalityCase']) {
  try { require(`../src/models/${model}`); } catch { /* optional model */ }
}
const patientService = require('../src/services/patientService');
const billService = require('../src/services/billService');
const reportService = require('../src/services/reportService');
const storageService = require('../src/services/storageService');
const reportController = require('../src/controllers/reportController');
const portal = require('../src/controllers/patientPortalController');
const referrer = require('../src/controllers/referrerController');
const publicController = require('../src/controllers/publicController');
const { newPublicToken } = require('../src/services/qrService');

const admin = { _id: new mongoose.Types.ObjectId(), role: 'Admin' };
let database, patient, kft, doctor, tmpDir, realEnsure;

function makeRes() {
  return {
    statusCode: 200,
    status(value) { this.statusCode = value; return this; },
    json(value) { this.body = JSON.parse(JSON.stringify(value)); return this; },
    download(file, name) { this.downloaded = { file, name }; return this; },
    send(value) { this.sent = value; return this; },
    setHeader() { return this; },
    set() { return this; },
    type() { return this; },
    end() { return this; }
  };
}
async function call(handler, request = {}) {
  const res = makeRes();
  let failure = null;
  await handler({ user: admin, query: {}, params: {}, body: {}, headers: {}, ...request }, res, (error) => { failure = error; });
  if (failure) throw failure;
  return res;
}
const custom = (name) => ({ itemType: 'Custom', itemId: null, name, price: 400 });
const line = (record) => ({ itemType: 'Test', itemId: record._id, name: record.name, price: record.price || 100 });
const fakeFile = (name) => ({ filename: `${name}-${new mongoose.Types.ObjectId()}.pdf`, originalname: `${name}.pdf`, mimetype: 'application/pdf' });
const asPatient = (request = {}) => ({ patientPhone: patient.phone, patientIds: [patient._id], ...request });
const asReferrer = (request = {}) => ({ referrer: { doctors: [doctor], ids: [doctor._id], idSet: new Set([String(doctor._id)]) }, ...request });

before(async () => {
  database = await MongoMemoryServer.create();
  await mongoose.connect(database.getUri());
  await Promise.all([Patient.init(), Bill.init(), Sequence.init()]);
  const category = await TestCategory.create({ name: 'Biochemistry' });
  kft = await Test.create({ name: 'Kidney Function Test (KFT)', code: 'KFT', category: category._id, sampleType: 'Blood', price: 500,
    parameters: [{ code: 'CREAT', name: 'Creatinine', unit: 'mg/dL' }] });
  patient = await patientService.createPatient({ name: 'Publish Patient', age: 40, birthYear: 1986, gender: 'Female', phone: '9999999992' });
  doctor = await Doctor.create({ name: 'Dr. Publish', phone: '9876500099' });
  // Uploaded files live on disk; point every stored url at one temp file.
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ppl-publish-'));
  const tmpFile = path.join(tmpDir, 'report.pdf');
  fs.writeFileSync(tmpFile, '%PDF-1.4\n%%EOF\n');
  realEnsure = storageService.ensureFilePath;
  storageService.ensureFilePath = async (url) => (url ? tmpFile : null);
});
after(async () => {
  storageService.ensureFilePath = realEnsure;
  fs.rmSync(tmpDir, { recursive: true, force: true });
  await mongoose.disconnect();
  await database?.stop();
});

const newOutsourceReport = async (names) => {
  const bill = await billService.createBill({ patient: patient._id, department: 'LAB', referringDoctor: doctor._id, items: [line(kft), ...names.map(custom)] }, admin._id);
  const report = await Report.findOne({ bill: bill._id, entryMode: 'outsource' });
  report.qrToken = newPublicToken(process.env.JWT_SECRET);
  await report.save();
  return report;
};
const portalCard = async (report) => (await call(portal.getPatientReports, asPatient())).body.data.find((card) => String(card.id) === String(report._id));
const referrerRow = async (report) => {
  const res = await call(referrer.listCases, asReferrer({ query: { limit: '50' } }));
  for (const row of res.body.data.cases) {
    const found = (row.reports || []).find((r) => String(r._id) === String(report._id));
    if (found) return found;
  }
  return null;
};

test('publish one of two outsourced tests: portal lists it and it downloads; the other stays hidden', async () => {
  let report = await newOutsourceReport(['HbA1c', 'Vitamin D']);
  report = await reportService.attachReportFile(report._id, fakeFile('hba1c'), admin, { tests: ['HbA1c'], publish: true });
  const shared = report.files[0];
  report = await reportService.attachReportFile(report._id, fakeFile('vitd'), admin, { tests: ['Vitamin D'], publish: false });
  const held = report.files[1];
  assert.equal(report.status, 'Completed', 'both tests have a file: status rule unchanged');
  assert.equal(shared.published, true);
  assert.equal(held.published, false);

  const card = await portalCard(report);
  assert.equal(card.downloadable, true);
  assert.deepEqual(card.files.map((f) => f._id), [String(shared._id)], 'only the published file is listed');
  assert.deepEqual(card.waitingTests, ['Vitamin D']);
  assert.equal(card.readySummary, '1 of 2 ready — Vitamin D still with the outside lab');

  const ok = await call(portal.downloadPatientReport, asPatient({ params: { id: String(report._id) }, query: { file: String(shared._id) } }));
  assert.ok(ok.downloaded, 'published file downloads for the patient');
  const defaultFile = await call(portal.downloadPatientReport, asPatient({ params: { id: String(report._id) } }));
  assert.ok(defaultFile.downloaded, 'no file id: the newest published file');

  // Unpublished file: refused to patient, referrer and public link; lab gets it.
  const patientDenied = await call(portal.downloadPatientReport, asPatient({ params: { id: String(report._id) }, query: { file: String(held._id) } }));
  assert.equal(patientDenied.statusCode, 403);
  assert.ok(!patientDenied.downloaded);
  const referrerDenied = await call(referrer.reportPdf, asReferrer({ params: { id: String(report._id) }, query: { file: String(held._id) } }));
  assert.equal(referrerDenied.statusCode, 403);
  const publicDenied = await call(publicController.downloadPublicReport, { params: { token: report.qrToken }, query: { file: String(held._id) } });
  assert.equal(publicDenied.statusCode, 403);
  const lab = await call(reportController.downloadReport, { params: { id: String(report._id) }, query: { file: String(held._id) } });
  assert.equal(lab.statusCode, 200);
  assert.ok(lab.downloaded, 'lab staff can download an unpublished file');

  const referrerOk = await call(referrer.reportPdf, asReferrer({ params: { id: String(report._id) }, query: { file: String(shared._id) } }));
  assert.ok(referrerOk.downloaded);
  const verify = await call(publicController.verifyReport, { params: { token: report.qrToken } });
  assert.deepEqual(verify.body.data.files.map((f) => f._id), [String(shared._id)], 'the shared link lists published files only');
  const publicOk = await call(publicController.downloadPublicReport, { params: { token: report.qrToken }, query: { file: String(shared._id) } });
  assert.ok(publicOk.downloaded);
});

test('a partly uploaded report shows its published file while the rest is waiting', async () => {
  let report = await newOutsourceReport(['HbA1c', 'Vitamin D']);
  report = await reportService.attachReportFile(report._id, fakeFile('hba1c'), admin, { tests: ['HbA1c'] });
  assert.equal(report.status, 'Draft', 'still waiting for Vitamin D');
  const card = await portalCard(report);
  assert.equal(card.downloadable, true, 'not hidden behind "still working on it"');
  assert.equal(card.partial, true);
  assert.equal(card.files.length, 1);
  const row = await referrerRow(report);
  assert.ok(row, 'the report is on the referrer cases');
  assert.equal(row.ready, true);
  assert.equal(row.files.length, 1);
  assert.deepEqual(row.waitingTests, ['Vitamin D']);
  const res = await call(referrer.reportPdf, asReferrer({ params: { id: String(report._id) } }));
  assert.ok(res.downloaded, 'referrer gets the published file of a partial report');
});

test('publish / unpublish from the lab: hides and shows again, and is logged', async () => {
  let report = await newOutsourceReport(['HbA1c']);
  report = await reportService.attachReportFile(report._id, fakeFile('hba1c'), admin, { tests: ['HbA1c'] });
  const fileId = String(report.files[0]._id);

  const hide = await call(reportController.publishReportFile, { params: { id: String(report._id), fileId }, body: { published: false } });
  assert.equal(hide.statusCode, 200);
  assert.equal(hide.body.data.files[0].published, false);
  let card = await portalCard(report);
  assert.equal(card.files.length, 0);
  assert.equal(card.downloadable, false);
  const denied = await call(portal.downloadPatientReport, asPatient({ params: { id: String(report._id) } }));
  assert.equal(denied.statusCode, 403, 'nothing published: nothing to download');
  assert.equal((await call(publicController.downloadPublicReport, { params: { token: report.qrToken } })).statusCode, 403);
  assert.equal((await call(referrer.reportPdf, asReferrer({ params: { id: String(report._id) } }))).statusCode, 403);

  const show = await call(reportController.publishReportFile, { params: { id: String(report._id), fileId }, body: { published: true } });
  assert.equal(show.body.data.files[0].published, true);
  card = await portalCard(report);
  assert.equal(card.files.length, 1);
  assert.equal(card.downloadable, true);
  assert.equal(await Activity.countDocuments({ action: { $in: ['Publish Report File', 'Unpublish Report File'] } }), 2);
});

test('legacy file (fileUrl only, no published flag) stays visible to the patient', async () => {
  const report = await newOutsourceReport(['HbA1c', 'Vitamin D']);
  await Report.updateOne({ _id: report._id }, { $set: { fileUrl: 'uploads/reports/legacy.pdf', status: 'Completed' } });
  const card = await portalCard(report);
  assert.equal(card.downloadable, true);
  assert.equal(card.files.length, 1);
  assert.equal(card.files[0].legacy, true);
  const res = await call(portal.downloadPatientReport, asPatient({ params: { id: String(report._id) } }));
  assert.ok(res.downloaded);
  // A stored file without the flag (uploaded before publishing existed) too.
  await Report.updateOne({ _id: report._id }, { $set: { files: [{ url: 'uploads/reports/old.pdf', tests: ['HbA1c', 'Vitamin D'] }] } });
  const again = await portalCard(report);
  assert.equal(again.files.length, 1);
  assert.equal(again.files[0].published, true);
});

test('an in-house report reaches the patient only once it is finished', async () => {
  const report = await Report.create({ patient: patient._id, bill: new mongoose.Types.ObjectId(), uploadedBy: admin._id, registrationNumber: `IH-${Date.now()}`, entryMode: 'inhouse', status: 'Draft',
    results: [{ test: kft._id, testName: 'Creatinine', value: '1.1' }] });
  const draft = await call(portal.downloadPatientReport, asPatient({ params: { id: String(report._id) } }));
  assert.equal(draft.statusCode, 403, 'draft values never leave the lab');
  assert.ok(!draft.sent && !draft.downloaded);
  await Report.updateOne({ _id: report._id }, { $set: { status: 'Signed' } });
  const signed = await call(portal.downloadPatientReport, asPatient({ params: { id: String(report._id) } }));
  assert.equal(signed.statusCode, 200);
  assert.ok(signed.sent, 'signed report is rendered for the patient');
});
