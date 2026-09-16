// Tests for backend/src/services/formulaService.js
// Covers: derive() MCV/MCH/MCHC math, eGFR sane range, LDL Friedewald null
// when TG>400, alias matching, missing-input skips, no recompute of
// already-present codes; evaluateResult() L/H/C flags, critical priority,
// age/sex restriction flags.
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/purepathlab-test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { derive, evaluateResult } = require('../src/services/formulaService');

function derivedMap(result) {
  return new Map(result.derived.map((d) => [d.testCode, d.value]));
}

describe('formulaService derive() red-cell indices', () => {
  it('computes MCV = HCT*10/RBC', () => {
    const r = derive({ HCT: 45, RBC: 5 }, {});
    assert.ok(r.applied.includes('MCV'));
    assert.equal(derivedMap(r).get('MCV'), 90);
  });

  it('computes MCH = Hb*10/RBC', () => {
    const r = derive({ Hb: 15, RBC: 5 }, {});
    assert.ok(r.applied.includes('MCH'));
    assert.equal(derivedMap(r).get('MCH'), 30);
  });

  it('computes MCHC = Hb*100/HCT', () => {
    const r = derive({ Hb: 15, HCT: 45 }, {});
    assert.ok(r.applied.includes('MCHC'));
    assert.equal(derivedMap(r).get('MCHC'), 33.33);
  });
});

describe('formulaService derive() eGFR', () => {
  it('produces a sane eGFR for a healthy adult male', () => {
    const r = derive({ creatinine: 1.0 }, { age: 40, gender: 'Male' });
    assert.ok(r.applied.includes('EGFR'), 'EGFR should be computed');
    const v = derivedMap(r).get('EGFR');
    assert.ok(v > 30 && v < 150, `eGFR ${v} out of sane range`);
  });

  it('produces a sane eGFR for a healthy adult female', () => {
    const r = derive({ creatinine: 0.9 }, { age: 35, gender: 'Female' });
    assert.ok(r.applied.includes('EGFR'));
    const v = derivedMap(r).get('EGFR');
    assert.ok(v > 30 && v < 150, `eGFR ${v} out of sane range`);
  });
});

describe('formulaService derive() LDL Friedewald', () => {
  it('returns null (skips LDL_CALC) when TG > 400', () => {
    const r = derive({ 'total cholesterol': 250, hdl: 50, tg: 500 }, {});
    assert.ok(!r.applied.includes('LDL_CALC'), 'LDL_CALC must not be computed when TG>400');
    const skip = r.skipped.find((s) => s.code === 'LDL_CALC');
    assert.ok(skip, 'LDL_CALC should appear in skipped');
    assert.equal(skip.reason, 'not-computable');
  });

  it('computes LDL when TG is within range', () => {
    const r = derive({ 'total cholesterol': 250, hdl: 50, tg: 150 }, {});
    assert.ok(r.applied.includes('LDL_CALC'));
    assert.equal(derivedMap(r).get('LDL_CALC'), 170);
  });
});

describe('formulaService derive() aliasing and skipping', () => {
  it('matches aliases case-insensitively (haemoglobin vs Hb)', () => {
    const a = derive({ Hb: 15, RBC: 5 }, {});
    const b = derive({ haemoglobin: 15, 'rbc count': 5 }, {});
    assert.equal(derivedMap(a).get('MCH'), 30);
    assert.equal(derivedMap(b).get('MCH'), 30);
  });

  it('skips rules with missing inputs instead of throwing', () => {
    const r = derive({}, {});
    assert.deepEqual(r.derived, []);
    assert.deepEqual(r.applied, []);
    assert.ok(r.skipped.length > 0);
    for (const s of r.skipped) assert.equal(s.reason, 'missing-inputs');
  });

  it('skips a rule when only some inputs are present', () => {
    const r = derive({ Hb: 15 }, {});
    const mcvSkip = r.skipped.find((s) => s.code === 'MCV');
    assert.ok(mcvSkip, 'MCV needs HCT+RBC so Hb alone must skip it');
    assert.ok(!r.applied.includes('MCV'));
  });

  it('does not recompute codes already present (case-insensitive)', () => {
    const r = derive({ Hb: 15, RBC: 5, HCT: 45, MCV: 95 }, {});
    assert.ok(!r.applied.includes('MCV'), 'MCV entered directly must not be recomputed');
    assert.ok(!derivedMap(r).has('MCV'));
    assert.ok(r.applied.includes('MCH'), 'other rules still apply');
  });

  it('does not recompute lowercase already-present codes', () => {
    const r = derive({ Hb: 15, RBC: 5, mch: 29 }, {});
    assert.ok(!r.applied.includes('MCH'));
  });
});

describe('formulaService evaluateResult()', () => {
  it('flags L below normalLow', () => {
    const out = evaluateResult(2, { normalLow: 4, normalHigh: 11 }, {});
    assert.equal(out.flag, 'L');
    assert.equal(out.outOfRange, true);
    assert.equal(out.critical, false);
  });

  it('flags H above normalHigh', () => {
    const out = evaluateResult(15, { normalLow: 4, normalHigh: 11 }, {});
    assert.equal(out.flag, 'H');
    assert.equal(out.outOfRange, true);
    assert.equal(out.critical, false);
  });

  it('flags N within range', () => {
    const out = evaluateResult(7, { normalLow: 4, normalHigh: 11 }, {});
    assert.equal(out.flag, 'N');
    assert.equal(out.outOfRange, false);
    assert.equal(out.critical, false);
  });

  it('critical low takes priority over abnormal (flag C)', () => {
    const out = evaluateResult(1.5, { normalLow: 4, normalHigh: 11, criticalLow: 2, criticalHigh: 20 }, {});
    assert.equal(out.flag, 'C');
    assert.equal(out.critical, true);
    assert.equal(out.outOfRange, true);
  });

  it('critical high takes priority over abnormal (flag C)', () => {
    const out = evaluateResult(22, { normalLow: 4, normalHigh: 11, criticalLow: 2, criticalHigh: 20 }, {});
    assert.equal(out.flag, 'C');
    assert.equal(out.critical, true);
  });

  it('flags ageMin restriction', () => {
    const out = evaluateResult(7, { normalLow: 0, normalHigh: 100, ageMin: 18 }, { age: 10 });
    assert.equal(out.restricted, true);
    assert.match(out.restrictionReason, /below age 18/);
  });

  it('flags ageMax restriction', () => {
    const out = evaluateResult(7, { normalLow: 0, normalHigh: 100, ageMax: 12 }, { age: 30 });
    assert.equal(out.restricted, true);
    assert.match(out.restrictionReason, /above age 12/);
  });

  it('flags sex restriction', () => {
    const out = evaluateResult(7, { normalLow: 0, normalHigh: 100, sexApplicable: 'Female' }, { gender: 'Male' });
    assert.equal(out.restricted, true);
    assert.match(out.restrictionReason, /Female only/);
  });

  it('does not restrict when sex matches', () => {
    const out = evaluateResult(7, { normalLow: 0, normalHigh: 100, sexApplicable: 'Female' }, { gender: 'Female' });
    assert.equal(out.restricted, false);
  });
});
