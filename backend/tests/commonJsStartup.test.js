const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');

test('server imports and rich interpretation sanitizing work without require(ESM) support', () => {
  // Vercel's CommonJS loader cannot rely on newer Node's experimental ESM
  // require support, even when that support hides the issue in local tests.
  const flags = process.allowedNodeEnvironmentFlags.has('--no-experimental-require-module')
    ? ['--no-experimental-require-module'] : [];
  const output = execFileSync(process.execPath, [...flags, '-e', `
    const assert = require('node:assert/strict');
    const { sanitizeInterpretation, richInterpretationBlocks } = require('./src/services/richInterpretation');
    const html = sanitizeInterpretation('<h3>Clinical notes</h3><table><tr><td>Retained cell</td></tr></table><script>alert(1)</script>');
    assert.ok(!html.includes('<script'));
    assert.ok(html.includes('<table>') && html.includes('Retained cell'));
    assert.ok(richInterpretationBlocks(html).some(block => block.kind === 'table'));
    require('./src/controllers/reportController');
    require('./src/app');
    console.log('CommonJS startup passed');
  `], { cwd: path.resolve(__dirname, '..'), encoding: 'utf8', timeout: 15000,
    env: { ...process.env, NODE_ENV: 'test', JWT_SECRET: 'commonjs-startup-fixture' } });
  assert.match(output, /CommonJS startup passed/);
});
