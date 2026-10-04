process.env.NODE_ENV = 'test';
process.env.MONGO_URI = 'mongodb://127.0.0.1:27017/formula-integration-test';
process.env.JWT_SECRET = 'formula-integration-test';
const { before, after, test } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Test = require('../src/models/Test');
const TestCategory = require('../src/models/TestCategory');
const Patient = require('../src/models/Patient');
const Bill = require('../src/models/Bill');
const BillItem = require('../src/models/BillItem');
const TestPanel = require('../src/models/TestPanel');
const TestPackage = require('../src/models/TestPackage');
const Report = require('../src/models/Report');
const testController = require('../src/controllers/testController');
const reportController = require('../src/controllers/reportController');
const reportService = require('../src/services/reportService');
const testService = require('../src/services/testService');
let database, category, patient, hb, hct, rbc, mcv, mch, mchc;
const user = { _id: new mongoose.Types.ObjectId(), role: 'Admin' };

async function call(handler, params = {}, body = {}, caller = user) {
  const response = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(payload) { this.body = JSON.parse(JSON.stringify(payload)); return this; } };
  await handler({ params, body, user: caller, query: {} }, response, (error) => { throw error; });
  return response;
}

before(async () => {
  database = await MongoMemoryServer.create();
  await mongoose.connect(database.getUri());
  category = await TestCategory.create({ name: 'Haematology' });
  patient = await Patient.create({ name: 'Formula Test Patient', registrationNumber: 'CALC-TEST', age: 53, gender: 'Female', phone: '9999999999' });
  const create = (code, name, fields = {}) => Test.create({ code, name, category: category._id, sampleType: 'Blood', price: 0, ...fields });
  hb = await create('HB', 'Hemoglobin', { unit: 'g/dl', referenceRange: 'Male (age 0d–100y): 13 - 17\nFemale (age 0d–100y): 12 - 15', normalLow: 13, normalHigh: 17 });
  hct = await create('HCT', 'Hematocrit', { unit: '%' });
  rbc = await create('RBC', 'RBC', { unit: 'million/cumm' });
  mcv = await create('MCV', 'Mean Corpuscular Volume', { isDerived: true, formula: 'ROUND([HCT] * 10 / [RBC], 1)', unit: 'fL', referenceRange: '83 - 101' });
  mch = await create('MCH', 'Mean Cell Hemoglobin', { isDerived: true, formula: 'ROUND([HB] * 10 / [RBC], 1)', unit: 'pg', referenceRange: '27 - 32' });
  mchc = await create('MCHC', 'Mean Cell Hemoglobin Concentration', { isDerived: true, formula: 'ROUND([HB] * 100 / [HCT], 1)', unit: 'g/dl', referenceRange: '31.5 - 34.5' });
});
after(async () => { await mongoose.disconnect(); await database?.stop(); });

async function makeReport(kind = 'TestPanel', tests = [hb, hct, rbc, mcv, mch, mchc]) {
  const bill = await Bill.create({ billNumber: `FORMULA-${new mongoose.Types.ObjectId()}`, patient: patient._id, totalAmount: 0, dueAmount: 0, createdBy: user._id });
  const model = kind === 'TestPackage' ? TestPackage : TestPanel;
  const group = await model.create({ name: 'CBC', price: 0, [kind === 'TestPackage' ? 'includedTests' : 'tests']: tests.map((t) => t._id) });
  const item = await BillItem.create({ billId: bill._id, itemType: kind, itemId: group._id, name: 'CBC', price: 0 });
  bill.items = [item._id]; await bill.save();
  return Report.create({ patient: patient._id, bill: bill._id, registrationNumber: '6716', uploadedBy: user._id, status: 'Registered' });
}
const measurements = () => [{ test: hb._id, value: '7.0' }, { test: hct._id, value: '20.0' }, { test: rbc._id, value: '3.11' }];

test('editing a lean catalog record saves the formula and partial updates still work', async () => {
  const result = await call(testController.updateTest, { id: String(mcv._id) }, { formula: 'ROUND([HCT] * 10 / [RBC], 1)' });
  assert.equal(result.statusCode, 200);
  assert.equal(result.body.data.formula, 'ROUND([HCT] * 10 / [RBC], 1)');
  assert.equal((await call(testController.updateTest, { id: String(mcv._id) }, { price: 10 })).statusCode, 200);
  const bad = await call(testController.updateTest, { id: String(mcv._id) }, { formula: '[UNKNOWN]' });
  assert.equal(bad.statusCode, 400); assert.match(bad.body.errors.formula, /Unknown/);
});

test('preview calculates panel outputs without saving, and draft / submit / reopen preserve values and ranges', async () => {
  const report = await makeReport();
  const preview = await call(reportController.previewResults, { id: String(report._id) }, { results: measurements() });
  assert.equal(preview.statusCode, 200);
  const derived = preview.body.data.results.filter((r) => r.derived);
  assert.deepEqual(derived.map((r) => r.value), ['64.3', '22.5', '35']);
  assert.deepEqual(derived.map((r) => r.flag), ['L', 'L', 'H']);
  assert.equal((await Report.findById(report._id)).results.length, 0);
  const saved = await reportService.saveResultsDraft(report._id, measurements(), user);
  assert.equal(saved.status, 'Draft');
  assert.equal(saved.results.find((r) => r.testName === 'Hemoglobin').referenceRange, '12 - 15');
  const reopened = await call(reportController.getReportForEntry, { id: String(report._id) });
  assert.equal(reopened.body.data.testEntries.filter((t) => t.isDerived).length, 3);
  assert.equal(reopened.body.data.testEntries.find((t) => t.testCode === 'MCV').existingValue, '64.3');
  assert.equal(reopened.body.data.testEntries.find((t) => t.testCode === 'HB').normalLow, 12);
  const submitted = await reportService.submitResults(report._id, measurements(), user);
  assert.equal(submitted.status, 'Reported');
  assert.equal(submitted.results.filter((r) => r.derived).length, 3);
});

test('a billed formula exposes unbilled dependencies and package outputs recalculate when cleared', async () => {
  const report = await makeReport('TestPackage', [mcv]);
  const entry = await call(reportController.getReportForEntry, { id: String(report._id) });
  assert.deepEqual(entry.body.data.testEntries.map((t) => t.testCode).sort(), ['HCT', 'MCV', 'RBC']);
  const inputs = measurements().filter((e) => String(e.test) !== String(hb._id));
  const saved = await reportService.saveResultsDraft(report._id, inputs, user);
  assert.equal(saved.results.find((r) => r.derived).value, '64.3');
  const empty = await call(reportController.previewResults, { id: String(report._id) }, { results: [] });
  assert.equal(empty.body.data.results.length, 0);
  assert.equal(empty.body.data.skipped.length, 1);
});

test('multi-parameter results save and reopen without collapsing onto the parent test', async () => {
  const compound = await Test.create({ code: 'PAIR', name: 'Paired result', category: category._id, sampleType: 'Blood', price: 0,
    parameters: [{ code: 'PAIR_A', name: 'Input', unit: '%', referenceRange: '0 - 10' },
      { code: 'PAIR_B', name: 'Calculated', unit: '%', isDerived: true, formula: '[PAIR_A] * 2', referenceRange: '0 - 12' }] });
  const report = await makeReport('TestPanel', [compound]);
  await reportService.saveResultsDraft(report._id, [{ test: compound._id, parameterCode: 'PAIR_A', value: '7' }], user);
  const entry = await call(reportController.getReportForEntry, { id: String(report._id) });
  const tests = entry.body.data.testEntries;
  assert.equal(tests.length, 2);
  assert.equal(new Set(tests.map((t) => t.resultKey)).size, 2);
  assert.equal(tests.find((t) => t.parameterCode === 'PAIR_B').existingValue, '14');
  assert.equal(tests.find((t) => t.parameterCode === 'PAIR_B').existingFlag, 'H');
});

test('preview enforces branch access', async () => {
  const report = await makeReport(); report.branch = new mongoose.Types.ObjectId(); await report.save();
  await assert.rejects(call(reportController.previewResults, { id: String(report._id) }, { results: measurements() },
    { ...user, role: 'Employee', branch: new mongoose.Types.ObjectId() }), /Access denied/);
});

test('qualitative dropdown values and Other text persist, while blank optional values can be omitted', async () => {
  const qualitative = await Test.create({ code: 'QUAL', name: 'Qualitative test', category: category._id, sampleType: 'Blood', price: 0, referenceRange: 'Negative', resultOptions: ['Negative', 'Positive'] });
  const report = await makeReport('TestPanel', [qualitative]);
  let entry = await call(reportController.getReportForEntry, { id: String(report._id) });
  assert.deepEqual(entry.body.data.testEntries[0].resultOptions, ['Negative', 'Positive']);
  await reportService.saveResultsDraft(report._id, [{ test: qualitative._id, value: 'Positive' }], user);
  entry = await call(reportController.getReportForEntry, { id: String(report._id) });
  assert.equal(entry.body.data.testEntries[0].existingValue, 'Positive');
  const saved = await reportService.saveResultsDraft(report._id, [{ test: qualitative._id, value: 'Weakly positive' }], user);
  assert.equal(saved.results[0].value, 'Weakly positive');
  assert.equal((await reportService.saveResultsDraft(report._id, [], user)).results.length, 0);
});

test('normal-range edits preserve formulas and store age/sex bands for individual parameters', async () => {
  const compound = await Test.create({ code: 'AGE_PAIR', name: 'Age pair', category: category._id, sampleType: 'Blood', price: 0,
    parameters: [{ code: 'AGE_PAIR_A', name: 'Input', referenceRange: '0 - 100' },
      { code: 'AGE_PAIR_B', name: 'Output', isDerived: true, formula: '[AGE_PAIR_A] * 2' }] });
  const bands = [{ sex: 'Female', ageMin: 18, ageMinUnit: 'y', ageMax: 60, ageMaxUnit: 'y', referenceRange: '5 - 10' },
    { sex: 'Male', ageMin: 18, ageMinUnit: 'y', ageMax: 60, ageMaxUnit: 'y', referenceRange: '10 - 20' }];
  const parameters = compound.toObject().parameters.map((p) => ({ ...p, referenceRanges: bands }));
  const edited = await call(testController.updateTest, { id: String(compound._id) }, { parameters });
  assert.equal(edited.statusCode, 200);
  assert.equal(edited.body.data.parameters[1].formula, '[AGE_PAIR_A] * 2');
  assert.deepEqual(edited.body.data.parameters[0].referenceRanges.map((r) => r.sex), ['Female', 'Male']);
  const master = (await testService.getTests({ search: 'Age pair' }))[0];
  assert.equal(master.parameters[1].referenceRanges.length, 2);
  const report = await makeReport('TestPanel', [compound]);
  const entry = await call(reportController.getReportForEntry, { id: String(report._id) });
  assert.deepEqual(entry.body.data.testEntries.map((t) => t.referenceRange), ['5 - 10', '5 - 10']);
  const saved = await reportService.saveResultsDraft(report._id, [{ test: compound._id, parameterCode: 'AGE_PAIR_A', value: 7 }], user);
  assert.equal(saved.results.find((r) => r.derived).referenceRange, '5 - 10');
  assert.equal(saved.results.find((r) => r.derived).flag, 'H');
  const invalid = await call(testController.updateTest, { id: String(compound._id) }, { parameters: [{ ...parameters[0], referenceRanges: [{ ...bands[0], ageMax: 1 }] }, parameters[1]] });
  assert.equal(invalid.statusCode, 400);
  assert.match(invalid.body.errors.parameters, /maximum age/);
});

test('older scalar report values survive when the test gains separate parameters', async () => {
  const compound = await Test.create({ code: 'LEGACY_PAIR', name: 'Earlier paired test', category: category._id, sampleType: 'Blood', price: 0 });
  const report = await makeReport('TestPanel', [compound]);
  await reportService.saveResultsDraft(report._id, [{ test: compound._id, value: 'Earlier result' }], user);
  await Test.findByIdAndUpdate(compound._id, { parameters: [{ code: 'LEGACY_PAIR_A', name: 'New input' }] });
  const entry = await call(reportController.getReportForEntry, { id: String(report._id) });
  assert.equal(entry.body.data.testEntries.length, 2);
  const earlier = entry.body.data.testEntries.find((t) => t.legacyScalar);
  assert.equal(earlier.existingValue, 'Earlier result');
  const saved = await reportService.saveResultsDraft(report._id, [{ test: compound._id, value: earlier.existingValue }, { test: compound._id, parameterCode: 'LEGACY_PAIR_A', value: '7' }], user);
  assert.deepEqual(saved.results.map((r) => r.value), ['Earlier result', '7']);
});

test('catalog units stay fixed, including empty units, regardless of submitted units', async () => {
  const qualitative=await Test.create({code:'LOCKED_UNIT',name:'Locked unit field',sourceFieldName:'Source field label',category:category._id,sampleType:'Blood',price:0,unit:''});
  const report=await makeReport('TestPanel',[qualitative,hb]);
  const saved=await reportService.saveResultsDraft(report._id,[{test:qualitative._id,value:'Negative',unit:'wrong unit'},{test:hb._id,value:'13',unit:'wrong unit'}],user);
  assert.equal(saved.results.find(r=>String(r.test)===String(qualitative._id)).unit,'');
  assert.equal(saved.results.find(r=>String(r.test)===String(qualitative._id)).testName,'Source field label');
  assert.equal(saved.results.find(r=>String(r.test)===String(hb._id)).unit,'g/dl');
  const reopened=await call(reportController.getReportForEntry,{id:String(report._id)});
  assert.equal(reopened.body.data.testEntries.find(t=>t.testCode==='LOCKED_UNIT').testName,'Source field label');
});

test('editable reports show current patient ranges while final reports retain their saved range', async () => {
  const subject=await Patient.create({name:'Age range QA',registrationNumber:'AGE-QA',age:53,gender:'Female',phone:'9999999999'});
  const report=await makeReport('TestPanel',[hb]);
  report.patient=subject._id;await report.save();
  await reportService.saveResultsDraft(report._id,[{test:hb._id,value:'13'}],user);
  await Patient.findByIdAndUpdate(subject._id,{gender:'Male'});
  let reopened=await call(reportController.getReportForEntry,{id:String(report._id)});
  assert.equal(reopened.body.data.testEntries[0].referenceRange,'13 - 17');
  await Report.findByIdAndUpdate(report._id,{status:'Verified'});
  reopened=await call(reportController.getReportForEntry,{id:String(report._id)});
  assert.equal(reopened.body.data.testEntries[0].referenceRange,'12 - 15');
});
