// Seed empty/import-placeholder KFT descriptions and clear import bookkeeping
// from other panels/packages. Clinical edits remain untouched. Text is editable
// database content; the
// report renderer reads the database rather than substituting this asset.
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { MONGO_URI } = require('../src/config/environment');
const TestPanel = require('../src/models/TestPanel');
const TestPackage = require('../src/models/TestPackage');
const guidance = require('../src/assets/document-formats/kft-guidance.json');

const description = [guidance.description, ...guidance.columns.flatMap(column => [column.heading, ...column.items])].join('\n');
const name = /^(?:kidney function(?: test)?|renal function(?: test)?)(?:\s*\((?:kft|rft)\))?$|^(?:kft|rft)$/i;
async function main() {
  await mongoose.connect(MONGO_URI);
  try {
    const records = [];
    for (const Model of [TestPanel, TestPackage]) {
      for (const record of await Model.find({ $or: [{ name }, { description: /^\s*Migrated from Labsmart\b/i }] }).lean()) records.push({ Model, record });
    }
    const candidates = records.filter(({ record }) => !record.description?.trim() || /^\s*Migrated from Labsmart\b/i.test(record.description));
    let modified = 0;
    if (process.argv.includes('--apply') && candidates.length) {
      const backup = path.join(__dirname, '../../tmp/report-guidance', `kft-descriptions-${Date.now()}.json`);
      fs.mkdirSync(path.dirname(backup), { recursive: true });
      fs.writeFileSync(backup, JSON.stringify(candidates.map(({ Model, record }) => ({ collection: Model.collection.name, record })), null, 2));
      for (const { Model, record } of candidates) {
        const nextDescription = name.test(record.name) ? description : '';
        const result = await Model.updateOne({ _id: record._id, description: record.description === undefined ? { $exists: false } : record.description }, { $set: { description: nextDescription } });
        modified += result.modifiedCount;
        if (result.matchedCount) record.description = nextDescription;
      }
      console.log(`Saved prior descriptions: ${backup}`);
    }
    console.log(JSON.stringify({ mode: process.argv.includes('--apply') ? 'Applied' : 'Read only', matched: records.length, placeholderDescriptions: candidates.length, modified,
      panels: records.map(({ Model, record }) => ({ type: Model.modelName, name: record.name, clinicalDescription: !!record.description?.trim() && !/^\s*Migrated from Labsmart\b/i.test(record.description) })) }, null, 2));
  } finally { await mongoose.disconnect(); }
}
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { description };
