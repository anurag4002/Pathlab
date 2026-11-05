// Fills Test.documentTemplate for Document-type tests (Widal, FNAC, PAP
// smear ...) from src/assets/document-formats/document-test-templates.json,
// the text Labsmart prints for them. Never overwrites a template the lab has
// already edited. Dry run unless --apply.
//   node scripts/seedDocumentTemplates.js [--apply]
require('../src/config/environment');
const mongoose = require('mongoose');
const Test = require('../src/models/Test');
const templates = require('../src/assets/document-formats/document-test-templates.json');

(async () => {
  const apply = process.argv.includes('--apply');
  await mongoose.connect(process.env.MONGO_URI);
  let changed = 0;
  for (const [name, template] of Object.entries(templates)) {
    const tests = await Test.find({ name, sourceType: 'Document' });
    if (!tests.length) { console.log(`${name}: not in catalog`); continue; }
    for (const test of tests) {
      if (String(test.documentTemplate || '').trim()) { console.log(`${name}: already has a template, kept`); continue; }
      console.log(`${name}: ${apply ? 'template set' : 'would set template'}`);
      if (apply) await Test.updateOne({ _id: test._id }, { $set: { documentTemplate: template } });
      changed++;
    }
  }
  console.log(`${changed} test(s) ${apply ? 'updated' : 'would be updated (dry run; pass --apply)'}`);
  await mongoose.disconnect();
})().catch(error => { console.error(error); process.exit(1); });
