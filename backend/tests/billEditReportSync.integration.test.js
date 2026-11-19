// A bill edit must carry through to the case's reports: a test removed from
// the bill (or moved to an outsource line) leaves in-house result entry and
// the printed report, but an entered value is never dropped silently.
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'bill-edit-report-sync';
const { before, after, test } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Patient = require('../src/models/Patient');
const Bill = require('../src/models/Bill');
const Report = require('../src/models/Report');
const Test = require('../src/models/Test');
const TestCategory = require('../src/models/TestCategory');
const TestPanel = require('../src/models/TestPanel');
const Sequence = require('../src/models/Sequence');
for (const model of ['Doctor', 'Agent', 'User', 'Branch', 'TestPackage', 'Activity']) require(`../src/models/${model}`);
const patientService = require('../src/services/patientService');
const billService = require('../src/services/billService');
const reportService = require('../src/services/reportService');
const reportController = require('../src/controllers/reportController');
const { loadReportPrintTests } = require('../src/services/reportPrintSections');

const admin = { _id: new mongoose.Types.ObjectId(), role: 'Admin' };
const staff = { _id: new mongoose.Types.ObjectId(), role: 'Lab Technician' };
let database, patient, cbc, hba1c, diabetesPanel;

async function call(handler, request = {}) {
  const res = { statusCode: 200, status(value) { this.statusCode = value; return this; }, json(value) { this.body = JSON.parse(JSON.stringify(value)); return this; } };
  let failure = null;
  await handler({ user: admin, query: {}, params: {}, body: {}, ...request }, res, (error) => { failure = error; });
  if (failure) throw failure;
  return res;
}
const line = (record, itemType = 'Test') => ({ itemType, itemId: record._id, name: record.name, price: record.price || 100 });
const outsource = (name) => ({ itemType: 'Custom', itemId: null, name, price: 400 });
const entry = async (reportId) => (await call(reportController.getReportForEntry, { params: { id: String(reportId) } })).body.data;
const inhouseReport = async (bill) => Report.findOne({ bill: bill._id, entryMode: 'inhouse' });
const hbaRows = (data) => data.testEntries.filter((row) => String(row.testId) === String(hba1c._id));

before(async () => {
  database = await MongoMemoryServer.create();
  await mongoose.connect(database.getUri());
  await Promise.all([Patient.init(), Bill.init(), Sequence.init()]);
  const category = await TestCategory.create({ name: 'Biochemistry' });
  cbc = await Test.create({ name: 'CBC', code: 'CBC', category: category._id, sampleType: 'Blood', price: 300,
    parameters: [{ code: 'HB', name: 'Haemoglobin', unit: 'g/dL' }] });
  // Same shape as the live catalog: HbA1c with a calculated eAG row.
  hba1c = await Test.create({ name: 'HbA1c (Glycated Hemoglobin)', code: 'HBA1C_GLYCOSYLATED_H', category: category._id, sampleType: 'Blood', price: 500,
    parameters: [
      { code: 'HBA1C', name: 'HbA1c', unit: '%' },
      { code: 'HBA1C_EAG', name: 'Estimated average glucose', unit: 'mg/dL', isDerived: true, formula: 'ROUND(28.7 * [HBA1C] - 46.7, 2)' }
    ] });
  diabetesPanel = await TestPanel.create({ name: 'Diabetes panel', code: 'DIAB_PANEL', category: category._id, price: 700, tests: [hba1c._id] });
  patient = await patientService.createPatient({ name: 'Bill Edit Patient', age: 45, birthYear: 1981, gender: 'Male', phone: '9999999990' });
});
after(async () => { await mongoose.disconnect(); await database?.stop(); });

test('HbA1c moved to outsource leaves the in-house entry and print when nothing was entered for it', async () => {
  const bill = await billService.createBill({ patient: patient._id, department: 'LAB', items: [line(cbc), line(hba1c)] }, admin._id);
  const report = await inhouseReport(bill);
  assert.equal(hbaRows(await entry(report._id)).length, 2, 'HbA1c and its eAG row start on the in-house entry');
  await reportService.saveResultsDraft(report._id, [{ test: cbc._id, parameterCode: 'HB', value: '13.5' }], admin);
  // Older shells could also hold value-less HbA1c rows (e.g. imported data).
  await Report.updateOne({ _id: report._id }, { $push: { results: { test: hba1c._id, testName: 'HbA1c (Glycated Hemoglobin): HbA1c', parameterCode: 'HBA1C', value: '' } } });

  await billService.updateBill(bill._id, { items: [line(cbc), outsource('HbA1c')] }, admin);

  const stored = await Report.findById(report._id);
  assert.ok(stored.results.every((row) => String(row.test) !== String(hba1c._id)), 'value-less HbA1c rows are pruned on bill save');
  assert.equal(stored.results.length, 1, 'the CBC value is untouched');
  const data = await entry(report._id);
  assert.equal(hbaRows(data).length, 0, 'no HbA1c / eAG rows in in-house entry');
  assert.ok(data.testEntries.some((row) => row.parameterCode === 'HB' && row.existingValue === '13.5'));
  assert.equal((await loadReportPrintTests(stored))[String(hba1c._id)], undefined, 'not in the printed report sections');

  const outsourceReport = await Report.findOne({ bill: bill._id, entryMode: 'outsource' });
  assert.ok(outsourceReport, 'an outsource report exists for the new outsource line');
  const outsourceEntry = await entry(outsourceReport._id);
  assert.deepEqual(outsourceEntry.testEntries.map((row) => row.testName), ['HbA1c']);
});

test('an entered HbA1c value is kept and flagged, then removed with one click', async () => {
  const bill = await billService.createBill({ patient: patient._id, department: 'LAB', items: [line(cbc), line(hba1c)] }, admin._id);
  const report = await inhouseReport(bill);
  await reportService.saveResultsDraft(report._id, [
    { test: cbc._id, parameterCode: 'HB', value: '14' },
    { test: hba1c._id, parameterCode: 'HBA1C', value: '6.0' }
  ], admin);
  assert.ok((await Report.findById(report._id)).results.some((row) => row.parameterCode === 'HBA1C_EAG' && row.derived));

  // Same name re-added as outsource: the bill edit is allowed (not a removal).
  await billService.updateBill(bill._id, { items: [line(cbc), outsource('HbA1c')] }, admin);

  const kept = await Report.findById(report._id);
  assert.equal(kept.results.filter((row) => String(row.test) === String(hba1c._id)).length, 2, 'entered value and its eAG are kept');
  const rows = hbaRows(await entry(report._id));
  assert.equal(rows.length, 2);
  assert.ok(rows.every((row) => row.notOnBill), 'both rows are flagged');
  assert.match(rows.find((row) => !row.isDerived).notOnBillNote, /Moved to outsource/);
  assert.equal(rows.find((row) => !row.isDerived).existingValue, '6.0');
  // CBC is still billed and never flagged.
  assert.ok((await entry(report._id)).testEntries.filter((row) => String(row.testId) === String(cbc._id)).every((row) => !row.notOnBill));

  // A test still on the bill cannot be removed this way.
  await assert.rejects(call(reportController.removeStaleTest, { params: { id: String(report._id), testId: String(cbc._id) } }), (error) => error.statusCode === 400);
  const removed = await call(reportController.removeStaleTest, { params: { id: String(report._id), testId: String(hba1c._id) } });
  assert.equal(removed.statusCode, 200);
  const after = await Report.findById(report._id);
  assert.ok(after.results.every((row) => String(row.test) !== String(hba1c._id)));
  assert.equal(after.results.length, 1);
  assert.equal(hbaRows(await entry(report._id)).length, 0);
  assert.equal((await loadReportPrintTests(after))[String(hba1c._id)], undefined);
});

test('a panel removed from the bill: its member with a value is flagged, members without values go', async () => {
  const bill = await billService.createBill({ patient: patient._id, department: 'LAB', items: [line(cbc), line(diabetesPanel, 'TestPanel')] }, admin._id);
  const report = await inhouseReport(bill);
  assert.equal(hbaRows(await entry(report._id)).length, 2);
  await reportService.saveResultsDraft(report._id, [{ test: cbc._id, parameterCode: 'HB', value: '12' }], admin);
  await billService.updateBill(bill._id, { items: [line(cbc), outsource('Diabetes panel')] }, admin);
  assert.equal(hbaRows(await entry(report._id)).length, 0, 'panel member with no value is gone');

  const second = await billService.createBill({ patient: patient._id, department: 'LAB', items: [line(cbc), line(diabetesPanel, 'TestPanel')] }, admin._id);
  const secondReport = await inhouseReport(second);
  await reportService.saveResultsDraft(secondReport._id, [{ test: hba1c._id, parameterCode: 'HBA1C', value: '7.1' }], admin);
  await billService.updateBill(second._id, { items: [line(cbc), outsource('Sugar fasting')] }, admin);
  const rows = hbaRows(await entry(secondReport._id));
  assert.ok(rows.length === 2 && rows.every((row) => row.notOnBill));
  assert.match(rows.find((row) => !row.isDerived).notOnBillNote, /Not on the bill any more/);
});

test('a signed report is not changed by the bill edit; removing needs an admin and a new signature', async () => {
  const bill = await billService.createBill({ patient: patient._id, department: 'LAB', items: [line(cbc), line(hba1c)] }, admin._id);
  const report = await inhouseReport(bill);
  await reportService.submitResults(report._id, [
    { test: cbc._id, parameterCode: 'HB', value: '15' },
    { test: hba1c._id, parameterCode: 'HBA1C', value: '5.4' }
  ], admin);
  await reportService.signReport(report._id, null, admin);
  const before = await Report.findById(report._id).lean();

  await billService.updateBill(bill._id, { items: [line(cbc), outsource('HbA1c')] }, admin);
  await entry(report._id);
  const unchanged = await Report.findById(report._id).lean();
  assert.equal(unchanged.status, 'Signed');
  assert.equal(unchanged.signatures.length, 1);
  assert.deepEqual(unchanged.results.map((row) => row.value), before.results.map((row) => row.value), 'signed results are not mutated');
  assert.ok(hbaRows(await entry(report._id)).every((row) => row.notOnBill), 'but they are flagged for review');

  await assert.rejects(call(reportController.removeStaleTest, { user: staff, params: { id: String(report._id), testId: String(hba1c._id) } }),
    (error) => error.statusCode === 403);
  await call(reportController.removeStaleTest, { params: { id: String(report._id), testId: String(hba1c._id) } });
  const reopened = await Report.findById(report._id).lean();
  assert.equal(reopened.status, 'Reported', 'goes back to Reported to be signed again');
  assert.equal(reopened.signatures.length, 0);
  assert.ok(reopened.results.every((row) => String(row.test) !== String(hba1c._id)));
});
