// Tests for backend/src/config/environment.js
// Covers: production fail-fast on missing secrets + safe dev defaults +
// CORS env wiring. Child processes are used so dotenv file loading and
// module caching cannot leak state between cases.
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { execFile } = require('node:child_process');
const path = require('node:path');

const BACKEND_DIR = path.join(__dirname, '..');
const SNIPPET = 'JSON.stringify({MONGO_URI:require("./src/config/environment").MONGO_URI,JWT_SECRET:require("./src/config/environment").JWT_SECRET,CORS_ORIGIN:require("./src/config/environment").CORS_ORIGIN,CORS_CREDENTIALS:require("./src/config/environment").CORS_CREDENTIALS,NODE_ENV:require("./src/config/environment").NODE_ENV})';

function loadEnv(extraEnv) {
  return new Promise((resolve, reject) => {
    execFile(
      process.execPath,
      ['-e', `console.log(${SNIPPET})`],
      { cwd: BACKEND_DIR, env: { ...process.env, ...extraEnv } },
      (err, stdout, stderr) => resolve({ err, stdout, stderr })
    );
  });
}

describe('environment fail-fast', () => {
  it('refuses to start in production without MONGO_URI', async () => {
    const { err, stderr } = await loadEnv({ NODE_ENV: 'production', MONGO_URI: '', JWT_SECRET: 'x'.repeat(32) });
    assert.ok(err, 'expected non-zero exit');
    assert.match(stderr + (err && err.message), /MONGO_URI/);
  });

  it('refuses to start in production without JWT_SECRET', async () => {
    const { err, stderr } = await loadEnv({ NODE_ENV: 'production', MONGO_URI: 'mongodb://localhost:27017/x', JWT_SECRET: '' });
    assert.ok(err, 'expected non-zero exit');
    assert.match(stderr + (err && err.message), /JWT_SECRET/);
  });

  it('boots in development without secrets using local-only placeholders', async () => {
    const { err, stdout } = await loadEnv({ NODE_ENV: 'development', MONGO_URI: '', JWT_SECRET: '' });
    assert.equal(err, null);
    const cfg = JSON.parse(stdout.trim());
    assert.ok(cfg.MONGO_URI.includes('127.0.0.1'));
    assert.ok(!cfg.JWT_SECRET.includes('purepathlabsecretkey'));
  });

  it('contains no hardcoded production credentials', async () => {
    const { err, stdout } = await loadEnv({ NODE_ENV: 'development', MONGO_URI: '', JWT_SECRET: '' });
    assert.equal(err, null);
    assert.ok(!stdout.includes('mishraanurag66031_db_user'));
    assert.ok(!stdout.includes('purepathlabsecretkey1234567890'));
  });
});

describe('environment CORS wiring', () => {
  it('defaults CORS_ORIGIN to CLIENT_URL', async () => {
    const { err, stdout } = await loadEnv({
      NODE_ENV: 'development', MONGO_URI: '', JWT_SECRET: '',
      CLIENT_URL: 'https://lab.example.com',
      CORS_ORIGIN: ''
    });
    assert.equal(err, null);
    const cfg = JSON.parse(stdout.trim());
    assert.equal(cfg.CORS_ORIGIN, 'https://lab.example.com');
    assert.equal(cfg.CORS_CREDENTIALS, true);
  });

  it('honours explicit CORS_ORIGIN / CORS_CREDENTIALS', async () => {
    const { err, stdout } = await loadEnv({
      NODE_ENV: 'development', MONGO_URI: '', JWT_SECRET: '',
      CORS_ORIGIN: 'https://a.example.com,https://b.example.com',
      CORS_CREDENTIALS: 'false'
    });
    assert.equal(err, null);
    const cfg = JSON.parse(stdout.trim());
    assert.equal(cfg.CORS_ORIGIN, 'https://a.example.com,https://b.example.com');
    assert.equal(cfg.CORS_CREDENTIALS, false);
  });
});
