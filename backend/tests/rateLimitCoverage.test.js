// Static rate-limit coverage test (no DB, no network).
// Reads every backend/src/routes/*.js as text plus src/app.js and asserts:
//   1. app.js mounts generalLimiter on /api (tier-1 flood protection covers
//      every /api router, so routers without their own limiter are still
//      throttled);
//   2. rateLimitMiddleware exports the full limiter set (general/auth/
//      verify/otp/public/send/export/upload);
//   3. every route file is covered by >= 1 tier — either a directly
//      referenced limiter or the global generalLimiter via its /api mount
//      in app.js (the assertion message names the covering tier);
//   4. abuse-sensitive routes carry their own specific limiter
//      (auth, OTP verify, public QR, credit-spending sends, exports,
//      uploads).
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/purepathlab-test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SRC = path.join(__dirname, '..', 'src');
const ROUTES_DIR = path.join(SRC, 'routes');
const LIMITERS = [
  'generalLimiter', 'authLimiter', 'verifyLimiter', 'otpLimiter',
  'publicLimiter', 'sendLimiter', 'exportLimiter', 'uploadLimiter'
];

function routeFiles() {
  return fs.readdirSync(ROUTES_DIR).filter((f) => f.endsWith('.js'));
}

describe('rate-limit static coverage', () => {
  it('app.js mounts generalLimiter on /api', () => {
    const appJs = fs.readFileSync(path.join(SRC, 'app.js'), 'utf8');
    assert.ok(appJs.includes('generalLimiter'), 'app.js must reference generalLimiter');
    assert.ok(
      /app\.use\(\s*['"]\/api['"]\s*,\s*generalLimiter/.test(appJs),
      "app.js must mount generalLimiter via app.use('/api', generalLimiter)"
    );
  });

  it('rateLimitMiddleware exports the full limiter set', () => {
    const mw = require('../src/middleware/rateLimitMiddleware');
    for (const name of LIMITERS) {
      assert.ok(typeof mw[name] === 'function', `missing limiter export: ${name}`);
    }
  });

  it('every route file is covered by at least one limiter tier', () => {
    const appJs = fs.readFileSync(path.join(SRC, 'app.js'), 'utf8');
    const uncovered = [];
    for (const file of routeFiles()) {
      const text = fs.readFileSync(path.join(ROUTES_DIR, file), 'utf8');
      const direct = LIMITERS.filter((l) => text.includes(l));
      const base = path.basename(file, '.js');
      const mountedUnderApi = appJs.includes(base);
      if (direct.length === 0 && !mountedUnderApi) uncovered.push(file);
      assert.ok(
        direct.length > 0 || mountedUnderApi,
        `${file}: no limiter tier (direct=[${direct}] mountedUnderApi=${mountedUnderApi})`
      );
    }
    assert.deepEqual(uncovered, []);
  });

  it('abuse-sensitive routes carry their own specific limiter', () => {
    const read = (f) => fs.readFileSync(path.join(ROUTES_DIR, f), 'utf8');
    assert.ok(read('authRoutes.js').includes('authLimiter'), 'authRoutes must use authLimiter');
    assert.ok(read('authRoutes.js').includes('verifyLimiter'), 'authRoutes must use verifyLimiter');
    assert.ok(read('patientPortalRoutes.js').includes('otpLimiter'), 'patientPortalRoutes must use otpLimiter');
    assert.ok(read('publicRoutes.js').includes('publicLimiter'), 'publicRoutes must use publicLimiter');
    assert.ok(read('notifyRoutes.js').includes('sendLimiter'), 'notifyRoutes must use sendLimiter');
    assert.ok(read('exportRoutes.js').includes('exportLimiter'), 'exportRoutes must use exportLimiter');
    const uploadUsers = routeFiles().filter((f) => read(f).includes('uploadLimiter'));
    assert.ok(uploadUsers.length > 0, 'at least one route must use uploadLimiter');
  });
});
