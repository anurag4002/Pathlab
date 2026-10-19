const { before, after, test } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Test = require('../src/models/Test');
const Category = require('../src/models/TestCategory');
const { configureImagingServices } = require('../scripts/configure-imaging-services');
const { getUSGServices } = require('../src/services/usgServiceOptions');
let database, ecgWith, ecgWithout;

before(async () => {
  database = await MongoMemoryServer.create(); await mongoose.connect(database.getUri());
  await Promise.all([Test.init(), Category.init()]);
  const category = await Category.create({ name: 'ECG' });
  [ecgWith, ecgWithout] = await Test.create([
    { name: 'ECG (With report)', code: 'USG_WITH_REPORT', price: 710, category: category._id, sampleType: 'Not applicable' },
    { name: 'ECG (Without report)', code: 'USG_WITHOUT_REPORT', price: 450, category: category._id, sampleType: 'Not applicable' }
  ]);
});
after(async () => { await mongoose.disconnect(); await database?.stop(); });

test('corrects legacy ECG codes in place and creates separate selectable USG services', async () => {
  const result = await configureImagingServices();
  assert.equal(result.length, 4);
  assert.equal((await Test.findById(ecgWith._id)).code, 'ECG_WITH_REPORT');
  assert.equal((await Test.findById(ecgWithout._id)).code, 'ECG_WITHOUT_REPORT');
  assert.equal((await Test.findById(ecgWith._id)).price, 710, 'existing prices must not reset');
  assert.equal(await Category.countDocuments(), 2);
  const usg = await getUSGServices();
  assert.deepEqual(usg.map(service => service.name), ['USG (With report)', 'USG (Without report)']);
  assert.deepEqual(usg.map(service => service.price), [650, 450]);
  for (const row of await Test.find().populate('category')) {
    assert.equal(row.status, 'Active');
    assert.ok(row.code.startsWith(row.category.name));
  }
});

test('repeated setup preserves IDs, edited prices and definitions without duplicates', async () => {
  const before = await Test.find().sort({ code: 1 }).lean();
  await Test.updateOne({ code: 'USG_WITH_REPORT' }, { price: 900, description: 'Custom service details' });
  await configureImagingServices();
  const after = await Test.find().sort({ code: 1 }).lean();
  assert.equal(after.length, 4);
  assert.deepEqual(after.map(row => String(row._id)), before.map(row => String(row._id)));
  const modified = after.find(row => row.code === 'USG_WITH_REPORT');
  assert.equal(modified.price, 900); assert.equal(modified.description, 'Custom service details');
});
