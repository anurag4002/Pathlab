// A mixed bill (catalog + typed outsource lines) gets an in-house and an
// outsource report. Every place that names a report's tests must list only
// that report's own tests; imaging lines belong to neither. Outsource files
// are tagged with the tests they contain.
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'report-test-names';
const { before, after, test } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Patient = require('../src/models/Patient');
const Bill = require('../src/models/Bill');
const Report = require('../src/models/Report');
const Test = require('../src/models/Test');
const TestCategory = require('../src/models/TestCategory');
const Sequence = require('../src/models/Sequence');
for (const model of ['Doctor', 'Agent', 'User', 'Branch', 'TestPackage', 'TestPanel', 'Activity', 'USGCase', 'XrayCase']) require(`../src/models/${model}`);
const patientService = require('../src/services/patientService');
const billService = require('../src/services/billService');
const reportService = require('../src/services/reportService');
const reportController = require('../src/controllers/reportController');
const { reportTestNames, reportItems } = require('../src/utils/billItemModality');
const { fileCoverage, outsourceTestNames, addReportFile } = require('../src/utils/reportFiles');

const admin = { _id: new mongoose.Types.ObjectId(), role: 'Admin' };
let database, patient, lipid, kft;

async function call(handler, request = {}) {
  const res = { statusCode: 200, status(value) { this.statusCode = value; return this; }, json(value) { this.body = JSON.parse(JSON.stringify(value)); return this; } };
  let failure = null;
  await handler({ user: admin, query: {}, params: {}, body: {}, ...request }, res, (error) => { failure = error; });
  if (failure) throw failure;
  return res;
}
const line = (record) => ({ itemType: 'Test', itemId: record._id, name: record.name, price: record.price || 100 });
const custom = (name) => ({ itemType: 'Custom', itemId: null, name, price: 400 });
const fakeFile = (name) => ({ filename: `${name}-${new mongoose.Types.ObjectId()}.pdf`, originalname: `${name}.pdf`, mimetype: 'application/pdf' });

before(async () => {
  database = await MongoMemoryServer.create();
  await mongoose.connect(database.getUri());
  await Promise.all([Patient.init(), Bill.init(), Sequence.init()]);
  const category = await TestCategory.create({ name: 'Biochemistry' });
  lipid = await Test.create({ name: 'Lipid Profile (bundle)', code: 'LIPID', category: category._id, sampleType: 'Blood', price: 600,
    parameters: [{ code: 'CHOL', name: 'Cholesterol', unit: 'mg/dL' }] });
  kft = await Test.create({ name: 'Kidney Function Test (KFT)', code: 'KFT', category: category._id, sampleType: 'Blood', price: 500,
    parameters: [{ code: 'CREAT', name: 'Creatinine', unit: 'mg/dL' }] });
  patient = await patientService.createPatient({ name: 'Mixed Bill Patient', age: 40, birthYear: 1986, gender: 'Male', phone: '9999999991' });
});
after(async () => { await mongoose.disconnect(); await database?.stop(); });

test('reportTestNames: each report shell names only its own lines; imaging excluded; (bundle) stripped', () => {
  const items = [
    { itemType: 'Test', itemId: 'a', name: 'Lipid Profile (bundle)' },
    { itemType: 'Test', itemId: 'b', name: 'Kidney Function Test (KFT)' },
    { itemType: 'Custom', itemId: null, name: 'HbA1c' },
    { itemType: 'Custom', itemId: null, name: 'Vitamin D' },
    { itemType: 'Custom', itemId: null, name: 'USG Whole Abdomen' },
    { itemType: 'Test', itemId: 'c', name: 'Chest X-Ray PA', reportDepartment: 'XRAY' }
  ];
  assert.deepEqual(reportTestNames({ entryMode: 'inhouse' }, items), ['Lipid Profile', 'Kidney Function Test (KFT)']);
  assert.deepEqual(reportTestNames({ entryMode: 'outsource' }, items), ['HbA1c', 'Vitamin D']);
  assert.deepEqual(reportTestNames({}, items), ['Lipid Profile', 'Kidney Function Test (KFT)', 'HbA1c', 'Vitamin D'], 'missing entryMode keeps every lab test');
  assert.deepEqual(reportTestNames('all', items), reportTestNames({}, items));
  assert.equal(reportItems('outsource', items).length, 2);
  assert.deepEqual(reportTestNames({ entryMode: 'outsource' }, []), []);
});

test('report list: in-house report lists catalog tests, outsource report only the typed lines', async () => {
  const bill = await billService.createBill({
    patient: patient._id,
    department: 'LAB',
    items: [line(lipid), line(kft), custom('HbA1c'), custom('Vitamin D'), custom('USG Whole Abdomen')]
  }, admin._id);
  const res = await call(reportController.getReports, { query: { billId: String(bill._id), limit: '50' } });
  const reports = res.body.data.reports;
  const inhouse = reports.find((r) => r.entryMode === 'inhouse');
  const outsource = reports.find((r) => r.entryMode === 'outsource');
  assert.ok(inhouse && outsource, 'both shells exist');
  assert.deepEqual(inhouse.testNames, ['Lipid Profile', 'Kidney Function Test (KFT)']);
  assert.deepEqual(outsource.testNames, ['HbA1c', 'Vitamin D']);
  assert.deepEqual(outsource.outsourceTests, ['HbA1c', 'Vitamin D']);
  assert.deepEqual(outsource.fileCoverage.map((row) => row.covered), [false, false], 'nothing uploaded yet');

  // Patient portal card: "Lipid Profile, Kidney Function Test (KFT)" vs "HbA1c, Vitamin D".
  const portal = await call(require('../src/controllers/patientPortalController').getPatientReports, { patientPhone: patient.phone, patientIds: [patient._id] });
  const cards = portal.body.data.filter((card) => card.billNumber === bill.billNumber && card.type === 'Pathology');
  assert.equal(cards.find((card) => card.entryMode === 'inhouse').testName, 'Lipid Profile, Kidney Function Test (KFT)');
  assert.equal(cards.find((card) => card.entryMode === 'outsource').testName, 'HbA1c, Vitamin D');

  const pending = await call(reportController.getPendingLabCases, { query: { limit: '50' } });
  const rows = pending.body.data.cases.filter((row) => String(row.bill._id) === String(bill._id));
  assert.deepEqual(rows.find((row) => row.report.entryMode === 'outsource').report.testNames, ['HbA1c', 'Vitamin D']);
  assert.deepEqual(rows.find((row) => row.report.entryMode === 'inhouse').report.testNames, ['Lipid Profile', 'Kidney Function Test (KFT)']);
});

const outsourceShell = async (names) => {
  const bill = await billService.createBill({ patient: patient._id, department: 'LAB', items: [line(kft), ...names.map(custom)] }, admin._id);
  return Report.findOne({ bill: bill._id, entryMode: 'outsource' });
};

test('tagging: one file covering two outsourced tests completes the report', async () => {
  const shell = await outsourceShell(['HbA1c', 'Vitamin D']);
  const res = await call(reportController.attachReportFile, {
    params: { id: String(shell._id) },
    file: fakeFile('both'),
    body: { tests: JSON.stringify(['HbA1c', 'Vitamin D']) }
  });
  const data = res.body.data;
  assert.equal(data.files.length, 1);
  assert.deepEqual(data.files[0].tests, ['HbA1c', 'Vitamin D']);
  assert.ok(data.fileCoverage.every((row) => row.covered && row.fileId === data.files[0]._id));
  assert.equal(data.status, 'Completed');
});

test('tagging: two files, one test each; partial upload waits, second completes; re-upload replaces', async () => {
  const shell = await outsourceShell(['HbA1c', 'Vitamin D', 'Thyroid Profile']);
  let report = await reportService.attachReportFile(shell._id, fakeFile('hba1c'), admin, { tests: ['HbA1c'] });
  let coverage = fileCoverage(report, ['HbA1c', 'Vitamin D', 'Thyroid Profile']);
  assert.deepEqual(coverage.map((row) => row.covered), [true, false, false]);
  assert.equal(report.status, 'Draft', 'partly uploaded: still open, not completed or signed');

  report = await reportService.attachReportFile(shell._id, fakeFile('vitd-thyroid'), admin, { tests: ['Vitamin D', 'Thyroid Profile'] });
  assert.equal(report.files.length, 2);
  assert.equal(report.status, 'Completed');
  coverage = fileCoverage(report, ['HbA1c', 'Vitamin D', 'Thyroid Profile']);
  assert.equal(coverage[0].fileId, String(report.files[0]._id));
  assert.equal(coverage[1].fileId, String(report.files[1]._id));

  // Re-upload Vitamin D alone: the older file keeps only Thyroid.
  report = await reportService.attachReportFile(shell._id, fakeFile('vitd-new'), admin, { tests: ['Vitamin D'] });
  assert.equal(report.files.length, 3);
  assert.deepEqual(report.files.map((file) => file.tests), [['HbA1c'], ['Thyroid Profile'], ['Vitamin D']]);
  // Re-upload HbA1c: its old file covered nothing else and is dropped.
  report = await reportService.attachReportFile(shell._id, fakeFile('hba1c-new'), admin, { tests: ['HbA1c'] });
  assert.equal(report.files.length, 3);
  assert.ok(!report.files.some((file) => /hba1c-[0-9a-f]+\.pdf$/.test(file.url) && !file.url.includes('hba1c-new')));
  assert.equal(report.status, 'Completed');

  await assert.rejects(
    reportService.attachReportFile(shell._id, fakeFile('none'), admin, { tests: ['Lipid Profile'] }),
    /Tick at least one test/
  );
});

test('tagging: a legacy untagged file covers every outsourced test; a later tagged upload splits it', async () => {
  const shell = await outsourceShell(['HbA1c', 'Vitamin D']);
  await Report.updateOne({ _id: shell._id }, { $set: { fileUrl: 'uploads/reports/legacy.pdf', status: 'Completed' } });
  let report = await Report.findById(shell._id);
  const names = outsourceTestNames(report, (await Bill.findById(shell.bill).populate('items')).items);
  assert.deepEqual(names, ['HbA1c', 'Vitamin D']);
  assert.ok(fileCoverage(report, names).every((row) => row.covered && row.fileId === 'legacy'));

  const list = await call(reportController.getReports, { query: { billId: String(shell.bill), limit: '50' } });
  const listed = list.body.data.reports.find((r) => r.entryMode === 'outsource');
  assert.equal(listed.files.length, 1);
  assert.ok(listed.files[0].legacy);
  assert.ok(listed.fileCoverage.every((row) => row.covered));

  report = await reportService.attachReportFile(shell._id, fakeFile('vitd'), admin, { tests: ['Vitamin D'] });
  assert.deepEqual(report.files.map((file) => file.tests), [['HbA1c'], ['Vitamin D']]);
  assert.equal(report.files[0].url, 'uploads/reports/legacy.pdf');
  assert.equal(report.status, 'Completed');
});

test('an upload with no tags (older client) covers every outsourced test', () => {
  const report = { status: 'Registered', files: [], fileUrl: '' };
  const { complete } = addReportFile(report, { url: 'uploads/reports/x.pdf' }, ['HbA1c', 'Vitamin D']);
  assert.equal(complete, true);
  assert.deepEqual(report.files[0].tests, ['HbA1c', 'Vitamin D']);
  assert.equal(report.fileUrl, 'uploads/reports/x.pdf');
});
