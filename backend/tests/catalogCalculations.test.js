process.env.NODE_ENV = 'test';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { parseFormula, evaluateFormula, validateFormula } = require('../src/services/formulaExpression');
const { resolveReferenceRange } = require('../src/services/referenceRangeService');
const { evaluateResult } = require('../src/services/formulaService');
const { buildResultRows } = require('../src/services/reportCalculationService');
const { SINGLE_FORMULAS, catalogSetupPlan } = require('../src/services/formulaCatalogService');
const { expandTests, includeFormulaDependencies } = require('../src/services/testDefinitions');
const { getResultOptions } = require('../src/services/resultOptionsService');

describe('stored formula expressions', () => {
  it('handles arithmetic, precedence, decimal precision and punctuation in codes', () => {
    assert.equal(evaluateFormula(parseFormula('ROUND([Na+] - [Cl-] * 2 + 2^3, 1)'), { 'Na+': 140, 'Cl-': 60 }), 28);
    assert.equal(evaluateFormula(parseFormula('-2^2 + 3 * (4 + 1)'), {}), 11);
    assert.equal(evaluateFormula(parseFormula('Hb * 10 / RBC'), { HB: 7, rbc: 3.11 }), 70 / 3.11);
    assert.equal(evaluateFormula(parseFormula('[WBC] / 1000'), { WBC: '9,500' }), 9.5);
  });
  it('rejects executable code, malformed expressions and invalid arithmetic', () => {
    for (const formula of ['process.exit()', 'Math.random()', 'HB; alert(1)', '(HB + 2', 'HB +', '1.2.3']) assert.throws(() => parseFormula(formula));
    assert.throws(() => evaluateFormula(parseFormula('10 / RBC'), { RBC: 0 }), /zero/);
    for (const value of ['', ' ', 'Positive', null]) assert.throws(() => evaluateFormula(parseFormula('[HB]'), { HB: value }));
  });
  it('rejects unknown codes, direct self references and dependency cycles', () => {
    const a = { _id: 'a', code: 'A', isDerived: true, formula: '[B]' }, b = { _id: 'b', code: 'B', isDerived: true, formula: '[A]' };
    assert.match(validateFormula(a, [a, b]), /circular/);
    assert.match(validateFormula({ ...a, formula: '[A]' }, [a, b]), /circular/);
    assert.match(validateFormula({ ...a, formula: '[UNKNOWN]' }, [a, b]), /Unknown/);
  });
});

describe('the full calculation catalog', () => {
  const values = { HB: 7, HCT: 20, TOTAL_RBC_COUNT: 3.11, TLC: 9500, DLC_EOSINOPHILS: 1, DLC_NEUTROPHILS: 77,
    DLC_LYMPHOCYTE: 19, SERUM_UREA: 42.8, BUN: 20, SERUM_CREATININE: 1, SERUM_PROTEIN: 7,
    SERUM_ALBUMIN: 4, SERUM_BILIRUBIN_TOTA: 1.2, SERUM_BILIRUBIN_DIRE: 0.4,
    TRIGLYCERIDES: 150, TOTAL_CHOLESTEROL: 250, HDL_CHOLESTEROL: 50, LDL_CHOLESTEROL: 170,
    TOTAL_IRON_BINDING_C: 300, IRON: 100, SGOT: 40, SGPT: 20, EGFR: 80 };
  const expected = { MCV: 64.3, MCH: 22.5, MCHC: 35, AEC: 95, NLR: 4.05, BUN: 20, BUN_CREATININE_RATIO: 20,
    UREA_CREATININE_RATI: 42.8, GLOBULIN: 3, A_G_RATIO: 1.33, SERUM_BILIRUBIN_INDI: 0.8,
    VLDL_CHOLESTEROL: 30, LDL_CHOLESTEROL: 170, NON_HDL_CHOLESTEROL: 200, TOTAL_CHOLESTEROL_HD: 5,
    LDL_HDL: 3.4, TG_HDL: 3, UIBC: 200, TRANSFERRIN_SATURATI: 33.33, SGOT_SGPT: 2, EGFR_CATEGORY: 'G2' };
  for (const [code, value] of Object.entries(expected)) it(`calculates ${code}`, () => {
    assert.equal(evaluateFormula(parseFormula(SINGLE_FORMULAS[code][0]), values, { age: 53, gender: 'Female' }), value);
  });
  it('uses age and sex for adult eGFR and enforces equation limitations', () => {
    const equation = parseFormula(SINGLE_FORMULAS.EGFR[0]);
    const young = evaluateFormula(equation, values, { age: 40, gender: 'Male' });
    const older = evaluateFormula(equation, values, { age: 70, gender: 'Male' });
    const female = evaluateFormula(equation, values, { age: 40, gender: 'Female' });
    assert.ok(young > older && young > female);
    assert.throws(() => evaluateFormula(equation, values, { age: 10, gender: 'Female' }), /adult/);
    assert.throws(() => evaluateFormula(equation, values, { age: 53, gender: 'Other' }), /sex/);
    assert.throws(() => evaluateFormula(equation, { ...values, SERUM_CREATININE: 0 }, { age: 53, gender: 'Female' }), /zero/);
    const ldl = parseFormula(SINGLE_FORMULAS.LDL_CHOLESTEROL[0]);
    assert.throws(() => evaluateFormula(ldl, { ...values, TRIGLYCERIDES: 400 }), /below 400/);
    assert.throws(() => evaluateFormula(ldl, { ...values, TRIGLYCERIDES: 500 }), /below 400/);
  });
  it('calculates eAG, urine ACR and INR from distinct parameter inputs', () => {
    const catalog = catalogSetupPlan([
      { _id: 'hba1c', code: 'HBA1C_GLYCOSYLATED_H', name: 'HbA1c', description: 'Multi parameter', referenceRange: 'HbA1c (%): < 5.7\nEstimated average glucose (mg/dL): < 116 mg/dl' },
      { _id: 'acr', code: 'MICROALBUMIN_CREATIN', name: 'Urine ACR', description: 'Multi parameter', referenceRange: 'Microalbuminuria (mg/L): 0 - 25\nUrinary creatinine (mg/dL): 28 - 217\nUrinary Albumin Creatinine Ratio (UACR) (mg/g): <30' },
      { _id: 'pt', code: 'PT_INR', name: 'PT/INR', description: 'Multi parameter', referenceRange: 'Patient Value (seconds): 10 - 16.5\nINR Value (%): 1.00-1.30' }
    ]);
    const measured = { HBA1C_GLYCOSYLATED_H_HBA1C: 7, MICROALBUMIN_CREATIN_MICROALBUMINURIA: 30,
      MICROALBUMIN_CREATIN_URINARY_CREATININE: 100, PT_INR_PATIENT_VALUE: 24, PT_INR_CONTROL_PT: 12, PT_INR_ISI: 1 };
    const entries = expandTests(catalog).filter((t) => !t.isDerived).map((t) => ({ test: t._id, parameterCode: t.parameterCode, value: measured[t.code] }));
    const calculated = buildResultRows(entries, catalog).results.filter((r) => r.derived);
    assert.deepEqual(calculated.map((r) => r.value), ['154.2', '30', '2']);
    assert.equal(new Set(calculated.map((r) => `${r.test}:${r.parameterCode}`)).size, 3);
    assert.equal(evaluateFormula(parseFormula('INR([PT], [CONTROL], [ISI])'), { PT: 24, CONTROL: 12, ISI: 1 }), 2);
    assert.throws(() => evaluateFormula(parseFormula('INR(24, 12, -1)'), {}), /greater/);
  });
  it('calculates absolute differential counts in thousands per microlitre', () => {
    const catalog = catalogSetupPlan([{ _id: 'diff', code: 'DIFFERENTIAL_LEUKOCY', name: 'Absolute differential', description: 'Multi parameter', referenceRange:
      'Neutrophils (x10^3/μL): 2 - 7\nLymphocytes (x10^3/μL): 1 - 3\nEosinophils (x10^3/μL): 0.02 - 0.5\nMonocytes (x10^3/μL): 0.1 - 1\nBasophils (x10^3/μL): 0.02 - 0.1' }]);
    const input = { TLC: 10000, DLC_NEUTROPHILS: 50, DLC_LYMPHOCYTE: 40, DLC_EOSINOPHILS: 2, DLC_MONOCYTES: 7, DLC_BASOPHILS: 1 };
    assert.deepEqual(catalog[0].parameters.map((p) => evaluateFormula(parseFormula(p.formula), input)), [5, 4, 0.2, 0.7, 0.1]);
  });
});

describe('patient-specific ranges and report rows', () => {
  const hb = { _id: 'hb', code: 'HB', name: 'Hemoglobin', referenceRange: 'Any (age 0d–21d): 17 - 23\nAny (age 21d–10y): 11.2 - 16.5\nFemale (age 10y–100y): 12 - 15\nMale (age 10y–100y): 13 - 17', normalLow: 13, normalHigh: 17 };
  it('uses neonatal, child, female and male bands from existing data', () => {
    assert.equal(resolveReferenceRange(hb, { age: 7, ageUnit: 'days', gender: 'Female' }).normalLow, 17);
    assert.equal(resolveReferenceRange(hb, { age: 6, ageUnit: 'months', gender: 'Female' }).normalLow, 11.2);
    assert.equal(resolveReferenceRange(hb, { age: 53, gender: 'Female' }).normalLow, 12);
    assert.equal(resolveReferenceRange(hb, { age: 53, gender: 'Male' }).normalLow, 13);
    assert.equal(evaluateResult(12.5, hb, { age: 53, gender: 'Female' }).flag, 'N');
    assert.equal(evaluateResult(12.5, hb, { age: 53, gender: 'Male' }).flag, 'L');
    assert.equal(resolveReferenceRange(hb, { age: 21, ageUnit: 'days', gender: 'Female' }).normalLow, 11.2);
  });
  it('leaves a gap unflagged instead of applying an adult range', () => {
    const test = { referenceRange: 'Any (age 0d–3d): UP TO 10\nAny (age 12mo–100y): 0.2 - 1.2', normalLow: 0.2, normalHigh: 1.2 };
    assert.equal(resolveReferenceRange(test, { age: 2, ageUnit: 'months', gender: 'Male' }).rangeMissing, true);
    assert.equal(evaluateResult(5, test, { age: 2, ageUnit: 'months', gender: 'Male' }).flag, '');
  });
  it('selects structured ranges for measured and calculated parameters independently', () => {
    const tests = expandTests([{ _id: 'pair', code: 'PAIR', name: 'Pair', referenceRanges: [{ sex: 'Any', referenceRange: '999 - 1000' }],
      parameters: [{ code: 'A', name: 'A', referenceRanges: [
        { sex: 'Any', ageMin: 0, ageMinUnit: 'd', ageMax: 12, ageMaxUnit: 'mo', referenceRange: '1 - 5' },
        { sex: 'Male', ageMin: 1, ageMinUnit: 'y', ageMax: 100, ageMaxUnit: 'y', referenceRange: '6 - 10' },
        { sex: 'Female', ageMin: 1, ageMinUnit: 'y', ageMax: 100, ageMaxUnit: 'y', referenceRange: '5 - 9' }
      ] }, { code: 'B', name: 'B', isDerived: true, formula: '[A] * 2', femaleReferenceRange: '10 - 18', maleReferenceRange: '12 - 20' }] }]);
    assert.equal(resolveReferenceRange(tests[0], { age: 6, ageUnit: 'months', gender: 'Male' }).referenceRange, '1 - 5');
    assert.equal(resolveReferenceRange(tests[0], { age: 20, gender: 'Female' }).referenceRange, '5 - 9');
    assert.equal(resolveReferenceRange(tests[1], { age: 20, gender: 'Male' }).referenceRange, '12 - 20');
  });
  it('does not display a default range outside its age or sex applicability', () => {
    const test = { ageMin: 18, ageMax: 60, sexApplicable: 'Female', referenceRange: '1 - 5' };
    assert.equal(resolveReferenceRange(test, { age: 240, ageUnit: 'months', gender: 'Female' }).referenceRange, '1 - 5');
    assert.equal(resolveReferenceRange(test, { age: 17, gender: 'Female' }).rangeMissing, true);
    assert.equal(resolveReferenceRange(test, { age: 20, gender: 'Male' }).normalHigh, null);
  });
  it('respects strict inequality ranges and ignores nonnumeric interpretations', () => {
    assert.equal(evaluateResult(200, { referenceRange: '< 200' }, {}).flag, 'H');
    assert.equal(evaluateResult(200, { referenceRange: '<= 200' }, {}).flag, 'N');
    assert.equal(evaluateResult(1, { referenceRange: 'Negative' }, {}).flag, 'N');
  });
  it('uses stored formulas, resolves chains and ignores injected calculated values', () => {
    const tests = [hb, { _id: 'b', code: 'B', name: 'B', isDerived: true, formula: '[A] + 1' },
      { _id: 'a', code: 'A', name: 'A', isDerived: true, formula: '[HB] * 2', referenceRange: '0 - 10' }];
    const output = buildResultRows([{ test: 'hb', value: 7 }, { test: 'a', value: 999 }], tests, { age: 53, gender: 'Female' });
    assert.equal(output.results.find((r) => r.test === 'a').value, '14');
    assert.equal(output.results.find((r) => r.test === 'a').flag, 'H');
    assert.equal(output.results.find((r) => r.test === 'b').value, '15');
    assert.equal(output.results.find((r) => r.test === 'hb').referenceRange, '12 - 15');
    assert.equal(output.skipped.length, 0);
    assert.equal(buildResultRows([], tests).results.length, 0);
  });
  it('adds required dependencies without adding unrelated catalog tests', () => {
    const a = { _id: 'a', code: 'A', isDerived: true, formula: '[HB] * 2' };
    const catalog = [a, hb, { _id: 'other', code: 'OTHER' }];
    assert.deepEqual(includeFormulaDependencies([a], catalog).map((t) => t._id), ['a', 'hb']);
  });
  it('keeps name-only qualitative results saveable', () => {
    assert.equal(buildResultRows([{ testName: 'External qualitative result', value: 'Negative' }], []).results[0].value, 'Negative');
  });
});

describe('qualitative result choices', () => {
  it('offers choices for qualitative references while keeping numeric entry', () => {
    assert.deepEqual(getResultOptions({ referenceRange: 'Negative' }), ['Negative', 'Positive']);
    assert.deepEqual(getResultOptions({ referenceRange: 'Non-Reactive' }), ['Non-reactive', 'Reactive']);
    assert.deepEqual(getResultOptions({ referenceRange: 'Absent' }), ['Absent', 'Present']);
    assert.deepEqual(getResultOptions({ referenceRange: '12 - 15' }), []);
    assert.deepEqual(getResultOptions({ resultOptions: ['Detected', 'Not detected'], referenceRange: 'Negative' }), ['Detected', 'Not detected']);
  });
});
