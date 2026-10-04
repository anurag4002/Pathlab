const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');
const { SINGLE_FORMULAS } = require('../src/services/formulaCatalogService');
const { buildResultRows } = require('../src/services/reportCalculationService');

let compileReportFormulas, calculateLocalResults;
before(async () => ({ compileReportFormulas, calculateLocalResults } = await import('../../frontend/src/utils/localReportCalculations.js')));
const field = (code, options = {}) => ({ _id: code, code, name: code, ...options });
const toEntry = (test) => ({ ...test, testId: test._id, testCode: test.code, testName: test.name, resultKey: test._id });

describe('instant frontend formula calculations', () => {
  it('matches backend results for every standalone catalog formula, including chained values', () => {
    const measured = { HB: 7, HCT: 20, TOTAL_RBC_COUNT: 3.11, TLC: 9500, DLC_EOSINOPHILS: 1,
      DLC_NEUTROPHILS: 77, DLC_LYMPHOCYTE: 19, SERUM_UREA: 42.8, SERUM_CREATININE: 1,
      SERUM_PROTEIN: 7, SERUM_ALBUMIN: 4, SERUM_BILIRUBIN_TOTA: 1.2, SERUM_BILIRUBIN_DIRE: 0.4,
      TRIGLYCERIDES: 150, TOTAL_CHOLESTEROL: 250, HDL_CHOLESTEROL: 50, TOTAL_IRON_BINDING_C: 300,
      IRON: 100, SGOT: 40, SGPT: 20 };
    const tests = [...Object.keys(measured).map((code) => field(code)),
      ...Object.entries(SINGLE_FORMULAS).reverse().map(([code, [formula]]) => field(code, { formula, isDerived: true }))];
    const entries = tests.map(toEntry), patient = { age: 53, gender: 'Female' };
    const local = calculateLocalResults(entries, compileReportFormulas(entries), measured, patient);
    const saved = buildResultRows(Object.entries(measured).map(([test, value]) => ({ test, value })), tests, patient);
    assert.deepEqual(local.errors, {});
    assert.equal(Object.keys(local.calculated).length, 22);
    for (const row of saved.results.filter((r) => r.derived)) assert.equal(local.calculated[row.test].value, row.value);
  });

  it('clears dependent values immediately when an input is removed or invalid, ignoring stale derived inputs', () => {
    const entries = [field('X'), field('B', { isDerived: true, formula: '[A] + 1' }),
      field('A', { isDerived: true, formula: '10 / [X]' })].map(toEntry);
    const compiled = compileReportFormulas(entries);
    assert.equal(calculateLocalResults(entries, compiled, { X: 2 }).calculated.B.value, '6');
    for (const X of ['', ' ', 'Positive', 0]) {
      const result = calculateLocalResults(entries, compiled, { X, A: 999, B: 999 });
      assert.deepEqual(result.calculated, {});
      assert.ok(result.errors.A && result.errors.B);
    }
    assert.equal(calculateLocalResults(entries, compiled, { X: 5 }).calculated.B.value, '3');
  });

  it('keeps parameter fields distinct and evaluates punctuation codes, comma inputs and text outputs locally', () => {
    const entries = [
      { testId: 'parent', resultKey: 'parent:CREAT', testCode: 'CREAT', testName: 'Creatinine' },
      { testId: 'parent', resultKey: 'parent:GFR', testCode: 'GFR', isDerived: true, formula: 'ROUND(CKD_EPI_2021([CREAT]), 2)' },
      { testId: 'parent', resultKey: 'parent:CAT', testCode: 'CAT', isDerived: true, formula: 'GFR_CATEGORY([GFR])' },
      { testId: 'WBC', testCode: 'WBC+' },
      { testId: 'ABS', testCode: 'ABS_COUNT', isDerived: true, formula: '[WBC+] / 1000' }
    ];
    const compiled = compileReportFormulas(entries), values = { 'parent:CREAT': 1, WBC: '9,500' };
    const adult = calculateLocalResults(entries, compiled, values, { age: 53, gender: 'Female' });
    assert.equal(adult.calculated['parent:CAT'].value, 'G2');
    assert.equal(adult.calculated.ABS.value, '9.5');
    const child = calculateLocalResults(entries, compiled, values, { age: 120, ageUnit: 'months', gender: 'Female' });
    assert.match(child.errors['parent:GFR'], /adult/);
    assert.equal(child.calculated['parent:CAT'], undefined);
  });

  it('shows configured formula errors without executing arbitrary code', () => {
    const entries = [field('EMPTY', { isDerived: true }),
      field('BAD', { isDerived: true, formula: 'globalThis.alert(1)' }),
      field('LDL', { isDerived: true, formula: 'FRIEDEWALD_LDL(250, 50, 400)' })].map(toEntry);
    const result = calculateLocalResults(entries, compileReportFormulas(entries));
    assert.deepEqual(result.calculated, {});
    assert.match(result.errors.EMPTY, /not configured/);
    assert.ok(result.errors.BAD);
    assert.match(result.errors.LDL, /below 400/);
  });
});
