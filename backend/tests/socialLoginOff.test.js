const test = require('node:test');
const assert = require('node:assert');
const router = require('../src/routes/authRoutes');

test('Google / Facebook sign-in routes are not mounted', () => {
  const paths = router.stack.filter((layer) => layer.route).map((layer) => layer.route.path);
  for (const path of ['/google', '/google/url', '/facebook', '/facebook/url']) {
    assert.ok(!paths.includes(path), `${path} must not be mounted`);
  }
  assert.ok(paths.includes('/login'), 'password login still mounted');
});
