// One-time cleanup: remove repeated test entries from panels (keeps each
// test's first position). Dry run by default.
//   node scripts/dedupePanelTests.js          # show what would change
//   node scripts/dedupePanelTests.js --apply  # write the changes
process.env.NODE_ENV = process.env.NODE_ENV || 'development';
require('../src/config/environment');
const mongoose = require('mongoose');
const TestPanel = require('../src/models/TestPanel');

(async () => {
  const apply = process.argv.includes('--apply');
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 15000 });
  const panels = await TestPanel.collection.find({}).toArray();
  let changed = 0;
  for (const panel of panels) {
    const unique = TestPanel.uniqueTestIds(panel.tests || []);
    if (unique.length === (panel.tests || []).length) continue;
    changed++;
    console.log(`${panel.name}: ${(panel.tests || []).length} -> ${unique.length} tests`);
    if (apply) await TestPanel.collection.updateOne({ _id: panel._id }, { $set: { tests: unique } });
  }
  console.log(`${changed} panel(s) ${apply ? 'cleaned' : 'would be cleaned (dry run; pass --apply)'}`);
  await mongoose.disconnect();
})().catch((error) => { console.error(error); process.exit(1); });
