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
const patientController = require('../src/controllers/patientController');
require('../src/models/Doctor');
let database, category, patient, hb, hct, rbc, mcv, mch, mchc;
const user = { _id: new mongoose.Types.ObjectId(), role: 'Admin' };

async function call(handler, params = {}, body = {}, caller = user, query = {}) {
  const response = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(payload) { this.body = JSON.parse(JSON.stringify(payload)); return this; } };
  await handler({ params, body, user: caller, query }, response, (error) => { throw error; });
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

test('submit then return to the case list preserves the saved report identity and prefilled values', async () => {
  const report = await makeReport();
  const submitted = await reportService.submitResults(report._id, measurements(), user);
  const bill = await Bill.findById(report.bill);
  const queue = await call(reportController.getPendingLabCases, {}, {}, user, { search: bill.billNumber });
  const row = queue.body.data.cases.find(row => row.bill._id === String(bill._id));
  assert.ok(row);
  assert.equal(row.report._id, String(report._id));
  assert.equal(row.report.status, 'Reported');
  const reopened = await call(reportController.getReportForEntry, { id: row.report._id });
  assert.equal(reopened.body.data.report._id, String(report._id));
  assert.equal(reopened.body.data.testEntries.find(test => test.testCode === 'HB').existingValue, '7.0');
  assert.equal(reopened.body.data.testEntries.find(test => test.testCode === 'MCV').existingValue, '64.3');
  assert.equal(reopened.body.data.results.length, submitted.results.length);
  assert.equal(await Report.countDocuments({ bill: report.bill }), 1);
});

test('opening result entry again reuses submitted and legacy reports instead of creating blank shells', async () => {
  const report = await makeReport();
  await reportService.submitResults(report._id, measurements(), user);
  const opened = await reportService.createResultReport({ patient: patient._id, bill: report.bill, entryMode: 'inhouse' }, user);
  assert.equal(String(opened._id), String(report._id));
  assert.equal(opened.results.find(result => result.testName === 'Hemoglobin').value, '7.0');
  assert.equal(opened.status, 'Reported');
  assert.equal(await Report.countDocuments({ bill: report.bill }), 1);
  report.entryMode = 'inhouse'; report.status = 'Signed'; await report.save();
  const signed = await reportService.createResultReport({ patient: patient._id, bill: report.bill, entryMode: 'inhouse' }, user);
  assert.equal(String(signed._id), String(report._id));
  assert.equal(signed.status, 'Signed');
  assert.equal(await Report.countDocuments({ bill: report.bill }), 1);
});

test('mixed bill worklist preserves separate in-house and outsource report identities', async () => {
  const report = await makeReport();
  report.entryMode = 'inhouse'; await report.save();
  const custom = await BillItem.create({ billId: report.bill, itemType: 'Custom', name: 'Outsource test', price: 10 });
  await Bill.updateOne({ _id: report.bill }, { $push: { items: custom._id } });
  const outsource = await reportService.createResultReport({ patient: patient._id, bill: report.bill, entryMode: 'outsource' }, user);
  await reportService.saveResultsDraft(report._id, measurements(), user);
  const bill = await Bill.findById(report.bill);
  const queue = await call(reportController.getPendingLabCases, {}, {}, user, { search: bill.billNumber });
  assert.deepEqual(new Set(queue.body.data.cases.map(row => row.report._id)), new Set([String(report._id), String(outsource._id)]));
  assert.equal(queue.body.data.cases.find(row => row.report._id === String(report._id)).report.status, 'Draft');
});

test('report interpretations save independently, reopen, reset and lock after signing', async () => {
  const report = await makeReport();
  const params = { id: String(report._id) };
  const initial = await call(reportController.getInterpretations, params);
  assert.equal(initial.body.data.length, 1);
  const key = initial.body.data[0].key;
  const saved = await call(reportController.updateInterpretations, params, { interpretations: [{ key, text: 'Custom report guidance' }] });
  assert.equal(saved.statusCode, 200);
  const reopened = await call(reportController.getInterpretations, params);
  assert.equal(reopened.body.data[0].text, 'Custom report guidance');
  assert.equal(reopened.body.data[0].customized, true);
  await call(reportController.updateInterpretations, params, { interpretations: [{ key, text: '' }] });
  assert.equal((await call(reportController.getInterpretations, params)).body.data[0].text, '');
  await call(reportController.updateInterpretations, params, { interpretations: [] });
  assert.equal((await call(reportController.getInterpretations, params)).body.data[0].customized, false);
  const invalid = await call(reportController.updateInterpretations, params, { interpretations: [{ key: 'other-report', text: 'wrong section' }] });
  assert.equal(invalid.statusCode, 400);
  await Report.updateOne({ _id: report._id }, { status: 'Signed' });
  assert.equal((await call(reportController.updateInterpretations, params, { interpretations: [] })).statusCode, 409);
});

test('complete panel interpretation can be stored in the reusable library without a single test link', async () => {
  const saved = await call(testController.createInterpretation, {}, { resultCondition: 'Reusable panel guidance', interpretationText: 'Complete panel text', normalAbnormalGuidance: 'General' });
  assert.equal(saved.statusCode, 201);
  assert.equal(saved.body.data.test, null);
  assert.ok((await testService.getInterpretations()).some(item => item.interpretationText === 'Complete panel text'));
});

test('inline test interpretations save, reopen and reset independently within one report panel', async () => {
  const tlc = await Test.create({ code: 'INLINE_TLC', name: 'TLC', category: category._id, sampleType: 'Blood', price: 10, interpretation: 'Catalog TLC interpretation' });
  const esr = await Test.create({ code: 'INLINE_ESR', name: 'ESR', category: category._id, sampleType: 'Blood', price: 10, interpretation: 'Catalog ESR interpretation' });
  const report = await makeReport('TestPanel', [tlc, esr]);
  const params = { id: String(report._id) };
  const save = (test, text) => call(reportController.updateInterpretations, params, { merge: true, interpretations: [{ key: `result:${test._id}`, text }] });
  await Promise.all([save(tlc, 'Edited TLC for this patient'), save(esr, 'Edited ESR for this patient')]);
  let reopened = (await call(reportController.getReportForEntry, params)).body.data.testEntries;
  assert.equal(reopened.find(row => row.testCode === 'INLINE_TLC').interpretation, 'Edited TLC for this patient');
  assert.equal(reopened.find(row => row.testCode === 'INLINE_ESR').interpretation, 'Edited ESR for this patient');
  assert.equal((await Test.findById(tlc._id)).interpretation, 'Catalog TLC interpretation');
  await save(tlc, '');
  reopened = (await call(reportController.getReportForEntry, params)).body.data.testEntries;
  assert.equal(reopened.find(row => row.testCode === 'INLINE_TLC').interpretation, '');
  assert.equal(reopened.find(row => row.testCode === 'INLINE_TLC').interpretationCustomized, true);
  await call(reportController.updateInterpretations, params, { merge: true, interpretations: [], resetKeys: [`result:${tlc._id}`] });
  reopened = (await call(reportController.getReportForEntry, params)).body.data.testEntries;
  assert.equal(reopened.find(row => row.testCode === 'INLINE_TLC').interpretation, 'Catalog TLC interpretation');
  assert.equal(reopened.find(row => row.testCode === 'INLINE_TLC').interpretationCustomized, false);
  assert.equal(reopened.find(row => row.testCode === 'INLINE_ESR').interpretation, 'Edited ESR for this patient');
  assert.equal((await save({ _id: new mongoose.Types.ObjectId() }, 'Unknown test')).statusCode, 400);
});

test('inline interpretation edits keep parameters sharing the same catalog ID distinct', async () => {
  const compound = await Test.create({ code: 'INLINE_PAIR', name: 'CBC fields', category: category._id, sampleType: 'Blood', price: 10,
    interpretation: 'Default parent guidance', parameters: [{ code: 'INLINE_TLC', name: 'TLC' }, { code: 'INLINE_ESR', name: 'ESR' }] });
  const report = await makeReport('TestPanel', [compound]);
  const params = { id: String(report._id) };
  await call(reportController.updateInterpretations, params, { merge: true, interpretations: [{ key: `result:${compound._id}:INLINE_ESR`, text: 'ESR specific guidance' }] });
  const entry = (await call(reportController.getReportForEntry, params)).body.data;
  assert.equal(entry.testEntries.find(row => row.parameterCode === 'INLINE_ESR').interpretation, 'ESR specific guidance');
  assert.equal(entry.testEntries.find(row => row.parameterCode === 'INLINE_TLC').interpretation, 'Default parent guidance');
});

test('rich interpretation HTML and table formatting survive save, submit and reopen', async () => {
  const report = await makeReport();
  const params = { id: String(report._id) };
  const html = '<h3>Interpretation</h3><p>Some <strong>bold detail</strong></p><table><tbody><tr><th>Item</th><th>Meaning</th></tr><tr><td>HB</td><td onclick="alert(1)">Editable cell</td></tr></tbody></table>';
  const saved = await call(reportController.updateInterpretations, params, { merge: true, interpretations: [{ key: `result:${hb._id}`, text: html }] });
  assert.equal(saved.statusCode, 200);
  await reportService.submitResults(report._id, measurements(), user);
  const reopened = (await call(reportController.getReportForEntry, params)).body.data;
  const note = reopened.testEntries.find(row => row.testCode === 'HB').interpretation;
  assert.ok(note.includes('<table>') && note.includes('<strong>bold detail</strong>') && note.includes('<td>Editable cell</td>'));
  assert.ok(!note.includes('onclick'));
  assert.equal(reopened.report.status, 'Reported');
});

test('all report timestamps accept precise times and manual reported time survives submit', async () => {
  const report = await makeReport();
  const times = { registered: '2026-10-11T08:30:00+05:30', collected: '2026-10-11T09:05:00+05:30', received: '2026-10-11T09:15:00+05:30', reported: '2026-10-11T11:45:00+05:30' };
  const saved = await reportService.updateTat(report._id, times);
  for (const key of Object.keys(times)) assert.equal(saved.tat[key].toISOString(), new Date(times[key]).toISOString());
  const submitted = await reportService.submitResults(report._id, measurements(), user);
  assert.equal(submitted.tat.reported.toISOString(), new Date(times.reported).toISOString());
  await assert.rejects(reportService.updateTat(report._id, { received: 'invalid date' }), /Invalid received/);
  await assert.rejects(reportService.updateTat(report._id, { received: '2026-10-11T08:00:00+05:30' }), /earlier than collected/);
  await assert.rejects(reportService.updateTat(report._id, { reported: '2026-10-11T09:00:00+05:30' }), /Reported time/);
  await assert.rejects(reportService.updateTat(report._id, { collected: null }), /Collect the sample/);
});

test('only Admin can change patient identity, including direct API requests', async () => {
  const patient = await Patient.create({ name: 'Identity Test', age: 20, gender: 'Male', phone: '9999999999', registrationNumber: 'IDENTITY-TEST' });
  const params = { id: String(patient._id) };
  const employee = { ...user, role: 'Employee' };
  for (const body of [{ name: 'Changed' }, { phone: '8888888888' }]) {
    assert.equal((await call(patientController.updatePatient, params, body, employee)).statusCode, 403);
  }
  await call(patientController.updatePatient, params, { $set: { name: 'Operator bypass' }, address: 'Allowed address' }, employee);
  assert.equal((await Patient.findById(patient._id)).name, 'Identity Test');
  const saved = await call(patientController.updatePatient, params, { name: 'Corrected Name', phone: '8888888888' });
  assert.equal(saved.body.data.name, 'Corrected Name');
  assert.equal(saved.body.data.phone, '8888888888');
});

test('deleted catalog tests disappear from new selections while historical definitions survive', async () => {
  const disposable = await testService.createTest({ code: 'DELETEME', name: 'Deleted test', category: category._id, sampleType: 'Blood', price: 10, interpretation: 'Historical guidance' });
  const report = await makeReport('TestPanel', [disposable]);
  await reportService.saveResultsDraft(report._id, [{ test: disposable._id, value: '5' }], user);
  await testService.deleteTest(disposable._id);
  assert.ok(!(await testService.getTests()).some(test => String(test._id) === String(disposable._id)));
  assert.equal((await Test.findById(disposable._id)).interpretation, 'Historical guidance');
  const testMap = await require('../src/services/reportPrintSections').loadReportPrintTests(report);
  assert.equal(testMap[String(disposable._id)].interpretation, 'Historical guidance');
});


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
