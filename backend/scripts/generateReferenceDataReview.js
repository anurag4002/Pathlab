// Read-only review export. Never updates Test documents or patient reports.
const fs = require('node:fs');
const path = require('node:path');
const mongoose = require('mongoose');
const { MONGO_URI } = require('../src/config/environment');
const Test = require('../src/models/Test');
const proposals = require('../data/referenceRangeProposals.cjs');
const { parseAgeRanges } = require('../src/services/referenceRangeService');

function buildReview(catalog) {
  const tests = catalog.map((test) => {
    const bands = test.referenceRanges?.length ? test.referenceRanges : parseAgeRanges(test.referenceRange);
    const proposal = proposals[test.code] || null;
    const hasRange = test.parameters?.length ? test.parameters.some(p => p.referenceRange?.trim() || p.referenceRanges?.length) : Boolean(test.referenceRange?.trim() || test.maleReferenceRange?.trim() || test.femaleReferenceRange?.trim() || bands.length);
    return { code: test.code, name: test.name, currentUnit: test.unit || '', sourceTestId: test.sourceTestId || '',
      existing: { referenceRange: test.referenceRange || '', maleReferenceRange: test.maleReferenceRange || '', femaleReferenceRange: test.femaleReferenceRange || '',
        referenceRanges: bands, parameters: (test.parameters || []).map(p => ({code:p.code,name:p.name,unit:p.unit,referenceRange:p.referenceRange,referenceRanges:p.referenceRanges||[],formula:p.formula||''})),
        formula: test.formula || '', source: test.sourceTestId ? 'User-provided Labsmart files' : 'Existing test database' },
      coverage: hasRange ? bands.length ? 'Existing age / sex bands' : 'Existing reference; age coverage needs lab validation' : 'Reference text missing',
      reviewStatus: test.sourceTestId ? proposal ? 'User source imported; external proposal pending review' : 'User source imported' : proposal ? 'Pending lab review' : 'Existing data retained',
      proposal,
      reviewNotes: test.code === 'PRL' ? 'Existing female interval 34–386 is stored with ng/mL. Verify the original unit and assay before treating this as a universal female interval.' : !hasRange ? 'No existing reference is configured. Review the proposal or lab configuration decision before adding approved reference data.' : bands.length ? 'Existing bands are retained; check gaps and source age boundaries in the range audit.' : test.parameters?.length ? 'Existing parameter references are retained. Check age, sex and assay applicability for each parameter.' : 'A single existing interval does not establish pediatric, pregnancy or method-specific coverage. Retain it as the lab source; validate applicability before extending it.'
    };
  });
  return { generatedAt: new Date().toISOString(), version: 1, mode: 'Review only; not active clinical reference data',
    summary: { catalogTests: tests.length, existingAgeSexTests: tests.filter(t=>t.existing.referenceRanges.length).length,
      missingReferenceTexts: tests.filter(t=>t.coverage==='Reference text missing').length,
      testsWithProposals: tests.filter(t=>t.proposal).length,
      proposedRows: tests.reduce((sum,t)=>sum+(t.proposal?.rows.length||0),0),
      sourceImportedTests: tests.filter(t=>t.sourceTestId).length,
      missingTestsWithoutDisposition: tests.filter(t=>t.coverage==='Reference text missing' && !t.proposal && !t.sourceTestId).map(t=>t.code) }, tests };
}
function csv(review) {
  const quote = (v) => {
    const text = String(v ?? '');
    return `"${(/^[=+@\-\t\r]/.test(text) ? "'" + text : text).replace(/"/g,'""')}"`;
  };
  const headers = ['Code','Test','Current unit','Existing reference','Coverage','Review status','Proposal kind','Proposed unit','Proposed sex / age / context / range','Source','Lab review notes'];
  return '\uFEFF' + [headers, ...review.tests.map(t => [t.code,t.name,t.currentUnit,
    t.existing.referenceRange || [t.existing.maleReferenceRange,t.existing.femaleReferenceRange].filter(Boolean).join('\n'),t.coverage,t.reviewStatus,
    t.proposal?.kind,t.proposal?.unit,t.proposal?.rows.map(r=>`${r.sex}; ${r.age}; ${r.context}; ${r.range}`).join('\n'),
    t.proposal?.sourceUrl || 'Existing test database', [t.proposal?.notes,t.reviewNotes].filter(Boolean).join('\n')])].map(row=>row.map(quote).join(',')).join('\r\n');
}
async function main() {
  const root = path.resolve(__dirname,'../..');
  const index = process.argv.indexOf('--catalog');
  let catalog;
  if (index >= 0) catalog = JSON.parse(fs.readFileSync(path.resolve(process.argv[index+1]),'utf8'));
  else { await mongoose.connect(MONGO_URI,{serverSelectionTimeoutMS:10000}); try { catalog=await Test.find().sort({name:1}).lean(); } finally {await mongoose.disconnect();} }
  const review=buildReview(catalog);
  if (review.summary.missingTestsWithoutDisposition.length) throw new Error(`Missing review dispositions: ${review.summary.missingTestsWithoutDisposition.join(', ')}`);
  const destination=path.join(root,'frontend/src/data'); fs.mkdirSync(destination,{recursive:true});
  fs.writeFileSync(path.join(destination,'referenceRangeReview.json'),JSON.stringify(review,null,2));
  fs.writeFileSync(path.join(root,'docs/reference-data-review.csv'),csv(review));
  const cell=(v)=>String(v||'—').replace(/\|/g,'\\|').replace(/\r?\n/g,'<br>');
  const overview = ['# Reference data review — all catalog tests','',
    `Generated ${review.generatedAt}. **Review only: no new external reference values have been activated.**`, '',
    `${review.summary.catalogTests} tests audited; ${review.summary.missingReferenceTexts} missing reference texts have individual review dispositions; ${review.summary.testsWithProposals} tests have proposals or explicit configuration decisions, containing ${review.summary.proposedRows} candidate rows.`, '',
    'The existing test database remains the primary source. External values are candidates for assay, unit, specimen and clinical-context review. Some tests need narrative findings or local decision limits rather than a numeric normal range. A blank candidate is intentional when the test identity or laboratory SOP is required.', '',
    'Age labels preserve source boundaries. Do not convert completed-year labels to continuous age bands, infer menopause/pregnancy/Tanner stage from age, or combine overlapping adult and pediatric values without reviewing the source. Critical limits remain those of the lab; none are invented here.', '',
    'Open **Review reference data** on `/lab/normal-ranges` to compare each proposal with the database. The CSV contains all catalog tests. Use the existing range editor to enter lab-approved bands.', '',
    '| Code | Test | Existing data | Proposal / decision | Source |', '|---|---|---|---|---|',
    ...review.tests.map(t=>`| ${cell(t.code)} | ${cell(t.name)} | ${cell(t.coverage)} | ${cell(t.proposal?.kind || 'Retain existing data')} | ${t.proposal?.sourceUrl ? `[Source](${t.proposal.sourceUrl})` : 'Existing database / lab SOP'} |`), '',
    '## Candidate values and review decisions', '',
    ...review.tests.filter(t=>t.proposal).flatMap(t=>[ `### ${t.name} (${t.code})`, '',
      `Existing unit: ${t.currentUnit||'not configured'}. Proposed unit: ${t.proposal.unit||'qualitative / to be specified'}.`, '',t.proposal.notes,'',
      ...(t.proposal.sourceUrl?[`Source: [reference entry](${t.proposal.sourceUrl}).`,'']:[]),
      ...(t.proposal.rows.length?['| Sex | Age / scope | Context | Candidate |','|---|---|---|---|', ...t.proposal.rows.map(r=>`| ${cell(r.sex)} | ${cell(r.age)} | ${cell(r.context)} | ${cell(r.range)} |`),'']:[]) ]) ];
  fs.writeFileSync(path.join(root,'docs/reference-data-review.md'),overview.join('\n'));
  console.log(JSON.stringify(review.summary,null,2));
}
if(require.main===module)main().catch(error=>{console.error(error.message);process.exitCode=1;});
module.exports={buildReview,csv};
