// Add the four billable USG/ECG services without rewriting historical bills
// or replacing catalog IDs, prices or clinical definitions.
// Run: node backend/scripts/configure-imaging-services.js
const mongoose = require('mongoose');
const Test = require('../src/models/Test');
const Category = require('../src/models/TestCategory');

const SERVICES = ['ECG', 'USG'].flatMap(department => [
  { department, code: `${department}_WITH_REPORT`, name: `${department} (With report)`, price: 650 },
  { department, code: `${department}_WITHOUT_REPORT`, name: `${department} (Without report)`, price: 450 }
]);
const sameName = (left, right) => String(left || '').trim().toLowerCase() === right.toLowerCase();

async function configureImagingServices() {
  const records = await Test.find({ $or: [
    { code: { $in: SERVICES.map(service => service.code) } },
    { name: /^\s*(USG|ECG)\s*\((with|without)\s+report\)\s*$/i }
  ] });
  // ECG goes first: rename those legacy ECG records that occupy USG codes,
  // freeing the codes for separate ultrasound entries.
  const claimed = new Set();
  const plan = SERVICES.map(service => {
    const available = records.filter(record => !claimed.has(String(record._id)));
    const named = available.filter(record => sameName(record.name, service.name));
    const coded = available.find(record => record.code === service.code);
    if (named.length > 1 || (named[0] && coded && String(named[0]._id) !== String(coded._id))) {
      throw new Error(`Duplicate ${service.department} service definitions for ${service.code}; no changes made.`);
    }
    const record = named[0] || coded;
    // Never convert an unrelated service simply because its code matches.
    if (record && !sameName(record.name, service.name)) {
      throw new Error(`Code ${service.code} belongs to a different test; no changes made.`);
    }
    if (record) claimed.add(String(record._id));
    return { service, record };
  });

  const result = [];
  for (const { service, record } of plan) {
    const category = await Category.findOneAndUpdate({ name: service.department }, {
      $setOnInsert: { name: service.department, description: service.department === 'USG' ? 'Ultrasound services' : 'Electrocardiography services' }
    }, { upsert: true, new: true });
    let saved;
    if (record) {
      record.code = service.code;
      record.category = category._id;
      saved = await record.save();
    } else {
      saved = await Test.create({ code: service.code, name: service.name, category: category._id,
        price: service.price, sampleType: 'Not applicable', status: 'Active' });
    }
    result.push({ id: String(saved._id), category: category.name, code: saved.code, name: saved.name, price: saved.price, status: saved.status });
  }
  return result;
}

if (require.main === module) {
  const { MONGO_URI } = require('../src/config/environment');
  mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 10000 })
    .then(async () => console.log(JSON.stringify({ services: await configureImagingServices() }, null, 2)))
    .catch(error => { console.error('Imaging catalog update failed:', error.name, error.code || '', error.message.replace(/mongodb(?:\+srv)?:\/\/\S+/gi, '[database]')); process.exitCode = 1; })
    .finally(() => mongoose.disconnect());
}
module.exports = { configureImagingServices };
