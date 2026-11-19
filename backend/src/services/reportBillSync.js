// Keeps a case's lab reports in step with its (possibly edited) bill.
//
// Rule for results whose catalog test is no longer billed for this report's
// entry mode (removed from the bill, or moved to an outsource line):
//  - No entered value (nothing typed for it; calculated rows only): the rows
//    are dropped from an open report, so entry and print follow the bill.
//  - An entered value: never dropped silently. The rows stay (and print)
//    and result entry flags them "not on the bill" with a one-click remove.
//  - Submitted reports (Reported / Signed / Verified / Completed) are never
//    changed here. Removing a row from one goes through allowResultChange:
//    admin only, and a signed report goes back to Reported to be signed again.
const BillItem = require('../models/BillItem');
const Test = require('../models/Test');
const TestPanel = require('../models/TestPanel');
const TestPackage = require('../models/TestPackage');
const { isInhouseItem, isOutsourceItem } = require('../utils/billItemModality');
const { includeFormulaDependencies } = require('./testDefinitions');

const FINAL_STATUSES = ['Reported', 'Signed', 'Verified', 'Completed'];
const idOf = (value) => (value?._id || value ? String(value?._id || value) : '');
const normName = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
// "HbA1c" typed as an outsource line matches "HbA1c (Glycated Hemoglobin)".
const namesMatch = (a, b) => {
  const x = normName(a);
  const y = normName(b);
  return x.length >= 3 && y.length >= 3 && (x.includes(y) || y.includes(x));
};

// The catalog tests this report's share of the bill covers: billed tests,
// panel/package members and the inputs their formulas read. Returns null
// when the bill has no lines at all (legacy data) so nothing is pruned.
async function billedScope(report, { catalog } = {}) {
  const billId = idOf(report.bill);
  if (!billId) return null;
  const allItems = await BillItem.find({ billId }).lean();
  if (!allItems.length) return null;
  const mode = report.entryMode || 'all';
  const items = mode === 'inhouse' ? allItems.filter(isInhouseItem)
    : mode === 'outsource' ? allItems.filter(isOutsourceItem) : allItems;
  const ids = new Set(items.filter((item) => item.itemType === 'Test' && item.itemId).map((item) => String(item.itemId)));
  const panelIds = items.filter((item) => item.itemType === 'TestPanel' && item.itemId).map((item) => item.itemId);
  const packageIds = items.filter((item) => item.itemType === 'TestPackage' && item.itemId).map((item) => item.itemId);
  const [panels, packages] = await Promise.all([
    panelIds.length ? TestPanel.find({ _id: { $in: panelIds } }).select('tests').lean() : [],
    packageIds.length ? TestPackage.find({ _id: { $in: packageIds } }).select('includedTests').lean() : []
  ]);
  panels.forEach((panel) => (panel.tests || []).forEach((id) => ids.add(String(id))));
  packages.forEach((pkg) => (pkg.includedTests || []).forEach((id) => ids.add(String(id))));
  const tests = catalog || await Test.find().lean();
  includeFormulaDependencies(tests.filter((test) => ids.has(String(test._id))), tests)
    .forEach((test) => ids.add(String(test._id)));
  // Outsource lines of the whole bill, to say "moved to outsource".
  const outsourceNames = allItems.filter(isOutsourceItem).map((item) => item.name);
  return { testIds: ids, outsourceNames };
}

const hasEnteredValue = (rows) => rows.some((row) => !row.derived && String(row.value ?? '').trim() !== '');

// Group the report's catalog-linked results that the bill no longer covers.
// Name-only rows (typed/imported) are left alone.
function staleResultGroups(report, scope) {
  if (!scope) return new Map();
  const groups = new Map();
  for (const row of report.results || []) {
    const id = idOf(row.test);
    if (!id || scope.testIds.has(id)) continue;
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id).push(row);
  }
  return groups;
}

function staleNote(testName, scope) {
  const name = String(testName || '').split(':')[0];
  const moved = (scope?.outsourceNames || []).some((other) => namesMatch(name, other));
  return moved ? 'Moved to outsource on the bill. Remove from this report?' : 'Not on the bill any more. Remove from this report?';
}

// Drop value-less stale rows from an open report. Returns true when changed.
// Submitted reports are left exactly as they were signed or submitted.
function pruneStaleResults(report, scope) {
  if (!scope || FINAL_STATUSES.includes(report.status)) return false;
  const drop = new Set([...staleResultGroups(report, scope)].filter(([, rows]) => !hasEnteredValue(rows)).map(([id]) => id));
  if (!drop.size) return false;
  report.results = (report.results || []).filter((row) => !drop.has(idOf(row.test)));
  if (!report.results.length && report.status === 'Draft') report.status = 'Registered';
  return true;
}

// Bring one stored report in line with its bill (persisted).
async function syncReportWithBill(report, options = {}) {
  const scope = await billedScope(report, options);
  const changed = pruneStaleResults(report, scope);
  if (changed) await report.save();
  return { scope, changed };
}

// After a bill edit: every report of the bill.
async function syncBillReports(billId) {
  const Report = require('../models/Report');
  const reports = await Report.find({ bill: billId });
  if (!reports.length) return [];
  const catalog = await Test.find().lean();
  const out = [];
  for (const report of reports) out.push({ report, ...(await syncReportWithBill(report, { catalog })) });
  return out;
}

// Stale tests with entered values that result entry should flag, by test id.
function flaggedStaleTests(report, scope) {
  const flagged = new Map();
  for (const [id, rows] of staleResultGroups(report, scope)) {
    // Value-less rows only survive on submitted reports; flag those too so an
    // admin can take them off deliberately.
    if (!hasEnteredValue(rows) && !FINAL_STATUSES.includes(report.status)) continue;
    flagged.set(id, staleNote(rows[0]?.testName, scope));
  }
  return flagged;
}

// One-click remove of a test that is no longer on the bill.
async function removeStaleTest(reportId, testId, user) {
  const Report = require('../models/Report');
  const { allowResultChange } = require('./reportService');
  const report = await Report.findById(reportId);
  if (!report) throw Object.assign(new Error('Report not found'), { statusCode: 404 });
  const id = String(testId || '');
  const scope = await billedScope(report);
  if (!scope) throw Object.assign(new Error('This report has no bill lines to compare with.'), { statusCode: 400 });
  if (scope.testIds.has(id)) {
    throw Object.assign(new Error('This test is still on the bill for this report. Edit the bill first.'), { statusCode: 400 });
  }
  const rows = (report.results || []).filter((row) => idOf(row.test) === id);
  if (!rows.length) throw Object.assign(new Error('This test is not on the report.'), { statusCode: 404 });
  const change = allowResultChange(report, user);
  report.results = report.results.filter((row) => idOf(row.test) !== id);
  // Result-level notes written for the removed rows go with them.
  report.interpretations = (report.interpretations || []).filter((item) => !String(item.key || '').startsWith(`result:${id}`));
  if (!report.results.length && report.status === 'Draft') report.status = 'Registered';
  await report.save();
  report.$locals.change = change;
  report.$locals.removedName = String(rows[0]?.testName || 'Test').split(':')[0].trim();
  return report;
}

module.exports = { namesMatch, billedScope, staleResultGroups, pruneStaleResults, syncReportWithBill, syncBillReports, flaggedStaleTests, removeStaleTest, FINAL_STATUSES };
