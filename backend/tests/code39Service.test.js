// Tests for backend/src/services/code39Service.js
// Covers: encode() bars/width, sanitize() stripping illegal chars,
// toSVG() structure.
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/purepathlab-test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { encode, sanitize, toSVG } = require('../src/services/code39Service');

describe('code39Service encode()', () => {
  it('produces non-empty bars and width > 0', () => {
    const { bars, width } = encode('BILL123');
    assert.ok(bars.length > 0, 'bars must be non-empty');
    assert.ok(width > 0, 'width must be > 0');
    for (const b of bars) {
      assert.ok(b.w > 0);
      assert.ok(b.x >= 0);
    }
  });

  it('includes start/stop characters even for empty input', () => {
    const { bars, width } = encode('');
    assert.ok(bars.length > 0);
    assert.ok(width > 0);
  });

  it('longer text yields larger width', () => {
    assert.ok(encode('BILL12345').width > encode('B1').width);
  });
});

describe('code39Service sanitize()', () => {
  it('uppercases input', () => {
    assert.equal(sanitize('bill123'), 'BILL123');
  });

  it('strips illegal chars (#, !, @)', () => {
    assert.equal(sanitize('AB#CD!EF@GH'), 'ABCDEFGH');
  });

  it('keeps legal code39 chars incl. space - . $ / + %', () => {
    assert.equal(sanitize('A-1. $/+%'), 'A-1. $/+%');
  });

  it('handles empty/null input', () => {
    assert.equal(sanitize(''), '');
    assert.equal(sanitize(null), '');
  });
});

describe('code39Service toSVG()', () => {
  it('returns an <svg> containing the encoded text', () => {
    const svg = toSVG('B12');
    assert.ok(svg.includes('<svg'), 'SVG must contain <svg');
    assert.ok(svg.includes('B12'), 'SVG must contain the human-readable text');
    assert.ok(svg.includes('<rect'), 'SVG must contain bar rects');
  });

  it('sanitizes text inside the SVG', () => {
    const svg = toSVG('ab#c');
    assert.ok(svg.includes('>ABC</text>'), 'SVG <text> must hold the sanitized form');
    assert.ok(!svg.includes('>AB#C</text>'), 'illegal chars must not appear in SVG text');
  });
});
