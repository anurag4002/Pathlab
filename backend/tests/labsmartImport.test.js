process.env.NODE_ENV = 'test';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { loadSource, buildImportPlan, sourceRanges, importSummary } = require('../scripts/importLabsmartData');
const { resolveReferenceRange } = require('../src/services/referenceRangeService');
const { expandTests, orderTestsBySource } = require('../src/services/testDefinitions');
const { buildResultRows } = require('../src/services/reportCalculationService');
const { auditFields } = require('../scripts/recheckLabsmartFields');
const source = loadSource();
const categories = [...new Set(source.tests.map(t=>t.category))].map(name=>({_id:new mongoose.Types.ObjectId(),name}));
const catalog = source.tests.map(t=>({_id:new mongoose.Types.ObjectId(),name:t.name,code:`T_${t.labsmart_id}`,category:categories.find(c=>c.name===t.category)._id,sampleType:'Serum',price:123,status:'Active',parameters:[],formula:'',resultOptions:[]}));
const plan = buildImportPlan(source,catalog,categories);

describe('user-provided Labsmart data import',()=>{
  it('checks every source field and all supplied age/sex boundaries independently',()=>{
    const audit=auditFields(source,plan);
    assert.equal(audit.fields,307);
    assert.ok(audit.ageGenderChecks > 4000);
    assert.deepEqual(audit.mismatches,[]);
    const changed=plan.map(t=>({...t}));
    changed.find(t=>t.sourceFieldId).unit='incorrect unit';
    assert.ok(auditFields(source,changed).mismatches.some(m=>m.property==='unit'));
  });
  it('maps all 210 tests and 307 fields without changing existing identities or input objects',()=>{
    assert.equal(plan.length,210);
    assert.equal(plan.filter(t=>t.parameters.length).length,26);
    const definitions = expandTests(plan).filter(t=>t.sourceFieldId);
    assert.equal(definitions.length,307);
    for(const test of plan) assert.equal(test._id,catalog.find(t=>t.name===test.name)._id);
    for(const field of Object.values(source.fields).flatMap(t=>t.fields)) {
      const mapped=definitions.find(t=>t.sourceFieldId===field.field_id);
      assert.ok(mapped,field.field_id);
      assert.equal(mapped.unit,field.unit);
      assert.equal(mapped.parameterCode ? mapped.name.slice(mapped.parentName.length + 2) : mapped.name,field.field_name);
      assert.deepEqual(mapped.sourceRange,source.ranges[field.field_id]);
    }
    const before=JSON.stringify(catalog);
    buildImportPlan(source,catalog,categories);
    assert.equal(JSON.stringify(catalog),before);
  });
  it('retains exact numeric limits and in-words text even when the source differs',()=>{
    const test=plan.find(t=>t.name==='Blood Sugar PP');
    assert.equal(test.referenceRanges[0].normalHigh,140);
    assert.equal(test.referenceRanges[0].referenceRange,'< 180 mg/dl');
    assert.equal(test.referenceRanges[0].highInclusive,true);
    const bilirubin=plan.find(t=>t.name==='Serum Bilirubin (Total)');
    assert.equal(bilirubin.referenceRanges[0].referenceRange,'UP TO 10');
    assert.equal(bilirubin.referenceRanges[0].normalLow,1.5);
    assert.equal(bilirubin.referenceRanges[0].normalHigh,12);
  });
  it('selects supplied patient age and sex bands at boundaries using the source day convention',()=>{
    const hb=plan.find(t=>t.name==='Hemoglobin');
    assert.equal(resolveReferenceRange(hb,{age:20,ageUnit:'days',gender:'Female'}).referenceRange,'17 - 23');
    assert.equal(resolveReferenceRange(hb,{age:21,ageUnit:'days',gender:'Female'}).referenceRange,'11.2 - 16.5');
    assert.equal(resolveReferenceRange(hb,{age:10,ageUnit:'years',gender:'Male'}).referenceRange,'13 - 17');
    assert.equal(resolveReferenceRange(hb,{age:100,ageUnit:'years',gender:'Female'}).referenceRange,'12 - 15');
    assert.equal(resolveReferenceRange(hb,{age:101,ageUnit:'years',gender:'Female'}).rangeMissing,true);
    const bili=plan.find(t=>t.name==='Serum Bilirubin (Total)');
    assert.equal(resolveReferenceRange(bili,{age:2,ageUnit:'days',gender:'Male'}).referenceRange,'UP TO 10');
    assert.equal(resolveReferenceRange(bili,{age:12,ageUnit:'months',gender:'Male'}).referenceRange,'0.2 - 1.2');
  });
  it('retains source strict limits and separates qualitative fields from numeric entries',()=>{
    const dlc=plan.find(t=>t.name==='Differential Leucocyte Count');
    const baso=resolveReferenceRange(dlc.parameters.find(p=>p.name==='Basophils'),{age:53,gender:'Female'});
    assert.equal(baso.highInclusive,false);
    const urine=plan.find(t=>t.name==='Urine Routine Examination');
    assert.deepEqual(urine.parameters.find(p=>p.name==='Colour').resultOptions,['Pale Yellow','Yellow','Dark Yellow','Colourless','Red']);
    assert.deepEqual(urine.parameters.find(p=>p.name==='Sugar / Glucose').resultOptions,['Absent','Present']);
    const group=plan.find(t=>t.name==='Blood Group & Rh.');
    assert.deepEqual(group.parameters.find(p=>p.name==='ABO').resultOptions,['A','B','AB','O']);
    assert.deepEqual(group.parameters.find(p=>p.name==='Rh (ANTI -D)').resultOptions,['Positive','Negative']);
  });
  it('retains all 81 interpretation texts, known fees, null-fee prices and source field order',()=>{
    for(const [id,interpretation] of Object.entries(source.interpretations)) assert.equal(plan.find(t=>t.sourceTestId===id).interpretation,interpretation.text);
    for(const test of plan) {
      const record=source.tests.find(r=>r.labsmart_id===test.sourceTestId);
      assert.equal(test.price,record.fee??123);
      assert.equal(test.displayOrder,Number(record.order));
      if(test.parameters.length) assert.deepEqual(test.parameters.map(p=>p.name),source.fields[test.sourceTestId].fields.map(f=>f.field_name));
    }
  });
  it('preserves existing formulas and INR variable codes when source names differ',()=>{
    const custom=catalog.map(t=>({...t,parameters:[]}));
    const pt=custom.find(t=>t.name==='Prothrombin time, PT/INR'); pt.code='PT_INR';
    pt.parameters=[{code:'PT_INR_CONTROL_PT',name:'Control PT (MNPT)'},{code:'PT_INR_ISI',name:'Reagent ISI'},
      {code:'PT_INR_PATIENT_VALUE',name:'Patient Value'},{code:'PT_INR_INR_VALUE',name:'INR Value',isDerived:true,formula:'ROUND(INR([PT_INR_PATIENT_VALUE], [PT_INR_CONTROL_PT], [PT_INR_ISI]), 2)'}];
    const mcv=custom.find(t=>t.name==='Mean Corpuscular Volume, MCV');mcv.formula='ROUND(10 / 2, 1)';mcv.isDerived=true;
    const imported=buildImportPlan(source,custom,categories);
    assert.equal(imported.find(t=>t.code==='PT_INR').parameters.find(p=>p.name==='Control Value').code,'PT_INR_CONTROL_PT');
    assert.equal(imported.find(t=>t.code==='PT_INR').parameters.find(p=>p.name.startsWith('ISI')).code,'PT_INR_ISI');
    assert.equal(imported.find(t=>t.name===mcv.name).formula,mcv.formula);
  });
  it('keeps specimen inputs separate from qualitative result dropdowns on reimport',()=>{
    const previous=catalog.map(t=>({...t}));
    const afb=previous.find(t=>t.name==='Acid - Fast Bacilli');
    afb.resultOptions=['Negative','Positive'];
    afb.parameters=[{code:'AFB_SAMPLE',name:'Sample Type',resultOptions:['Negative','Positive']},
      {code:'AFB_RESULT',name:'Result',resultOptions:['Negative','Positive']}];
    const imported=buildImportPlan(source,previous,categories).find(t=>t.name===afb.name);
    assert.deepEqual(imported.parameters.find(p=>p.name==='Sample Type').resultOptions,[]);
    assert.deepEqual(imported.parameters.find(p=>p.name==='Result').resultOptions,['Negative','Positive']);
  });
  it('preserves all 145 blank source references and seven narrative document tests',()=>{
    const summary=importSummary(source,plan);
    assert.equal(summary.blankFields.length,145);
    assert.equal(summary.referenceRows,203);
    assert.equal(summary.documentTests.length,7);
    assert.equal(summary.interpretationRecords,81);
    assert.equal(summary.interpretations,79);
    const definitions=expandTests(plan);
    for(const blank of summary.blankFields) {
      const field=definitions.find(t=>t.sourceFieldId===blank.sourceFieldId);
      assert.equal(field.referenceRange,'');
      assert.equal(field.referenceRanges.length,0);
      assert.equal(field.normalLow,null);
      assert.equal(field.normalHigh,null);
    }
  });
  it('uses source test and parameter order for entry and saved reports including derived rows',()=>{
    const hb=plan.find(t=>t.name==='Hemoglobin'), pt=plan.find(t=>t.name==='Prothrombin time, PT/INR');
    assert.equal(orderTestsBySource([pt,hb])[0],hb);
    const entries=[...pt.parameters].reverse().map(p=>({test:pt._id,parameterCode:p.code,value:'1'}));
    entries.push({test:hb._id,value:'13'});
    const rows=buildResultRows(entries,[pt,hb],{age:53,gender:'Female'}).results;
    assert.equal(String(rows[0].test),String(hb._id));
    assert.deepEqual(rows.slice(1).map(r=>r.parameterCode),pt.parameters.map(p=>p.code));
  });
  it('fails on ambiguous identity matches or missing range data before applying changes',()=>{
    assert.throws(()=>buildImportPlan(source,[...catalog,catalog[0]],categories),/Expected one existing test/);
    const bad={...source,ranges:{...source.ranges}};delete bad.ranges[source.fields[source.tests[0].labsmart_id].fields[0].field_id];
    assert.throws(()=>buildImportPlan(bad,catalog,categories),/Missing range record/);
  });
});
