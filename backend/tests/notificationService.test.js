// Tests for backend/src/services/notificationService.js fillVars()
// Covers: {{var}} substitution, whitespace tolerance, missing vars left
// intact, null/undefined vars left intact. Pure function — no DB/network.
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/purepathlab-test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { fillVars } = require('../src/services/notificationService');

describe('notificationService fillVars()', () => {
  it('substitutes {{var}} placeholders', () => {
    assert.equal(
      fillVars('Hello {{name}}, bill {{billNo}} due {{amount}}', { name: 'Ram', billNo: 'B12', amount: 500 }),
      'Hello Ram, bill B12 due 500'
    );
  });

  it('tolerates whitespace inside braces', () => {
    assert.equal(fillVars('Hi {{ name }}!', { name: 'Sita' }), 'Hi Sita!');
  });

  it('leaves missing vars intact', () => {
    assert.equal(
      fillVars('Hi {{name}}, code {{missing}}', { name: 'Ram' }),
      'Hi Ram, code {{missing}}'
    );
  });

  it('leaves null/undefined vars intact', () => {
    assert.equal(fillVars('v={{a}}', {}), 'v={{a}}');
    assert.equal(fillVars('v={{a}}', { a: null }), 'v={{a}}');
    assert.equal(fillVars('v={{a}}', { a: undefined }), 'v={{a}}');
  });

  it('supports dotted keys', () => {
    assert.equal(fillVars('Lab {{lab.name}}', { 'lab.name': 'PurePath' }), 'Lab PurePath');
  });

  it('handles empty body', () => {
    assert.equal(fillVars('', { a: 1 }), '');
    assert.equal(fillVars(null), '');
  });
});
