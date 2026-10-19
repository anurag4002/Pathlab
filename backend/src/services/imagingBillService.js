const Bill = require('../models/Bill');
const BillItem = require('../models/BillItem');
const Test = require('../models/Test');
const TestCategory = require('../models/TestCategory');
const USGCase = require('../models/USGCase');
const XrayCase = require('../models/XrayCase');
const { imagingDepartment, USG_PATTERN, XRAY_PATTERN, ECG_PATTERN } = require('../utils/imagingDepartment');

async function classifyImagingItems(items, bill = {}) {
  const ids = items.filter(item => item.itemType === 'Test' && item.itemId).map(item => item.itemId);
  const tests = await Test.find({ _id: { $in: ids } }).populate('category', 'name').lean();
  const byId = new Map(tests.map(test => [String(test._id), test]));
  return items.map(item => {
    const row = item.toObject ? item.toObject() : { ...item };
    const test = byId.get(String(item.itemId));
    const name = test?.name || row.name || '';
    let department = imagingDepartment({ name });
    if (!department && !ECG_PATTERN.test(name)) {
      department = imagingDepartment({ name: test?.category?.name || '' })
        || imagingDepartment({ name: String(bill.department || '') });
    }
    return { ...row, reportDepartment: department };
  });
}

async function syncImagingCasesForBill(bill, items, { onlyMissing = false } = {}) {
  const classified = await classifyImagingItems(items, bill);
  for (const [department, Model] of [['USG', USGCase], ['XRAY', XrayCase]]) {
    const lines = classified.filter(item => item.reportDepartment === department);
    if (!lines.length) continue;
    if (onlyMissing && await Model.exists({ bill: bill._id })) continue;
    const fields = {
      patient: bill.patient?._id || bill.patient,
      branch: bill.branch || null,
      referringDoctor: bill.referringDoctor?._id || bill.referringDoctor || null
    };
    const initial = { bill: bill._id, findings: '', date: bill.date, status: 'Pending' };
    if (department === 'USG') {
      const withoutReport = lines.every(item => /without[\s_-]*report/i.test(item.name));
      fields.serviceType = withoutReport ? 'without-report' : 'with-report';
      fields.price = lines.reduce((total, item) => total + Number(item.price || 0), 0);
      initial.status = withoutReport ? 'Completed' : 'Pending';
    }
    await Model.findOneAndUpdate({ bill: bill._id }, { $set: fields, $setOnInsert: initial }, { upsert: true, runValidators: true, setDefaultsOnInsert: true });
  }
  return classified;
}

// Recover old paid orders that predate billing -> imaging case linking. Scope
// the bills before writing, and never replace findings, uploads or statuses.
async function recoverMissingImagingCases(branchScope, department) {
  const pattern = department === 'USG' ? USG_PATTERN : XRAY_PATTERN;
  const categories = await TestCategory.find({ name: pattern }).select('_id').lean();
  const tests = await Test.find({ $or: [{ name: pattern }, { category: { $in: categories.map(category => category._id) } }] }).select('_id').lean();
  const billIds = await BillItem.distinct('billId', { $or: [
    { name: pattern }, { reportDepartment: department },
    { itemType: 'Test', itemId: { $in: tests.map(test => test._id) } }
  ] });
  const departments = department === 'USG' ? ['USG'] : ['XRAY', 'X-RAY', 'X RAY', 'DIGITAL XRAY', 'DIGITAL X-RAY'];
  const bills = Bill.find({ ...branchScope, isVoided: { $ne: true }, cancelled: { $ne: true }, $or: [{ _id: { $in: billIds } }, { department: { $in: departments } }] }).cursor();
  const Model = department === 'USG' ? USGCase : XrayCase;
  for await (const bill of bills) {
    if (await Model.exists({ bill: bill._id })) continue;
    const items = await BillItem.find({ billId: bill._id });
    const classified = await syncImagingCasesForBill(bill, items, { onlyMissing: true });
    const changes = classified.filter(item => item.reportDepartment !== (items.find(original => String(original._id) === String(item._id))?.reportDepartment || ''));
    if (changes.length) await BillItem.bulkWrite(changes.map(item => ({ updateOne: {
      filter: { _id: item._id }, update: { $set: { reportDepartment: item.reportDepartment } }
    } })));
  }
}

module.exports = { classifyImagingItems, syncImagingCasesForBill, recoverMissingImagingCases };
