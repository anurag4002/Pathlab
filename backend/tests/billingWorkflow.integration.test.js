process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'billing-workflow-fixture';
const { before, after, test } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Patient = require('../src/models/Patient');
const Bill = require('../src/models/Bill');
const Report = require('../src/models/Report');
const Test = require('../src/models/Test');
const TestCategory = require('../src/models/TestCategory');
const Sequence = require('../src/models/Sequence');
const LabProfile = require('../src/models/LabProfile');
for (const model of ['Doctor', 'Agent', 'User', 'Branch', 'TestPackage', 'TestPanel']) require(`../src/models/${model}`);
const patientService = require('../src/services/patientService');
const billService = require('../src/services/billService');
const testService = require('../src/services/testService');
const reportController = require('../src/controllers/reportController');
const portal = require('../src/controllers/patientPortalController');
const { protectPatient } = require('../src/middleware/patientTokenMiddleware');
const user = { _id: new mongoose.Types.ObjectId(), role: 'Admin' };
let database, patient, cbc, ecg, firstBill;
async function call(handler, request = {}) {
  const res = { statusCode: 200, status(value) { this.statusCode = value; return this; }, json(value) { this.body = value; return this; } };
  await handler({ user, query: {}, params: {}, body: {}, ...request }, res, error => { if (error) throw error; });
  return res;
}
before(async () => {
  database = await MongoMemoryServer.create(); await mongoose.connect(database.getUri());
  await Promise.all([Patient.init(), Bill.init(), Sequence.init()]);
  const category = await TestCategory.create({ name: 'Haematology' });
  cbc = await Test.create({ name: 'CBC', code: 'CBC', category: category._id, sampleType: 'Blood', price: 300,
    parameters: [{ code: 'HB', name: 'Haemoglobin', unit: 'g/dL' }, { code: 'TLC', name: 'Total leucocyte count' }] });
  ecg = await Test.create({ name: 'ECG (Without report)', code: 'USG_WITHOUT_REPORT', category: category._id, sampleType: 'None', price: 450 });
});
after(async () => { await mongoose.disconnect(); await database?.stop(); });
const line = test => ({ itemType: 'Test', itemId: test._id, name: test.name, price: test.price });

test('new registrations start at 000001 and first bill and report share the number', async () => {
  patient = await patientService.createPatient({ name: 'Patient One', age: 30, birthYear: 1996, gender: 'Male', phone: '9999999999' });
  assert.equal(patient.registrationNumber, '000001');
  firstBill = await billService.createBill({ patient: patient._id, department: 'LAB', items: [line(cbc), line(ecg)] }, user._id);
  assert.equal(firstBill.billNumber, '000001');
  const reports = await Report.find({ bill: firstBill._id });
  assert.deepEqual(reports.map(report => report.entryMode).sort(), ['inhouse', 'outsource']);
  assert.ok(reports.every(report => report.registrationNumber === '000001'));
});

test('mixed CBC and ECG order exposes CBC parameters and a separate ECG upload row', async () => {
  const queue = await call(reportController.getPendingLabCases);
  const rows = queue.body.data.cases.filter(row => String(row.bill._id) === String(firstBill._id));
  assert.equal(rows.length, 2);
  const house = rows.find(row => row.report.entryMode === 'inhouse');
  const entry = await call(reportController.getReportForEntry, { params: { id: String(house.report._id) } });
  const serialized = JSON.stringify(entry.body.data);
  assert.match(serialized, /Haemoglobin/);
  assert.match(serialized, /Total leucocyte count/);
  assert.equal(entry.body.data.testEntries.length, 2);
  assert.ok(entry.body.data.testEntries.every(test => test.testName !== ecg.name));
});

test('repeat visits get a fresh date-free case number; concurrent registrations never collide', async () => {
  const second = await billService.createBill({ patient: patient._id, department: 'ECG', items: [line(ecg)] }, user._id);
  assert.equal(second.billNumber, '000002');
  assert.equal((await Report.findOne({ bill: second._id })).entryMode, 'outsource');
  assert.equal((await Report.findOne({ bill: second._id })).registrationNumber, '000002');
  const generate = require('../src/utils/generateRegistrationNumber');
  const numbers = await Promise.all(Array.from({ length: 12 }, () => generate()));
  assert.equal(new Set(numbers).size, 12);
  assert.ok(numbers.every(number => /^\d{6}$/.test(number)));
  await LabProfile.create({ caseStartNumber: 1 });
  assert.equal(await generate(), '000015');
});

test('catalog code can be corrected without breaking bill references', async () => {
  const corrected = await testService.updateTest(ecg._id, { code: 'ECG_WITHOUT_REPORT' });
  assert.equal(corrected.code, 'ECG_WITHOUT_REPORT');
  assert.equal(String((await billService.getBillById(firstBill._id)).items.find(item => item.name === ecg.name).itemId), String(ecg._id));
  await assert.rejects(testService.updateTest(ecg._id, { code: 'CBC' }), error => error.code === 11000);
});

test('birth-year login limits report list, detail and download to matched patients on a shared phone', async () => {
  const other = await patientService.createPatient({ name: 'Family Member', age: 15, birthYear: 2011, gender: 'Female', phone: patient.phone });
  const otherBill = await billService.createBill({ patient: other._id, items: [line(cbc)] }, user._id);
  const hidden = await Report.findOne({ bill: otherBill._id });
  assert.equal((await call(portal.loginWithBirthYear, { body: { phone: patient.phone, birthYear: 1900 } })).statusCode, 401);
  const login = await call(portal.loginWithBirthYear, { body: { phone: patient.phone, birthYear: 1996 } });
  assert.equal(login.statusCode, 200);
  const claims = jwt.verify(login.body.data.token, process.env.JWT_SECRET);
  assert.deepEqual(claims.patientIds, [String(patient._id)]);
  const request = { headers: { authorization: `Bearer ${login.body.data.token}` } };
  await protectPatient(request, {}, error => { if (error) throw error; });
  const access = { patientPhone: request.patientPhone, patientIds: request.patientIds };
  const list = await call(portal.getPatientReports, access);
  assert.ok(!JSON.stringify(list.body).includes('Family Member'));
  assert.equal((await call(portal.getPatientReportById, { ...access, params: { id: String(hidden._id) } })).statusCode, 404);
  assert.equal((await call(portal.downloadPatientReport, { ...access, params: { id: String(hidden._id) } })).statusCode, 404);
});

test('six-digit numbering crosses 9999 and grows past 999999 without resetting', async () => {
  const generate = require('../src/utils/generateRegistrationNumber');
  await Sequence.updateOne({ _id: 'registration' }, { value: 9998 });
  assert.equal(await generate(), '009999');
  assert.equal(await generate(), '010000');
  await Sequence.updateOne({ _id: 'registration' }, { value: 999998 });
  assert.equal(await generate(), '999999');
  assert.equal(await generate(), '1000000');
});
