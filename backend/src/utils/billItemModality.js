/** Catalog lines with a master id — in-house value entry. */
const isInhouseItem = (item) => {
  if (!item) return false;
  const type = item.itemType;
  return ['Test', 'TestPackage', 'TestPanel'].includes(type) && !!item.itemId;
};

/** Custom / typed lines — outsource PDF/image upload. */
const isOutsourceItem = (item) => {
  if (!item) return false;
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
    modes.push(deptOut ? 'outsource' : 'inhouse');
  }
  return modes;
};

module.exports = {
  isInhouseItem,
  isOutsourceItem,
  reportModesForItems
};
