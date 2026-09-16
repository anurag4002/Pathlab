// Tests for backend/src/middleware/permissionMiddleware.js
// Covers: Admin passthrough, legacy empty-permissions passthrough, explicit
// matrix allow/deny, 401 with no user, PERMISSION_KEYS contents.
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/purepathlab-test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { requirePermission, PERMISSION_KEYS } = require('../src/middleware/permissionMiddleware');

function mockRes() {
  return {
    statusCode: null,
    body: null,
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; }
  };
}

function run(mw, user) {
  const req = user === undefined ? {} : { user };
  const res = mockRes();
  let nextCalled = false;
  mw(req, res, () => { nextCalled = true; });
  return { res, nextCalled };
}

describe('permissionMiddleware requirePermission()', () => {
  it('Admin passes any permission', () => {
    const { nextCalled } = run(requirePermission('billing'), { role: 'Admin' });
    assert.equal(nextCalled, true);
    const { nextCalled: n2 } = run(requirePermission('reports'), { role: 'Admin', permissions: {} });
    assert.equal(n2, true);
  });

  it('legacy-passes when no permission matrix is configured ({} or missing)', () => {
    const { res, nextCalled } = run(requirePermission('billing'), { role: 'Staff', permissions: {} });
    assert.equal(nextCalled, true);
    assert.equal(res.statusCode, null);
    const r2 = run(requirePermission('reports'), { role: 'Staff' });
    assert.equal(r2.nextCalled, true);
  });

  it('explicit {billing:true} passes billing but 403s reports', () => {
    const ok = run(requirePermission('billing'), { role: 'Staff', permissions: { billing: true } });
    assert.equal(ok.nextCalled, true);

    const denied = run(requirePermission('reports'), { role: 'Staff', permissions: { billing: true } });
    assert.equal(denied.nextCalled, false);
    assert.equal(denied.res.statusCode, 403);
  });

  it('supports Map-based permission matrices', () => {
    const perms = new Map([['billing', true]]);
    const ok = run(requirePermission('billing'), { role: 'Staff', permissions: perms });
    assert.equal(ok.nextCalled, true);
    const denied = run(requirePermission('finance'), { role: 'Staff', permissions: perms });
    assert.equal(denied.nextCalled, false);
    assert.equal(denied.res.statusCode, 403);
  });

  it('returns 401 when there is no user', () => {
    const { res, nextCalled } = run(requirePermission('billing'), undefined);
    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 401);
  });
});

describe('permissionMiddleware PERMISSION_KEYS', () => {
  it('exports all expected keys', () => {
    for (const k of ['billing', 'reports', 'rates', 'finance', 'settings', 'patients', 'delivery']) {
      assert.ok(PERMISSION_KEYS.includes(k), `PERMISSION_KEYS missing ${k}`);
    }
  });
});
