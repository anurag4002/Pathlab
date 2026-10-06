// Save the user's concise CBC guidance as editable clinical panel content.
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { MONGO_URI } = require('../src/config/environment');
const TestPanel = require('../src/models/TestPanel');
const TestPackage = require('../src/models/TestPackage');
const guidance = require('../src/assets/document-formats/cbc-guidance.json');
const description = [guidance.heading, ...guidance.rows.map(row => row.join('\t'))].join('\n');
const name = /^(?:complete blood count\b|cbc\b)/i;
async function main() {
  await mongoose.connect(MONGO_URI);
  try {
    const records = [];
    for (const Model of [TestPanel, TestPackage]) for (const record of await Model.find({ name }).lean()) records.push({ Model, record });
    const changed = records.filter(({ record }) => record.description !== description);
    let modified = 0;
    if (process.argv.includes('--apply') && changed.length) {
      const backup = path.join(__dirname, '../../tmp/report-guidance', `cbc-descriptions-${Date.now()}.json`);
      fs.mkdirSync(path.dirname(backup), { recursive: true });
      fs.writeFileSync(backup, JSON.stringify(changed.map(({ Model, record }) => ({ collection: Model.collection.name, record })), null, 2));
      for (const { Model, record } of changed) {
        const result = await Model.updateOne({ _id: record._id, description: record.description === undefined ? { $exists: false } : record.description }, { $set: { description } });
        modified += result.modifiedCount;
      }
      console.log(`Saved prior descriptions: ${backup}`);
    }
    console.log(JSON.stringify({ mode: process.argv.includes('--apply') ? 'Applied' : 'Read only', modified, panels: records.map(({ record }) => record.name) }, null, 2));
  } finally { await mongoose.disconnect(); }
}
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { description };
