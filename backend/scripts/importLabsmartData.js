// User-provided source import. Dry run by default; --apply backs up the catalog.
const fs = require('node:fs');
const path = require('node:path');
const mongoose = require('mongoose');
const { isDeepStrictEqual } = require('node:util');
const { MONGO_URI } = require('../src/config/environment');
const Test = require('../src/models/Test');
const TestCategory = require('../src/models/TestCategory');
const Interpretation = require('../src/models/Interpretation');
const { parseBounds } = require('../src/services/referenceRangeService');
const { getResultOptions } = require('../src/services/resultOptionsService');
const { validateFormula } = require('../src/services/formulaExpression');
const { interpretationBlocks } = require('../src/services/interpretationLayout');

const root = path.resolve(__dirname, '../..');
const sourceDirectory = path.join(__dirname, '../data/labsmart');
function loadSource(directory = sourceDirectory) {
  const read = name => JSON.parse(fs.readFileSync(path.join(directory, `labsmart_${name}.json`), 'utf8'));
  return { tests: read('tests_parsed'), fields: read('fields'), ranges: read('ranges_parsed'), interpretations: read('testinterp_formatted'), originalInterpretations: read('testinterp_clean') };
}
const number = value => value == null || String(value).trim() === '' ? null : Number(value);
const key = value => String(value || '').trim().toLowerCase();
function sourceRanges(range) {
  return (range.rows || []).map(row => {
    const low = number(row.lower), high = number(row.upper);
    const text = row.in_words || (low != null && high != null ? `${row.lower} - ${row.upper}` : low != null ? `>= ${row.lower}` : high != null ? `<= ${row.upper}` : '');
    const bounds = parseBounds(text);
    const age = value => {
      const days = number(value);
      return days != null && days > 0 && days % 365 === 0 ? { value: days / 365, unit: 'y' } : { value: days, unit: 'd' };
    };
    const min = age(row.min_age_days), max = age(row.max_age_days);
    return { sex: {any:'Any',F:'Female',M:'Male'}[row.gender], ageMin: min.value, ageMinUnit: min.unit, ageMax: max.value, ageMaxUnit: max.unit,
      referenceRange: text, normalLow: low, normalHigh: high, criticalLow: null, criticalHigh: null,
      lowInclusive: bounds?.normalLow === low ? bounds.lowInclusive ?? true : true,
      highInclusive: bounds?.normalHigh === high ? bounds.highInclusive ?? true : true };
  });
}
const formatBands = bands => bands.map(b => `${b.sex} (age ${b.ageMin ?? ''}${b.ageMinUnit}–${b.ageMax ?? ''}${b.ageMaxUnit}): ${b.referenceRange}`).join('\n');
function fieldValues(field, range) {
  const bands = sourceRanges(range);
  const uniform = bands.length === 1;
  return { sourceFieldId: field.field_id, sourceFieldName: field.field_name, sourceRange: range, name: field.field_name, unit: field.unit,
    referenceAgeDaysPerYear: 365, referenceRanges: bands,
    referenceRange: bands.length ? formatBands(bands) : range.normal_value || '',
    normalLow: uniform ? bands[0].normalLow : null, normalHigh: uniform ? bands[0].normalHigh : null,
    ageMin: null, ageMax: null, sexApplicable: 'Any', maleReferenceRange: '', femaleReferenceRange: '' };
}
const codeFor = (test, field) => `${test.code}_${field.field_name.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '') || field.field_id}`;
function buildImportPlan(source, catalog, categories) {
  const plan = [], used = new Set();
  const aliases = { '5714575': 'PT_INR_CONTROL_PT', '5714576': 'PT_INR_ISI' };
  for (const record of source.tests) {
    const matching = catalog.filter(t => t.sourceTestId === record.labsmart_id || key(t.name) === key(record.name));
    if (matching.length !== 1) throw new Error(`Expected one existing test for ${record.name}; found ${matching.length}`);
    const previous = matching[0];
    const interpretation = source.interpretations[record.labsmart_id];
    const sourceBlocks = interpretationBlocks(interpretation?.text);
    const basisIndex = sourceBlocks.findIndex(block => block.kind === 'heading' && /^physiologic(?:al)? basis$/i.test(block.text));
    const sourceDescription = basisIndex >= 0 && sourceBlocks[basisIndex + 1]?.kind === 'paragraph' ? sourceBlocks[basisIndex + 1].text : '';
    const previousDescription = previous.description?.trim();
    const placeholderDescription = !previousDescription || previousDescription === previous.sourceType || previousDescription === record.test_type
      || /^(?:numeric|text|document|single parameter|multiple parameters?|Migrated from Labsmart\b.*)$/i.test(previousDescription);
    if (used.has(String(previous._id))) throw new Error(`Duplicate source mapping for ${record.name}`);
    used.add(String(previous._id));
    const group = source.fields[record.labsmart_id];
    if (!group || key(group.name) !== key(record.name)) throw new Error(`Missing or mismatched fields for ${record.name}`);
    const category = categories.find(c => key(c.name) === key(record.category));
    if (!category) throw new Error(`Missing category ${record.category}`);
    const imported = { ...previous, name: record.name, sourceTestId: record.labsmart_id, shortName: record.short_name,
      sourceType: record.test_type, displayOrder: Number(record.order), sourceFee: record.fee,
      sourceDefinition: record, category: category._id, description: placeholderDescription ? sourceDescription : previousDescription,
      ...(record.fee != null ? {price: record.fee} : {}), referenceAgeDaysPerYear: 365 };
    const fields = group.fields.map(field => {
      const range = source.ranges[field.field_id];
      if (!range) throw new Error(`Missing range record ${field.field_id}`);
      return {field,values:fieldValues(field,range)};
    });
    if (fields.length === 1) {
      const values = fields[0].values;
      Object.assign(imported, values, {name:record.name, parameters:[]});
      imported.resultOptions = getResultOptions({...imported, referenceRange: source.ranges[fields[0].field.field_id].normal_value || ''});
    } else if (fields.length > 1) {
      imported.parameters = fields.map(({field,values}) => {
        const old = previous.parameters?.find(p => p.sourceFieldId === field.field_id || key(p.name) === key(field.field_name) || p.code === aliases[field.field_id]);
        const parameter = {...old, ...values, code: old?.code || codeFor(previous,field), isDerived: !!old?.isDerived, formula: old?.formula || ''};
        parameter.resultOptions = getResultOptions({...parameter, referenceRange:source.ranges[field.field_id].normal_value || ''});
        if (record.labsmart_id === '3775516') parameter.resultOptions = field.field_name === 'ABO' ? ['A','B','AB','O'] : ['Positive','Negative'];
        else if (['3775520','3775637','3775638','3775643','3775652','3775678'].includes(record.labsmart_id) && !parameter.unit && !parameter.referenceRanges.length) parameter.resultOptions = ['Negative','Positive'];
        else if (key(field.field_name) === 'result' && !parameter.resultOptions.length && !parameter.unit && !parameter.referenceRanges.length && previous.resultOptions?.length && previous.resultOptions.length <= 3) parameter.resultOptions = [...previous.resultOptions];
        return parameter;
      });
      Object.assign(imported, {referenceRange: imported.parameters.map(p=>`${p.name}${p.unit ? ` (${p.unit})` : ''}: ${p.referenceRange}`).join('\n').trim(),
        referenceRanges:[], normalLow:null,normalHigh:null,ageMin:null,ageMax:null,sexApplicable:'Any',maleReferenceRange:'',femaleReferenceRange:'',resultOptions:[],unit:''});
    } else {
      Object.assign(imported,{parameters:[],referenceRange:'',referenceRanges:[],normalLow:null,normalHigh:null,ageMin:null,ageMax:null,maleReferenceRange:'',femaleReferenceRange:'',resultOptions:[],unit:''});
    }
    if (interpretation) {
      if (key(interpretation.name) !== key(record.name)) throw new Error(`Interpretation mismatch for ${record.name}`);
      const priorText = previous.interpretation?.trim();
      const originalText = source.originalInterpretations?.[record.labsmart_id]?.text?.trim();
      if (!priorText || priorText === previous.sourceInterpretation?.text?.trim() || priorText === originalText) imported.interpretation = interpretation.text;
      imported.sourceInterpretation = interpretation;
    }
    plan.push(imported);
  }
  for (const test of plan) {
    const error = validateFormula(test,plan);
    if (error) throw new Error(`${test.code}: ${error}`);
    const schemaError = new Test(test).validateSync();
    if (schemaError) throw schemaError;
  }
  return plan;
}
function importSummary(source, plan) {
  const blankFields = Object.entries(source.fields).flatMap(([id,t])=>t.fields.filter(f=>!source.ranges[f.field_id].rows.length&&!source.ranges[f.field_id].normal_value).map(f=>({test:t.name,field:f.field_name,sourceFieldId:f.field_id,sourceTestId:id})));
  return {tests:plan.length,fields:Object.values(source.fields).reduce((n,t)=>n+t.fields.length,0),multiParameterTests:plan.filter(t=>t.parameters.length).length,
    referenceRows:Object.values(source.ranges).reduce((n,r)=>n+r.rows.length,0),textReferences:Object.values(source.ranges).filter(r=>r.normal_value).length,
    interpretationRecords:Object.keys(source.interpretations).length,
    interpretations:Object.values(source.interpretations).filter(i=>i.text?.trim()).length,
    clinicalDescriptions:plan.filter(t=>t.description?.trim()).length,
    blankInterpretations:Object.values(source.interpretations).filter(i=>!i.text?.trim()).map(i=>i.name),
    formulas:plan.reduce((n,t)=>n+Number(!!t.formula)+t.parameters.filter(p=>p.formula).length,0),
    documentTests:plan.filter(t=>t.sourceType==='Document').map(t=>t.name),blankFields};
}
async function main() {
  const source = loadSource();
  await mongoose.connect(MONGO_URI);
  try {
    const catalog = await Test.find().lean(), categories = await TestCategory.find().lean(), interpretations = await Interpretation.find().lean();
    // These source categories already exist in this catalog; never guess one.
    const plan = buildImportPlan(source,catalog,categories), summary = importSummary(source,plan);
    const changed = plan.filter(t => {
      const old=catalog.find(o=>String(o._id)===String(t._id));
      return Object.keys(t).some(k=>!['_id','createdAt','updatedAt','__v'].includes(k)&&!isDeepStrictEqual(t[k],old[k]));
    });
    if (process.argv.includes('--apply')) {
      const backup = path.join(root,`tmp/formula-audit/labsmart-import-backup-${Date.now()}.json`);
      fs.mkdirSync(path.dirname(backup),{recursive:true});
      fs.writeFileSync(backup,JSON.stringify({catalog,categories,interpretations},null,2));
      if(changed.length) await Test.bulkWrite(changed.map(test=>({updateOne:{filter:{_id:test._id},update:{$set:Object.fromEntries(Object.entries(test).filter(([k])=>!['_id','createdAt','updatedAt','__v'].includes(k)))}}})));
      const referenceUpdates = plan.filter(test => {
        if (!source.interpretations[test.sourceTestId]?.text?.trim()) return false;
        const old = interpretations.find(row => row.sourceTestId === test.sourceTestId && row.resultCondition === 'General reference');
        return !old || !old.interpretationText?.trim() || old.interpretationText.trim() === source.originalInterpretations?.[test.sourceTestId]?.text?.trim()
          || old.interpretationText.trim() === source.interpretations[test.sourceTestId].text.trim();
      });
      if (referenceUpdates.length) await Interpretation.bulkWrite(referenceUpdates.map(test=>({updateOne:{filter:{sourceTestId:test.sourceTestId,resultCondition:'General reference'},update:{$set:{test:test._id,sourceTestId:test.sourceTestId,resultCondition:'General reference',interpretationText:source.interpretations[test.sourceTestId].text,normalAbnormalGuidance:'General',status:'Active'}},upsert:true}})));
      // Repair only empty records created by this importer. Their exact source
      // remains on Test.sourceInterpretation and in the backup written above.
      const emptySourceIds = Object.keys(source.interpretations).filter(id=>!source.interpretations[id].text?.trim());
      await Interpretation.deleteMany({sourceTestId:{$in:emptySourceIds},resultCondition:'General reference',interpretationText:''});
      console.log(`Backup: ${backup}`);
    }
    const audit = {mode:process.argv.includes('--apply')?'Applied':'Dry run',changedTests:changed.length,...summary};
    fs.writeFileSync(path.join(root,`tmp/formula-audit/labsmart-import-${process.argv.includes('--apply')?'audit':'dry-run'}.json`),JSON.stringify(audit,null,2));
    if(process.argv.includes('--apply')) fs.writeFileSync(path.join(root,'docs/labsmart-import-audit.md'),[
      '# User-provided Labsmart import','',`${audit.mode}: ${summary.tests} tests; ${summary.fields} fields; ${summary.multiParameterTests} multi-parameter tests; ${summary.referenceRows} age/sex rows; ${summary.textReferences} text references; ${summary.interpretations} interpretations.`,
      '',`${summary.formulas} existing formulas retained. Test IDs and existing parameter codes are retained, including INR control inputs. Source files contain no formula expressions. Known fees are imported; null fees keep the existing price.`,
      '', `${summary.interpretationRecords} source interpretation records are preserved. ${summary.interpretations} contain text; ${summary.blankInterpretations.join(', ')} have empty source text and do not create blank advice rows.`,
      '', 'All original source files are saved in backend/data/labsmart. Exact day boundaries, numeric limits, display text and original units remain available in sourceRange. The source uses 365 days per year. Whole-year boundaries are displayed in years; other boundaries retain days.',
      '', 'Report, patient and bill records are not modified. Source references left blank remain blank; external review proposals are not substituted.',
      '', `## ${blankFieldsCount(summary)} field references left blank by the source`, '', '| Test | Field | Source ID |','|---|---|---|',...summary.blankFields.map(f=>`| ${f.test.replace(/\|/g,'\\|')} | ${f.field.replace(/\|/g,'\\|')} | ${f.sourceFieldId} |`)
    ].join('\n'));
    console.log(JSON.stringify({...audit,blankFields:summary.blankFields.length},null,2));
  } finally { await mongoose.disconnect(); }
}
const blankFieldsCount = summary => summary.blankFields.length;
if(require.main===module)main().catch(error=>{console.error(error.message);process.exitCode=1;});
module.exports={loadSource,sourceRanges,buildImportPlan,importSummary};
