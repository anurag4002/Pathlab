// Sets parameters[].subheading for Labsmart "Multi parameter nested" tests
// (Urine / Stool / Semen / Fluid examination) from
// src/assets/document-formats/nested-test-subheadings.json: each heading
// applies from the named parameter up to the next heading, as printed on
// Labsmart reports. Skips a test whose parameters already have sub-headings.
// Dry run unless --apply.   node scripts/seedParameterSubheadings.js [--apply]
require('../src/config/environment');
const mongoose = require('mongoose');
const Test = require('../src/models/Test');
const mapping = require('../src/assets/document-formats/nested-test-subheadings.json');
const norm = value => String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

(async () => {
  const apply = process.argv.includes('--apply');
  await mongoose.connect(process.env.MONGO_URI);
  let changed = 0;
  for (const [name, headings] of Object.entries(mapping)) {
    const tests = await Test.find({ name });
    if (!tests.length) { console.log(`${name}: not in catalog`); continue; }
    for (const test of tests) {
      const parameters = test.parameters || [];
      if (parameters.some(p => String(p.subheading || '').trim())) { console.log(`${name}: already has sub-headings, kept`); continue; }
      const starts = headings.map(([first, heading]) => ({ index: parameters.findIndex(p => norm(p.name) === norm(first)), heading }));
      const missing = starts.filter(s => s.index < 0);
      if (missing.length) { console.log(`${name}: parameter not found for ${missing.map(m => m.heading).join(', ')}; skipped`); continue; }
      starts.sort((a, b) => a.index - b.index);
      const update = {};
      parameters.forEach((p, i) => { update[`parameters.${i}.subheading`] = [...starts].reverse().find(s => s.index <= i)?.heading || ''; });
      console.log(`${name}: ${starts.map(s => `${s.heading} from ${parameters[s.index].name}`).join('; ')}${apply ? '' : ' (dry run)'}`);
      if (apply) await Test.updateOne({ _id: test._id }, { $set: update });
      changed++;
    }
  }
  console.log(`${changed} test(s) ${apply ? 'updated' : 'would be updated (pass --apply)'}`);
  await mongoose.disconnect();
})().catch(error => { console.error(error); process.exit(1); });
