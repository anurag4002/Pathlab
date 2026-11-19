const { imagingDepartment } = require('./imagingDepartment');
const isUploadItem = item => /\bECG\b|\bEKG\b|electrocardiogram/i.test(String(item?.name || ''));

/** Catalog lines with a master id — in-house value entry. */
const isInhouseItem = (item) => {
  if (!item) return false;
  if (imagingDepartment(item)) return false;
  const type = item.itemType;
  return !isUploadItem(item) && ['Test', 'TestPackage', 'TestPanel'].includes(type) && !!item.itemId;
};

/** Custom / typed lines — outsource PDF/image upload. */
const isOutsourceItem = (item) => {
  if (!item) return false;
  if (imagingDepartment(item)) return false;
  if (isUploadItem(item)) return true;
  if (item.itemType === 'Custom') return true;
  return !item.itemId && !!String(item.name || '').trim();
};

/**
 * Which report shells a bill needs.
 * Mixed catalog + Custom → both; catalog only → inhouse; Custom only → outsource.
 */
const reportModesForItems = (items = [], bill = {}) => {
  const list = Array.isArray(items) ? items : [];
  const hasInhouse = list.some(isInhouseItem);
  const hasOutsource = list.some(isOutsourceItem);
  const deptOut = String(bill.department || '').toUpperCase().includes('OUTSOURCE')
    || bill.caseType === 'OutsourceLabCase';

  const modes = [];
  if (hasInhouse) modes.push('inhouse');
  if (hasOutsource) modes.push('outsource');
  if (!modes.length) {
    if (list.length && list.every(item => imagingDepartment(item))) return [];
    modes.push(deptOut ? 'outsource' : 'inhouse');
  }
  return modes;
};

/**
 * The bill lines a report covers: an 'inhouse' shell holds the catalog lines,
 * an 'outsource' shell the custom/typed ones; a legacy/'all' report holds
 * every lab line. Imaging (USG / X-ray) lines never belong to a lab report.
 * Accepts the report (or its entryMode string).
 */
const reportItems = (report, items = []) => {
  const mode = (typeof report === 'string' ? report : report?.entryMode) || 'all';
  const list = (Array.isArray(items) ? items : []).filter(item => item && typeof item === 'object' && !imagingDepartment(item));
  if (mode === 'inhouse') return list.filter(isInhouseItem);
  if (mode === 'outsource') return list.filter(isOutsourceItem);
  return list;
};

const cleanTestName = name => String(name || '').replace(/\s*\(bundle\)\s*$/i, '').trim();

/** Unique display names of the tests a report covers ("(bundle)" stripped). */
const reportTestNames = (report, items = []) => [
  ...new Set(reportItems(report, items).map(item => cleanTestName(item.name)).filter(Boolean))
];

module.exports = {
  isInhouseItem,
  isOutsourceItem,
  reportModesForItems,
  reportItems,
  reportTestNames,
  cleanTestName
};
