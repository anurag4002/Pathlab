// Tests for backend/src/middleware/errorMiddleware.js
// Covers: the operator-precedence fix — err.statusCode and res.statusCode
// must be honoured instead of everything collapsing to 500.
process.env.NODE_ENV = 'test';
process.env.MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/purepathlab-test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const errorHandler = require('../src/middleware/errorMiddleware');

function mockRes(statusCode = 200) {
  return {
    statusCode,
    status(c) {
      this.statusCode = c;
      return this;
    },
    json(b) {
      this.body = b;
      return this;
    }
  };
}

describe('errorMiddleware status resolution', () => {
  it('uses err.statusCode when the error carries one (was masked to 500 before fix)', () => {
    const res = mockRes(200);
    errorHandler({ ...new Error('Not found'), statusCode: 404, message: 'Not found' }, {}, res, () => {});
    assert.equal(res.statusCode, 404);
    assert.equal(res.body.success, false);
    assert.equal(res.body.message, 'Not found');
  });

  it('falls back to 500 when neither err nor res carries a status', () => {
    const res = mockRes(200);
    errorHandler(new Error('boom'), {}, res, () => {});
    assert.equal(res.statusCode, 500);
  });

  it('preserves a non-200 res.statusCode when the error has none', () => {
    const res = mockRes(400);
    errorHandler(new Error('bad input'), {}, res, () => {});
    assert.equal(res.statusCode, 400);
  });

  it('hides the stack trace outside development', () => {
    const res = mockRes(200);
    errorHandler(new Error('boom'), {}, res, () => {});
    assert.equal(res.body.errors, undefined);
  });
});
