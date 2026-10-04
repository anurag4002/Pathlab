process.env.NODE_ENV = 'test';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { buildReview, csv } = require('../scripts/generateReferenceDataReview');
const proposals = require('../data/referenceRangeProposals.cjs');
const exported = require('../../frontend/src/data/referenceRangeReview.json');

describe('reference data review is separate from active laboratory data', () => {
  it('preserves custom reference bands, units and parameter formulas without mutating the catalog', () => {
    const original = [{ code:'AMH', name:'Custom AMH', unit:'custom', referenceRange:'Lab approved text', referenceRanges:[{sex:'Female',ageMin:20,ageMax:30,referenceRange:'2 - 9'}], parameters:[{code:'CUSTOM',name:'Measurement',referenceRange:'<20',formula:'[A]*2'}] }];
    const before = JSON.stringify(original);
    const review = buildReview(original);
    assert.equal(JSON.stringify(original), before);
    assert.equal(review.tests[0].existing.referenceRange,'Lab approved text');
    assert.deepEqual(review.tests[0].existing.referenceRanges,original[0].referenceRanges);
    assert.equal(review.tests[0].existing.parameters[0].formula,'[A]*2');
    assert.equal(review.tests[0].currentUnit,'custom');
    assert.equal(review.tests[0].reviewStatus,'Pending lab review');
    assert.equal(review.tests[0].existing.source,'Existing test database');
  });
  it('exports all 210 unique catalog tests and addresses every missing reference entry', () => {
    assert.equal(exported.tests.length,210);
    assert.equal(new Set(exported.tests.map(t=>t.code)).size,210);
    assert.equal(exported.summary.missingReferenceTexts,exported.tests.filter(t=>t.coverage==='Reference text missing').length);
    assert.deepEqual(exported.summary.missingTestsWithoutDisposition,[]);
    for(const test of exported.tests.filter(t=>t.coverage==='Reference text missing')) assert.ok(test.proposal?.notes || test.sourceTestId,test.code);
  });
  it('retains source age boundaries and context instead of guessing continuous age or menopause bands', () => {
    assert.ok(proposals.AMH.rows.some(row=>row.sex==='Male' && row.age==='<2y'));
    assert.ok(proposals.AMH.rows.some(row=>row.sex==='Male' && row.age==='>12y'));
    for(const code of ['FSH','LH','PROGESTERONE','ESTRADIOL']) {
      assert.equal(proposals[code].kind,'Context required');
      assert.ok(proposals[code].rows.some(row=>row.context==='Postmenopausal'||row.context.includes('Postmenopausal')));
    }
  });
  it('keeps sampling and incompatible units visible rather than assigning an invalid numeric normal', () => {
    assert.match(proposals.INSULIN_RANDOM.notes,/RANDOM/);
    assert.match(proposals.ADA.notes,/cumm/);
    assert.match(proposals.DHEA.notes,/DHEA-S/);
    assert.match(proposals.LUPUS_ANTICOAGULANT_.notes,/seconds/);
    assert.match(proposals.URINE_FOR_MICROALBUM.notes,/not a raw albumin/);
  });
  it('does not invent a universal normal for ratios, local Widal titres or ambiguous test identities', () => {
    for(const code of ['NLR','TG_HDL','SGOT_SGPT','WIDAL_TUBE_METHOD','FLUID_EXAMINATION','PH']) assert.deepEqual(proposals[code].rows,[]);
  });
  it('retains explicit units for dimensional conversions', () => {
    assert.equal(proposals.FT4.unit,'pg/mL');
    assert.equal(proposals.FT4.rows[0].range,'9 - 25');
    assert.equal(proposals.TESTOSTERONE_FREE.unit,'pg/mL');
    assert.equal(proposals.TESTOSTERONE_FREE.rows[0].range,'52.5 - 207');
  });
  it('provides a primary source for every external candidate value', () => {
    for(const [code,proposal] of Object.entries(proposals)) if(proposal.rows.length) {
      const url = new URL(proposal.sourceUrl);
      assert.equal(url.protocol,'https:');
      assert.ok(['www.mayocliniclabs.com','ltd.aruplab.com','hematology.testcatalog.org','www.healthcare.uiowa.edu','sfmc.testcatalog.org','mhc.testcatalog.org','kdigo.org'].includes(url.hostname),code);
    }
  });
  it('exports multiline review CSV while neutralizing formula-like catalog names', () => {
    const output=csv(buildReview([{code:'CUSTOM',name:'=HYPERLINK("bad")',referenceRange:'1 - 2\n3 - 4'}]));
    assert.ok(output.startsWith('\uFEFF'));
    assert.ok(output.includes('"\'=HYPERLINK(""bad"")"'));
    assert.ok(output.includes('"1 - 2\n3 - 4"'));
  });
});
