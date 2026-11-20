process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'package-print';
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
const TestPackage = require('../src/models/TestPackage');
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
  // PDFKit ends streams with "\nendstream". Do not strip a "\r" before it: a
  // compressed stream may end with that byte, and dropping it made the stream
  // unreadable (no text found) about once in 256 renders.
  return [...pdf.toString('latin1').matchAll(/stream\r?\n([\s\S]*?)\nendstream/g)].map(match => {
    try {
      const stream = zlib.inflateSync(Buffer.from(match[1], 'latin1')).toString('latin1');
      return [...stream.matchAll(/<([\da-f]+)>/gi)].map(m => Buffer.from(m[1], 'hex').toString('latin1')).join('');
    } catch { return ''; }
  }).join('\n');
}


// A package (e.g. "Nasha Mukti Kendra Package" = CBC + LFT + KFT) must print
// exactly like the same tests billed one by one: each test under its own
// department and title, with its own interpretation.
test('a package prints like its tests billed one by one', async () => {
  const haem = await TestCategory.create({ name: 'Haematology' });
  const bio = await TestCategory.findOne({ name: 'Biochemistry' });
  const cbc = await Test.create({ name: 'Complete Blood Count (CBC)', code: 'CBCX', price: 0, category: haem._id, sampleType: 'Blood', interpretation: 'CBC GUIDE TEXT',
    parameters: [{ code: 'HBX', name: 'Hemoglobin', unit: 'g/dl' }] });
  const lft = await Test.create({ name: 'Liver Function Test (LFT)', code: 'LFTX', price: 0, category: bio._id, sampleType: 'Blood', interpretation: 'LFT GUIDE TEXT',
    parameters: [{ code: 'SGOTX', name: 'SGOT', unit: 'U/l' }] });
  const pkg = await TestPackage.create({ name: 'Nasha Mukti Kendra Package', price: 0, includedTests: [cbc._id, lft._id] });
  const results = [
    { test: cbc._id, parameterCode: 'HBX', testName: 'Complete Blood Count (CBC): Hemoglobin', value: '14.7', unit: 'g/dl' },
    { test: lft._id, parameterCode: 'SGOTX', testName: 'Liver Function Test (LFT): SGOT', value: '20.6', unit: 'U/l' }
  ];
  const make = async (lines) => {
    const bill = await Bill.create({ billNumber: `PK-${new mongoose.Types.ObjectId()}`, patient: patient._id, totalAmount: 0, dueAmount: 0, createdBy: admin._id });
    for (const line of lines) await BillItem.create({ billId: bill._id, price: 0, ...line });
    return Report.create({ patient: patient._id, bill: bill._id, registrationNumber: 'PK-1', uploadedBy: admin._id, entryMode: 'inhouse', results });
  };
  const packaged = await make([{ itemType: 'TestPackage', itemId: pkg._id, name: `${pkg.name} (bundle)` }]);
  const single = await make([{ itemType: 'Test', itemId: cbc._id, name: cbc.name }, { itemType: 'Test', itemId: lft._id, name: lft.name }]);
  const textFor = async (report) => textOf((await render(report, { qr: '0' })).bytes);
  const a = await textFor(packaged), b = await textFor(single);
  for (const label of ['HAEMATOLOGY', 'BIOCHEMISTRY', 'COMPLETE BLOOD COUNT (CBC)', 'LIVER FUNCTION TEST (LFT)', 'CBC GUIDE TEXT', 'LFT GUIDE TEXT']) {
    assert.ok(a.includes(label), `package print has ${label}`);
  }
  assert.ok(!a.includes('NASHA MUKTI KENDRA PACKAGE'), 'no single jumbled package table');
  const order = (text) => ['COMPLETE BLOOD COUNT (CBC)', 'LIVER FUNCTION TEST (LFT)'].map((label) => text.indexOf(label));
  // Departments follow the catalog's order; both prints must agree.
  assert.equal(Math.sign(order(a)[0] - order(a)[1]), Math.sign(order(b)[0] - order(b)[1]), 'same test order as billed one by one');
});
