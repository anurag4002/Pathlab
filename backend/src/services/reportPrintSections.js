const Test = require('../models/Test');
const BillItem = require('../models/BillItem');
const TestPanel = require('../models/TestPanel');
const TestPackage = require('../models/TestPackage');
const { isInhouseItem, isOutsourceItem } = require('../utils/billItemModality');

// Keep the billed clinical panel together instead of giving every CBC
// measurement its own page. Standalone catalog tests form their own sections.
async function loadReportPrintTests(report) {
  const ids = (report.results || []).map(result => result.test?._id || result.test).filter(Boolean);
  const billId = report.bill?._id || report.bill;
  const [tests, billedItems] = await Promise.all([
    Test.find({ _id: { $in: ids } }).populate('category', 'name').lean(),
    billId ? BillItem.find({ billId }).lean() : Promise.resolve([])
  ]);
  const items = billedItems.filter(item => report.entryMode === 'inhouse' ? isInhouseItem(item)
    : report.entryMode === 'outsource' ? isOutsourceItem(item) : true);
  const [panels, packages] = await Promise.all([
    TestPanel.find({ _id: { $in: items.filter(item => item.itemType === 'TestPanel').map(item => item.itemId).filter(Boolean) } }).lean(),
    TestPackage.find({ _id: { $in: items.filter(item => item.itemType === 'TestPackage').map(item => item.itemId).filter(Boolean) } }).lean()
  ]);
  const membership = new Map();
  // Panel membership takes priority when a test is also part of a package.
  for (const item of [...packages.map(record => ({ record, type: 'package', children: record.includedTests })),
    ...panels.map(record => ({ record, type: 'panel', children: record.tests }))]) {
    for (const id of item.children || []) membership.set(String(id), {
      reportSectionKey: `${item.type}:${item.record._id}`, reportSectionName: item.record.name,
      reportSectionDescription: item.record.description || ''
    });
  }
  const testMap = {};
  for (const test of tests) testMap[String(test._id)] = { ...test, ...membership.get(String(test._id)) };
  return testMap;
}

module.exports = { loadReportPrintTests };
