// Explicit catalog update. Run: node backend/scripts/configure-usg-services.js
// Existing bills/case prices are snapshots and are not rewritten.
const mongoose = require('mongoose');
const Test = require('../src/models/Test');
const Category = require('../src/models/TestCategory');

async function configureUSGServices() {
  const category = await Category.findOneAndUpdate({ name: 'USG' }, { $setOnInsert: { name: 'USG', description: 'Ultrasound services' } }, { upsert: true, new: true });
  const services = [
    { code: 'USG_WITH_REPORT', name: 'USG (With report)', price: 650 },
    { code: 'USG_WITHOUT_REPORT', name: 'USG (Without report)', price: 450 }
  ];
  const results = [];
  for (const service of services) {
    const record = await Test.findOneAndUpdate({ code: service.code }, { $set: { ...service, category: category._id, sampleType: 'Not applicable', status: 'Active', isDeleted: false } }, { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true });
    results.push({ id: String(record._id), code: record.code, name: record.name, price: record.price });
  }
  return results;
}

if (require.main === module) {
  const { MONGO_URI } = require('../src/config/environment');
  mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 10000 })
    .then(async () => console.log(JSON.stringify({ database: mongoose.connection.name, services: await configureUSGServices() }, null, 2)))
    .catch(error => { console.error('USG catalog update failed:', error.name, error.code || ''); process.exitCode = 1; })
    .finally(() => mongoose.disconnect());
}
module.exports = { configureUSGServices };
