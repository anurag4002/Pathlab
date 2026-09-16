// Tests for backend/src/config/cors.js
// Covers: CORS allowlist parsing + origin callback behaviour.
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { parseOrigins, buildCorsOptions } = require('../src/config/cors');

function decide(options, origin) {
  return new Promise((resolve) => {
    options.origin(origin, (err, allowed) => resolve({ err, allowed }));
  });
}

describe('parseOrigins', () => {
  it('splits comma-separated origins and trims whitespace', () => {
    assert.deepEqual(
      parseOrigins('https://a.example.com, https://b.example.com '),
      ['https://a.example.com', 'https://b.example.com']
    );
  });

  it('drops empty entries', () => {
    assert.deepEqual(parseOrigins('https://a.example.com,,,'), ['https://a.example.com']);
  });

  it('returns [] for empty/undefined input', () => {
    assert.deepEqual(parseOrigins(''), []);
    assert.deepEqual(parseOrigins(undefined), []);
  });
});

describe('buildCorsOptions', () => {
  it('allows a whitelisted origin', async () => {
    const opts = buildCorsOptions({
      CORS_ORIGIN: 'http://localhost:5173,https://app.example.com',
      CORS_CREDENTIALS: true
    });
    const { err, allowed } = await decide(opts, 'https://app.example.com');
    assert.equal(err, null);
    assert.equal(allowed, true);
    assert.equal(opts.credentials, true);
  });

  it('rejects an origin not on the allowlist', async () => {
    const opts = buildCorsOptions({ CORS_ORIGIN: 'https://app.example.com', CORS_CREDENTIALS: true });
    const { err } = await decide(opts, 'https://evil.example.com');
    assert.ok(err instanceof Error);
    assert.match(err.message, /Not allowed by CORS/);
  });

  it('allows requests with no Origin header (curl / mobile / server-to-server)', async () => {
    const opts = buildCorsOptions({ CORS_ORIGIN: 'https://app.example.com', CORS_CREDENTIALS: true });
    const { err, allowed } = await decide(opts, undefined);
    assert.equal(err, null);
    assert.equal(allowed, true);
  });

  it('reflects any origin only when "*" is explicitly configured', async () => {
    const opts = buildCorsOptions({ CORS_ORIGIN: '*', CORS_CREDENTIALS: true });
    const { err, allowed } = await decide(opts, 'https://anything.example.com');
    assert.equal(err, null);
    assert.equal(allowed, true);
  });

  it('does not reflect arbitrary origins by default (no open CORS)', async () => {
    const opts = buildCorsOptions({ CORS_ORIGIN: 'https://app.example.com', CORS_CREDENTIALS: true });
    const { err } = await decide(opts, 'https://attacker.example.com');
    assert.ok(err instanceof Error);
  });

  it('honours CORS_CREDENTIALS=false', () => {
    const opts = buildCorsOptions({ CORS_ORIGIN: 'https://app.example.com', CORS_CREDENTIALS: false });
    assert.equal(opts.credentials, false);
  });
});
