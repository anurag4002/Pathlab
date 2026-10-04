// Idempotent catalog setup: preserves custom formulas and all existing ranges.
// Defaults to a dry run. --apply writes only calculation/parameter metadata.
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { MONGO_URI } = require('../src/config/environment');
const Test = require('../src/models/Test');
const { catalogSetupPlan } = require('../src/services/formulaCatalogService');
const { validateFormula } = require('../src/services/formulaExpression');
const { expandTests } = require('../src/services/testDefinitions');
const { parseAgeRanges } = require('../src/services/referenceRangeService');

async function main() {
  await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 10000 });
  try {
    const catalog = await Test.find().sort({ name: 1 }).lean();
    const plan = catalogSetupPlan(catalog);
    for (const test of plan) {
      const error = validateFormula(test, plan);
      if (error) throw new Error(`${test.code}: ${error}`);
    }
    const config = (test) => ({ isDerived: !!test.isDerived, formula: test.formula || '', parameters: test.parameters || [], unit: test.unit || '', resultOptions: test.resultOptions || [] });
    const changes = plan.filter((test, index) => JSON.stringify(config(test)) !== JSON.stringify(config(catalog[index])));
    const definitions = expandTests(plan);
    const directory = path.resolve(__dirname, '../../tmp/formula-audit');
    fs.mkdirSync(directory, { recursive: true });
    const audit = plan.map((test) => ({ code: test.code, name: test.name,
      ageSexBands: test.referenceRanges?.length || parseAgeRanges(test.referenceRange).length,
      calculations: expandTests([test]).filter((t) => t.isDerived).map((t) => ({ code: t.code, formula: t.formula, unit: t.unit })),
      disposition: test.isDerived || test.parameters.some((p) => p.isDerived) ? 'Calculated / includes calculated parameters' : 'Measured / entered / document' }));
    fs.writeFileSync(path.join(directory, 'audit.json'), JSON.stringify(audit, null, 2));
    const summary = { catalogTests: catalog.length, calculatedValues: definitions.filter((t) => t.isDerived).length,
      standaloneCalculations: plan.filter((t) => t.isDerived).length, multiParameterTests: plan.filter((t) => t.parameters.length).length,
      ageSexTests: audit.filter((t) => t.ageSexBands > 0).length, qualitativeDropdowns: definitions.filter((t) => t.resultOptions?.length).length, changedTests: changes.length, applied: false };
    if (process.argv.includes('--apply') && changes.length) {
      const backup = path.join(directory, `catalog-before-setup-${Date.now()}.json`);
      fs.writeFileSync(backup, JSON.stringify(catalog, null, 2), { flag: 'wx' });
      await Test.bulkWrite(changes.map((test) => ({ updateOne: { filter: { _id: test._id }, update: { $set: config(test) } } })));
      summary.applied = true;
      summary.backup = backup;
    }
    console.log(JSON.stringify(summary, null, 2));
  } finally { await mongoose.disconnect(); }
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
