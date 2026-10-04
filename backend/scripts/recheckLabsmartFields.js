// Read-only comparison of the live catalog against the user-provided source.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { isDeepStrictEqual } = require('node:util');
const mongoose = require('mongoose');
const { MONGO_URI } = require('../src/config/environment');
const Test = require('../src/models/Test');
const { loadSource, sourceRanges } = require('./importLabsmartData');
const { expandTests, resultKey } = require('../src/services/testDefinitions');
const { resolveReferenceRange } = require('../src/services/referenceRangeService');
const { validateFormula } = require('../src/services/formulaExpression');

function auditFields(source, catalog) {
  const mismatches = [], checkedFields = [];
  let ageGenderChecks = 0;
  const check = (condition, test, field, property) => {
    if (!condition) mismatches.push({ test, field, property });
  };
  for (const record of source.tests) {
    const matches = catalog.filter(t => t.sourceTestId === record.labsmart_id);
    check(matches.length === 1, record.name, '', 'test identity');
    if (matches.length !== 1) continue;
    const test = matches[0], fields = source.fields[record.labsmart_id].fields;
    check(test.name === record.name, record.name, '', 'test name');
    check(test.sourceType === record.test_type, record.name, '', 'test type');
    check(test.displayOrder === Number(record.order), record.name, '', 'test order');
    check(!validateFormula(test,catalog), record.name, '', 'formula dependencies');
    const definitions = expandTests([test]);
    check(definitions.length === (fields.length || 1), record.name, '', 'field count');
    fields.forEach((field, index) => {
      const definition = definitions[index], range = source.ranges[field.field_id];
      if (!definition) return;
      const label = definition.parameterCode ? definition.name.slice(definition.parentName.length + 2) : definition.name;
      check(definition.sourceFieldId === field.field_id, record.name, field.field_name, 'field identity / order');
      check(label === field.field_name, record.name, field.field_name, 'field label');
      check(definition.unit === field.unit, record.name, field.field_name, 'unit');
      check(isDeepStrictEqual(definition.sourceRange,range), record.name, field.field_name, 'raw source range');
      check(isDeepStrictEqual(definition.referenceRanges,sourceRanges(range)), record.name, field.field_name, 'age / sex bands');
      const days = new Set([0,1,365,3650,19345,36500,36865]);
      range.rows.forEach(row => [row.min_age_days,row.max_age_days].forEach(value => {
        if (value !== '' && value != null) [-1,0,1].forEach(delta => days.add(Math.max(0,Number(value)+delta)));
      }));
      if (range.rows.length) for (const age of days) for (const gender of ['Male','Female','Other']) {
        const matching = range.rows.filter(r => (r.gender === 'any' || r.gender === gender[0])
          && (r.min_age_days === '' || r.min_age_days == null || age >= Number(r.min_age_days))
          && (r.max_age_days === '' || r.max_age_days == null || age <= Number(r.max_age_days)))
          .sort((a,b) => (a.gender === 'any' ? 1 : 0)-(b.gender === 'any' ? 1 : 0)
            || Number(b.min_age_days || 0)-Number(a.min_age_days || 0)
            || (Number(a.max_age_days || Infinity)-Number(a.min_age_days || 0))-(Number(b.max_age_days || Infinity)-Number(b.min_age_days || 0)));
        const selected = resolveReferenceRange(definition,{age,ageUnit:'days',gender});
        ageGenderChecks++;
        check(matching.length ? selected.referenceRange === (matching[0].in_words || sourceRanges({rows:[matching[0]]})[0].referenceRange)
          : selected.rangeMissing === true,record.name,field.field_name,`range selection (${age}d / ${gender})`);
      }
      checkedFields.push({test:record.name,field:field.field_name,sourceFieldId:field.field_id,
        resultKey:resultKey(test._id,definition.parameterCode),unit:definition.unit,
        resultOptions:definition.resultOptions || [],formula:definition.formula || '',referenceRows:range.rows.length});
    });
  }
  check(new Set(checkedFields.map(f=>f.resultKey)).size === checkedFields.length,'Catalog','','unique result keys');
  return {tests:source.tests.length,fields:checkedFields.length,ageGenderChecks,
    formulas:checkedFields.filter(f=>f.formula).length,mismatches,checkedFields};
}

async function main() {
  await mongoose.connect(MONGO_URI);
  try {
    const audit = auditFields(loadSource(),await Test.find().lean());
    const original = process.argv.find(arg=>arg.startsWith('--original='))?.slice('--original='.length);
    if (original) audit.sourceFiles = ['fields','ranges_parsed','tests_parsed','testinterp_clean'].map(name=>{
      const file = `labsmart_${name}.json`, imported = path.join(__dirname,'../data/labsmart',file);
      const digest = filename => crypto.createHash('sha256').update(fs.readFileSync(filename)).digest('hex');
      const identical = digest(imported) === digest(path.join(original,file));
      if (!identical) audit.mismatches.push({file,property:'original source file differs'});
      return {file,identical};
    });
    const output = path.join(__dirname,'../../tmp/formula-audit/labsmart-field-recheck.json');
    fs.mkdirSync(path.dirname(output),{recursive:true});
    fs.writeFileSync(output,JSON.stringify(audit,null,2));
    console.log(JSON.stringify({...audit,checkedFields:undefined},null,2));
    if(audit.mismatches.length) process.exitCode = 1;
  } finally { await mongoose.disconnect(); }
}
if(require.main===module)main().catch(error=>{console.error(error.message);process.exitCode=1;});
module.exports={auditFields};
