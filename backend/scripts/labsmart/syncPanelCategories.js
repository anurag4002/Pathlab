// Copies each panel's print department and list position from the Labsmart
// panel list (tests/fixtures/labsmart/panel-categories.json) onto TestPanel.
//
//   node scripts/labsmart/syncPanelCategories.js          # dry run
//   node scripts/labsmart/syncPanelCategories.js --apply  # write changes
process.env.NODE_ENV = process.env.NODE_ENV || 'development';
require('../../src/config/environment');
const path = require('path');
const mongoose = require('mongoose');
const TestPanel = require('../../src/models/TestPanel');
const TestCategory = require('../../src/models/TestCategory');

const rows = require(path.join(__dirname, '../../tests/fixtures/labsmart/panel-categories.json'));
const key = value => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

(async () => {
  const apply = process.argv.includes('--apply');
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 15000 });
  const categories = new Map((await TestCategory.find().lean()).map(c => [key(c.name), c]));
  const panels = new Map((await TestPanel.find().lean()).map(p => [key(p.name), p]));
  const changes = [];
  for (const row of rows) {
    const panel = panels.get(key(row.name));
    const category = categories.get(key(row.category));
    if (!panel || !category) { console.log(`skip ${row.name}: ${!panel ? 'no panel' : 'no category ' + row.category}`); continue; }
    if (String(panel.category || '') === String(category._id) && panel.displayOrder === row.order) continue;
    changes.push({ updateOne: { filter: { _id: panel._id }, update: { $set: { category: category._id, displayOrder: row.order } } } });
    console.log(`${row.order}. ${panel.name} -> ${category.name}`);
  }
  if (apply && changes.length) console.log('updated', (await TestPanel.bulkWrite(changes)).modifiedCount);
  else console.log(`${changes.length} change(s)${apply ? '' : ' (dry run; pass --apply to write)'}`);
  await mongoose.disconnect();
})().catch(error => { console.error(error); process.exit(1); });
