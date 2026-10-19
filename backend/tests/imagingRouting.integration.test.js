process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'imaging-routing-fixture';
const { before, after, test } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Bill = require('../src/models/Bill');
const BillItem = require('../src/models/BillItem');
const Patient = require('../src/models/Patient');
const Test = require('../src/models/Test');
const TestCategory = require('../src/models/TestCategory');
const Report = require('../src/models/Report');
const USGCase = require('../src/models/USGCase');
const XrayCase = require('../src/models/XrayCase');
for (const name of ['User', 'Doctor', 'Agent', 'Branch', 'TestPanel', 'TestPackage']) require(`../src/models/${name}`);
const billService = require('../src/services/billService');
const { getUSGCases } = require('../src/controllers/usgController');
const { getXrayCases } = require('../src/controllers/xrayController');
const { getReportForEntry } = require('../src/controllers/reportController');
const { recoverMissingImagingCases } = require('../src/services/imagingBillService');
const admin = { _id: new mongoose.Types.ObjectId(), role: 'Admin' };
let database, patient, usg, xray, cbc, ecg, mixed;
const line = test => ({ itemType: 'Test', itemId: test._id, name: test.name, price: test.price });
async function call(handler, request = {}) {
  const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(value) { this.body = value; return this; } };
  await handler({ user: admin, query: {}, params: {}, ...request }, res, error => { if (error) throw error; });
  return res;
}
before(async () => {
  database = await MongoMemoryServer.create(); await mongoose.connect(database.getUri());
  await Promise.all([USGCase.init(), XrayCase.init()]);
  patient = await Patient.create({ name: 'Imaging Patient', registrationNumber: 'IMAGING-OLD', age: 30, gender: 'Male', phone: '9999999999' });
  const categories = await TestCategory.create([{ name: 'USG' }, { name: 'X-Ray' }, { name: 'Haematology' }]);
  [usg, xray, cbc, ecg] = await Test.create([
    { name: 'Routine abdomen', code: 'ABD', category: categories[0]._id, sampleType: 'None', price: 650 },
    { name: 'Chest PA', code: 'CHEST', category: categories[1]._id, sampleType: 'None', price: 400 },
    { name: 'CBC', code: 'CBC', category: categories[2]._id, sampleType: 'Blood', price: 300 },
    { name: 'ECG', code: 'USG_WITHOUT_REPORT', category: categories[0]._id, sampleType: 'None', price: 450 }
  ]);
});
after(async () => { await mongoose.disconnect(); await database?.stop(); });

test('a mixed LAB bill routes catalog imaging by category, CBC to values and renamed ECG to upload', async () => {
  mixed = await billService.createBill({ patient: patient._id, department: 'LAB', items: [usg, xray, cbc, ecg].map(line) }, admin._id);
  const usgRecord = await USGCase.findOne({ bill: mixed._id });
  const xrayRecord = await XrayCase.findOne({ bill: mixed._id });
  assert.ok(usgRecord); assert.ok(xrayRecord);
  assert.equal(usgRecord.price, 650); assert.equal(usgRecord.serviceType, 'with-report');
  assert.equal(xrayRecord.status, 'Pending'); assert.equal(xrayRecord.findings, '');
  const reports = await Report.find({ bill: mixed._id });
  assert.deepEqual(reports.map(report => report.entryMode).sort(), ['inhouse', 'outsource']);
  const house = reports.find(report => report.entryMode === 'inhouse');
  const entry = await call(getReportForEntry, { params: { id: String(house._id) } });
  assert.deepEqual(entry.body.data.testEntries.map(entry => entry.testName), ['CBC']);
  const out = reports.find(report => report.entryMode === 'outsource');
  const upload = await call(getReportForEntry, { params: { id: String(out._id) } });
  assert.deepEqual(upload.body.data.testEntries.map(entry => entry.testName), ['ECG']);
});

test('USG and X-ray case endpoints return the linked pending billed orders', async () => {
  for (const handler of [getUSGCases, getXrayCases]) {
    const response = await call(handler);
    const record = response.body.data.find(record => String(record.bill) === String(mixed._id));
    assert.ok(record); assert.equal(record.patient.name, patient.name); assert.equal(record.status, 'Pending');
  }
});

test('X-ray department billing creates a pending case without adding a lab-value report', async () => {
  const invoice = await billService.createBill({ patient: patient._id, department: 'DIGITAL XRAY', caseType: 'DigitalXrayCase', items: [line(xray)] }, admin._id);
  assert.equal((await XrayCase.findOne({ bill: invoice._id })).status, 'Pending');
  assert.equal(await Report.countDocuments({ bill: invoice._id }), 0);
});

test('old bills recover once, respect branch and void filters, and preserve existing report data', async () => {
  const branch = new mongoose.Types.ObjectId(), otherBranch = new mongoose.Types.ObjectId();
  async function legacy(number, fields = {}) {
    const bill = await Bill.create({ billNumber: number, patient: patient._id, department: 'LAB', branch, totalAmount: 1050, dueAmount: 1050, createdBy: admin._id, ...fields });
    await BillItem.create([line(usg), line(xray)].map(item => ({ ...item, billId: bill._id })));
    return bill;
  }
  const legacyBill = await legacy('LEGACY-IMAGING');
  const foreign = await legacy('FOREIGN-IMAGING', { branch: otherBranch });
  const voided = await legacy('VOID-IMAGING', { isVoided: true });
  const original = await XrayCase.create({ patient: patient._id, bill: legacyBill._id, branch, findings: 'Saved findings', status: 'Completed', fileUrl: 'uploads/xray/original.png' });
  for (let attempt = 0; attempt < 2; attempt++) {
    await recoverMissingImagingCases({ branch }, 'USG');
    await recoverMissingImagingCases({ branch }, 'XRAY');
  }
  assert.equal(await USGCase.countDocuments({ bill: legacyBill._id }), 1);
  assert.equal(await XrayCase.countDocuments({ bill: legacyBill._id }), 1);
  for (const bill of [foreign, voided]) {
    assert.equal(await USGCase.countDocuments({ bill: bill._id }), 0);
    assert.equal(await XrayCase.countDocuments({ bill: bill._id }), 0);
  }
  const preserved = await XrayCase.findById(original._id);
  assert.equal(preserved.findings, 'Saved findings'); assert.equal(preserved.fileUrl, original.fileUrl); assert.equal(preserved.status, 'Completed');
});

test('bill edits preserve X-ray findings and completed status; findings-only reports remain listed', async () => {
  const record = await XrayCase.findOneAndUpdate({ bill: mixed._id }, { findings: 'Normal chest study', status: 'Completed' }, { new: true });
  await billService.updateBill(mixed._id, { referringDoctor: null, items: [usg, xray, cbc, ecg].map(line) }, admin);
  assert.equal(await XrayCase.countDocuments({ bill: mixed._id }), 1);
  assert.equal((await XrayCase.findById(record._id)).findings, 'Normal chest study');
  const list = await call(getXrayCases, { query: { status: 'Completed' } });
  assert.ok(list.body.data.some(item => String(item._id) === String(record._id) && !item.fileUrl));
});

test('simultaneous report-section loads cannot create duplicate cases for a legacy bill', async () => {
  const bill = await Bill.create({ billNumber: 'CONCURRENT-IMAGING', patient: patient._id, department: 'LAB', totalAmount: 1050, dueAmount: 1050, createdBy: admin._id });
  await BillItem.create([line(usg), line(xray)].map(item => ({ ...item, billId: bill._id })));
  await Promise.all(Array.from({ length: 4 }, () => recoverMissingImagingCases({}, 'XRAY')));
  assert.equal(await USGCase.countDocuments({ bill: bill._id }), 1);
  assert.equal(await XrayCase.countDocuments({ bill: bill._id }), 1);
});
