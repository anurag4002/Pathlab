const SERVICE_CODES = { 'with-report': 'USG_WITH_REPORT', 'without-report': 'USG_WITHOUT_REPORT' };

async function getUSGServices() {
  const tests = await require('../models/Test').find({ code: { $in: Object.values(SERVICE_CODES) }, status: 'Active', isDeleted: { $ne: true } }).select('name code price').lean();
  return Object.entries(SERVICE_CODES).flatMap(([value, code]) => {
    const test = tests.find(test => test.code === code);
    return test ? [{ ...test, value }] : [];
  });
}

async function getUSGService(value = 'with-report') {
  if (!SERVICE_CODES[value]) throw Object.assign(new Error('Choose USG with report or without report.'), { statusCode: 400 });
  const service = (await getUSGServices()).find(option => option.value === value);
  if (!service) throw Object.assign(new Error('This USG service is not active in the test catalog. Contact the administrator.'), { statusCode: 400 });
  return service;
}

async function normalizeUSGBillItems(items, existingItems = []) {
  const services = await getUSGServices();
  const service = items?.length === 1 && services.find(option => String(option._id) === String(items[0].itemId || '') || option.name.toLowerCase() === String(items[0].name || '').trim().toLowerCase());
  if (service) return [{ itemType: 'Test', itemId: service._id, name: service.name, price: service.price }];
  // Keep historical invoices editable without changing their recorded services.
  if (existingItems.length && items?.length === existingItems.length && items.every((item, index) => {
    const old = existingItems[index];
    return item.itemType === old.itemType && String(item.itemId || '') === String(old.itemId || '') && item.name === old.name && Number(item.price) === old.price;
  })) return items;
  throw Object.assign(new Error('Select one of the two USG services from the catalog.'), { statusCode: 400 });
}

async function syncUSGCaseForBill(bill, items) {
  return require('./imagingBillService').syncImagingCasesForBill(bill, items);
}

module.exports = { getUSGServices, getUSGService, normalizeUSGBillItems, syncUSGCaseForBill };
