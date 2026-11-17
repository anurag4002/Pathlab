const test = require('node:test');
const assert = require('node:assert');
const { validatePatient } = require('../src/validators/patientValidator');

const base = { name: 'Asha Verma', age: 30, gender: 'Female' };

test('a new patient with a phone needs a birth year; without a phone it is optional', () => {
  assert.ok(validatePatient({ ...base, phone: '9876543210' }).errors.birthYear, 'phone without birth year is rejected');
  assert.equal(validatePatient({ ...base, phone: '9876543210', birthYear: 1995 }).isValid, true);
  assert.equal(validatePatient({ ...base }).isValid, true, 'no phone, no birth year is fine');
  assert.equal(validatePatient({ ...base, phone: '  ' }).isValid, true, 'blank phone counts as no phone');
  assert.match(validatePatient({ ...base, phone: '9876543210', birthYear: 95 }).errors.birthYear, /four-digit/);
});
