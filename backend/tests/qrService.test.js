// Tests for backend/src/services/qrService.js
// Covers: signed public token roundtrip, tamper detection, wrong-secret
// rejection, verify URL builders. No DB, no network.
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/purepathlab-test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
process.env.PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || 'https://lab.example.com';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  newPublicToken,
  verifyPublicToken,
  reportVerifyUrl,
  billVerifyUrl
} = require('../src/services/qrService');

const SECRET = 'test-qr-secret-does-not-matter';

describe('qrService public tokens', () => {
  it('roundtrips: verify(newPublicToken(secret)) is true', () => {
    const token = newPublicToken(SECRET);
    assert.ok(typeof token === 'string' && token.includes('.'));
    assert.equal(verifyPublicToken(token, SECRET), true);
  });

  it('rejects tampered tokens', () => {
    const token = newPublicToken(SECRET);
    const last = token[token.length - 1];
    const flipped = last === 'a' ? 'b' : 'a';
    assert.equal(verifyPublicToken(token.slice(0, -1) + flipped, SECRET), false);
    assert.equal(verifyPublicToken(token + 'x', SECRET), false);
  });

  it('rejects tokens verified with the wrong secret', () => {
    const token = newPublicToken(SECRET);
    assert.equal(verifyPublicToken(token, 'wrong-secret'), false);
  });

  it('rejects malformed input', () => {
    assert.equal(verifyPublicToken('', SECRET), false);
    assert.equal(verifyPublicToken('no-dot-here', SECRET), false);
    assert.equal(verifyPublicToken(null, SECRET), false);
    assert.equal(verifyPublicToken(undefined, SECRET), false);
  });
});

describe('qrService verify URLs', () => {
  it('reportVerifyUrl contains the token', () => {
    const url = reportVerifyUrl('abc123.def45678');
    assert.ok(url.includes('/r/abc123.def45678'), `unexpected url: ${url}`);
  });

  it('billVerifyUrl contains the token', () => {
    const url = billVerifyUrl('abc123.def45678');
    assert.ok(url.includes('/r/bill/abc123.def45678'), `unexpected url: ${url}`);
  });
});
