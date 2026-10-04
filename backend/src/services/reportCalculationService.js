const Test = require('../models/Test');
const BillItem = require('../models/BillItem');
const TestPanel = require('../models/TestPanel');
const TestPackage = require('../models/TestPackage');
const { isInhouseItem, isOutsourceItem } = require('../utils/billItemModality');
const { derive, evaluateResult } = require('./formulaService');
const { parseFormula, evaluateFormula } = require('./formulaExpression');
const { expandTests, resultKey, includeFormulaDependencies, orderTestsBySource } = require('./testDefinitions');
const { resolveReferenceRange } = require('./referenceRangeService');

// Load formula targets from this report's bill, including panel/package children.
// Input entries alone omit read-only formula tests in the result-entry UI.
async function loadReportTests(report, entries) {
  const billId = report.bill?._id || report.bill;
  let items = billId ? await BillItem.find({ billId }).lean() : [];
  if (report.entryMode === 'inhouse') items = items.filter(isInhouseItem);
  if (report.entryMode === 'outsource') items = items.filter(isOutsourceItem);
  const ids = new Set(entries.map((e) => String(e.test || '')).filter((id) => /^[a-f\d]{24}$/i.test(id)));
  for (const item of items) if (item.itemType === 'Test' && item.itemId) ids.add(String(item.itemId));
  const [panels, packages] = await Promise.all([
    TestPanel.find({ _id: { $in: items.filter((i) => i.itemType === 'TestPanel').map((i) => i.itemId) } }).lean(),
    TestPackage.find({ _id: { $in: items.filter((i) => i.itemType === 'TestPackage').map((i) => i.itemId) } }).lean()
  ]);
  panels.forEach((p) => p.tests.forEach((id) => ids.add(String(id))));
  packages.forEach((p) => p.includedTests.forEach((id) => ids.add(String(id))));
  const catalog = await Test.find().lean();
  return includeFormulaDependencies(catalog.filter((t) => ids.has(String(t._id))), catalog);
}

function buildResultRows(entries, tests, patient = {}) {
  // Keep earlier scalar entries when a catalog test gains separate parameters.
  const legacyParents = new Map(tests.filter((test) => test.parameters?.length).map((test) => [String(test._id), test]));
  tests = expandTests(orderTestsBySource(tests)).map((t) => resolveReferenceRange(t, patient));
  const byId = new Map(tests.map((t) => [resultKey(t._id, t.parameterCode), t]));
  const values = {};
  const row = (test, name, value, unit, derived) => ({
    test: test?._id || null,
    testName: test?.name || name || '',
    value: value == null ? '' : String(value),
    unit: test ? test.unit || '' : unit || '',
    flag: evaluateResult(value, test, patient).flag,
    derived,
    parameterCode: test?.parameterCode || '',
    referenceRange: test?.referenceRange || ''
  });
  const rows = [];
  for (const entry of entries) {
    const test = byId.get(resultKey(entry.test, entry.parameterCode))
      || (!entry.parameterCode && legacyParents.has(String(entry.test)) ? resolveReferenceRange(legacyParents.get(String(entry.test)), patient) : null);
    if (entry.test && !test) throw Object.assign(new Error('Unknown result test or parameter'), { statusCode: 400 });
    // Ignore client-supplied formula values; always recompute from measurements.
    if (test?.isDerived) continue;
    if (test?.code) values[test.code] = entry.value;
    if (test?.name) values[test.name] = entry.value;
    else if (entry.testName) values[entry.testName] = entry.value;
    rows.push(row(test, entry.testName, entry.value, entry.unit, false));
  }
  const pending = tests.filter((t) => t.isDerived && String(t.formula || '').trim());
  const skipped = [];
  const parsed = new Map();
  for (const test of pending) {
    try { parsed.set(test, parseFormula(test.formula)); }
    catch (error) { skipped.push({ test: resultKey(test._id, test.parameterCode), reason: error.message }); }
  }
  // Iterative dependency resolution supports chains regardless of catalog order.
  while (parsed.size) {
    let progress = false;
    for (const [test, formula] of parsed) {
      try {
        const evaluated = evaluateFormula(formula, values, patient);
        const value = typeof evaluated === 'number' ? Math.round(evaluated * 1e10) / 1e10 : evaluated;
        values[test.code] = value;
        values[test.name] = value;
        rows.push(row(test, test.name, value, test.unit, true));
        parsed.delete(test);
        progress = true;
      } catch { /* retry after any dependencies have been computed */ }
    }
    if (!progress) break;
  }
  for (const [test, formula] of parsed) {
    try { evaluateFormula(formula, values, patient); }
    catch (error) { skipped.push({ test: resultKey(test._id, test.parameterCode), reason: error.message }); }
  }
  const configuredCodes = new Set(pending.map((t) => t.code.toUpperCase()));
  const configuredNames = new Set(pending.map((t) => t.name.toUpperCase()));
  const legacy = derive(values, patient).derived;
  for (const result of legacy) {
    if (configuredCodes.has(result.testCode.toUpperCase()) || configuredNames.has(result.testName.toUpperCase())) continue;
    const test = tests.find((t) => t.code.toUpperCase() === result.testCode.toUpperCase() || t.name.toUpperCase() === result.testName.toUpperCase());
    // A catalog test set to manual must stay manual.
    if (!test || !test.isDerived || test.formula) continue;
    rows.push(row(test, result.testName, result.value, result.unit, true));
  }
  for (const test of tests.filter((t) => t.isDerived && !String(t.formula || '').trim())) {
    if (!rows.some((r) => String(r.test) === String(test._id))) {
      skipped.push({ test: String(test._id), reason: 'Formula not configured or required inputs missing' });
    }
  }
  const sourceOrder = new Map(tests.filter(t=>t.sourceTestId).map((t,i)=>[resultKey(t._id,t.parameterCode),i]));
  rows.sort((a,b)=>(sourceOrder.get(resultKey(a.test,a.parameterCode)) ?? Infinity)-(sourceOrder.get(resultKey(b.test,b.parameterCode)) ?? Infinity));
  return { results: rows, skipped };
}

async function calculateReportResults(report, entries) {
  return buildResultRows(entries, await loadReportTests(report, entries), report.patient || {});
}

module.exports = { calculateReportResults, buildResultRows };
