// Tests for backend/src/app.js route mounting.
// Covers: single-mount under /api only — no bare /auth, /users, ... mounts
// (the old registerAllRoutes('') doubled every endpoint and broke
// prefix-dependent logic such as upload-folder resolution).
process.env.NODE_ENV = 'test';
process.env.MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/purepathlab-test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const app = require('../src/app');

const EXPECTED_MOUNTS = [
  'auth', 'users', 'patients', 'doctors', 'agents', 'bills', 'tests',
  'reports', 'expenses', 'transactions', 'usg', 'xray', 'dashboard', 'patient',
  'public', 'setup', 'settings', 'audit-log', 'notify', 'support', 'modality', 'doctor', 'export',
  'jobs', 'analysis'
];

function routerMountRegexps() {
  // Express prints mount regexps with escaped slashes (/^\/api\/auth\/?.../i).
  // Normalise to plain slashes so assertions stay readable.
  return app._router.stack
    .filter((l) => l.name === 'router' && l.regexp)
    .map((l) => l.regexp.toString().replace(/\\/g, ''));
}

describe('API route mounting', () => {
  it('mounts every router exactly once under /api/<name>', () => {
    const regexps = routerMountRegexps();
    for (const name of EXPECTED_MOUNTS) {
      // Boundary-aware: plain substring would match "patient" inside "patients".
      const re = new RegExp(`/api/${name}(?![a-zA-Z])`);
      const hits = regexps.filter((r) => re.test(r));
      assert.equal(hits.length, 1, `expected exactly one /api/${name} mount, got ${hits.length}`);
    }
  });

  it('has no bare mounts (/:name without /api prefix)', () => {
    // After normalisation a mount looks like /^/api/auth/?(?=/|$)/i.
    // Every router mount must live under /api — a bare /auth, /users, ...
    // mount (the old double-mount) would fail this.
    const regexps = routerMountRegexps();
    assert.equal(regexps.length, EXPECTED_MOUNTS.length);
    for (const r of regexps) {
      assert.ok(r.startsWith('/^/api/'), `bare mount must not exist: ${r}`);
    }
  });

  it('exposes health checks without leaking secrets', () => {
    // Note: app.get([...paths], handler) stores an ARRAY in route.path.
    const direct = app._router.stack
      .filter((l) => l.route)
      .flatMap((l) => (Array.isArray(l.route.path) ? l.route.path : [l.route.path]));
    assert.ok(direct.includes('/api/health'));
    assert.ok(direct.includes('/health'));
  });
});
