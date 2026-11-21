const { test } = require('node:test');
const assert = require('node:assert/strict');
const { evaluateResult } = require('../src/services/formulaService');

// Catalog bands where the printed text and the stored numbers disagree.
const band = (text, low, high) => ({ referenceRanges: [{ sex: 'Any', ageMin: 20, ageMinUnit: 'y', ageMax: 100, ageMaxUnit: 'y', referenceRange: text, normalLow: low, normalHigh: high }] });
const adult = { age: 52, ageUnit: 'years', gender: 'Female' };

test('the printed range decides the flag, not stale stored numbers', () => {
  const pp = band('< 180 mg/dl', 70, 140);
  assert.equal(evaluateResult('140.3', pp, adult).flag, 'N', '140.3 is normal against "< 180"');
  assert.equal(evaluateResult('179', pp, adult).flag, 'N');
  assert.equal(evaluateResult('180', pp, adult).flag, 'H', '"< 180" means 180 itself is high');
  assert.equal(evaluateResult('250', pp, adult).flag, 'H');
  assert.equal(evaluateResult('60', pp, adult).flag, 'N', 'no low limit is printed');
  const egfr = band('> 90', 90, 300);
  assert.equal(evaluateResult('350', egfr, adult).flag, 'N');
  assert.equal(evaluateResult('85', egfr, adult).flag, 'L');
  const fbs = band('70 - 100', 70, 100);
  assert.equal(evaluateResult('123', fbs, adult).flag, 'H');
  assert.equal(evaluateResult('65', fbs, adult).flag, 'L');
});

test('stored numbers still apply when the printed range has no numbers', () => {
  const text = band('Negative', null, null);
  assert.equal(evaluateResult('5', text, adult).flag, 'N');
  const numbersOnly = band('See note', 10, 20);
  assert.equal(evaluateResult('25', numbersOnly, adult).flag, 'H');
  assert.equal(evaluateResult('5', numbersOnly, adult).flag, 'L');
});
