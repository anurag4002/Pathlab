const Test = require('../models/Test');
const BillItem = require('../models/BillItem');
const TestPanel = require('../models/TestPanel');
const TestPackage = require('../models/TestPackage');
const { isInhouseItem, isOutsourceItem } = require('../utils/billItemModality');

// Keep the billed clinical panel together instead of giving every CBC
// measurement its own page. Standalone catalog tests form their own sections.
async function loadReportPrintTests(report) {
  const ids = [...new Set((report.results || []).map(result => result.test?._id || result.test).filter(Boolean).map(String))];
  const billId = report.bill?._id || report.bill;
  const [tests, billedItems] = await Promise.all([
    ids.length ? Test.find({ _id: { $in: ids } }).populate('category', 'name').lean() : [],
    billId ? BillItem.find({ billId }).lean() : Promise.resolve([])
  ]);
  const items = billedItems.filter(item => report.entryMode === 'inhouse' ? isInhouseItem(item)
    : report.entryMode === 'outsource' ? isOutsourceItem(item) : true);
  const panelIds = items.filter(item => item.itemType === 'TestPanel').map(item => item.itemId).filter(Boolean);
  const packageIds = items.filter(item => item.itemType === 'TestPackage').map(item => item.itemId).filter(Boolean);
  const [panels, packages] = await Promise.all([
    panelIds.length ? TestPanel.find({ _id: { $in: panelIds } }).lean() : [],
    packageIds.length ? TestPackage.find({ _id: { $in: packageIds } }).lean() : []
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
  const billedTestIds = [...items.filter(item => item.itemType === 'Test').map(item => item.itemId), ...membership.keys()].filter(Boolean);
  const loaded = new Set(tests.map(test => String(test._id)));
  const missing = [...new Set(billedTestIds.map(String))].filter(id => !loaded.has(id));
  if (missing.length) tests.push(...await Test.find({ _id: { $in: missing } }).populate('category', 'name').lean());
  const testMap = {};
  for (const test of tests) testMap[String(test._id)] = { ...test, ...membership.get(String(test._id)) };
  return testMap;
}

async function reportInterpretationSections(report) {
  const testMap = await loadReportPrintTests(report);
  const { expandTests } = require('./testDefinitions');
  const { reportNoteBlocks } = require('./interpretationLayout');
  const sections = new Map();
  for (const parent of Object.values(testMap)) {
    const key = parent.reportSectionKey || `test:${parent._id}`;
    if (!sections.has(key)) sections.set(key, { key, title: parent.reportSectionName || parent.name,
      description: parent.reportSectionDescription || '', groups: [{ items: [] }] });
    for (const test of expandTests([parent])) sections.get(key).groups[0].items.push({ test, result: {} });
  }
  // Name-only imported/custom results also support a report-specific note.
  for (const result of report.results || []) {
    if (result.test || result.derived) continue;
    const key = 'uncatalogued';
    if (!sections.has(key)) sections.set(key, { key, title: 'Additional tests', groups: [{ items: [] }] });
    sections.get(key).groups[0].items.push({ test: {}, result });
  }
  return [...sections.values()].map(section => {
    const defaultText = reportNoteBlocks(section).map(block => block.rows ? block.rows.map(row => row.join('\t')).join('\n')
      : block.columns ? [block.columns.map(column => column.heading).join('\t'),
        ...Array.from({ length: Math.max(...block.columns.map(column => column.items.length)) }, (_, i) => block.columns.map(column => column.items[i] || '').join('\t'))].join('\n')
        : block.text).join('\n\n');
    const override = (report.interpretations || []).find(item => item.key === section.key);
    return { key: section.key, title: section.title, defaultText, text: override ? override.text : defaultText, customized: !!override };
  });
}

// Targets for inline editors. Parameter codes keep measurements in a panel
// independent, even when they share the same catalog test ID.
async function reportInterpretationTargets(report) {
  const testMap = await loadReportPrintTests(report);
  const { expandTests, resultKey, includeFormulaDependencies } = require('./testDefinitions');
  const catalog = await Test.find().lean();
  const tests = includeFormulaDependencies(Object.values(testMap), catalog);
  const targets = tests.flatMap(parent => expandTests([parent]).map(test => ({
    key: `result:${resultKey(parent._id, test.parameterCode)}`,
    sectionKey: testMap[String(parent._id)]?.reportSectionKey || `test:${parent._id}`
  })));
  const billId = report.bill?._id || report.bill;
  const items = billId ? await BillItem.find({ billId }).lean() : [];
  for (const row of [...(report.results || []), ...items.filter(item => item.itemType === 'Custom').map(item => ({ testName: item.name }))]) {
    targets.push({ key: `result:${row.test ? resultKey(row.test?._id || row.test, row.parameterCode) : `name:${row.testName}`}`,
      sectionKey: row.test ? testMap[String(row.test?._id || row.test)]?.reportSectionKey || `test:${row.test?._id || row.test}` : 'uncatalogued' });
  }
  return targets;
}

module.exports = { loadReportPrintTests, reportInterpretationSections, reportInterpretationTargets };
