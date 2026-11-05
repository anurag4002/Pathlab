// End-to-end flows against the isolated environment (real UI, real backend,
// throwaway database). Each step passes or fails on its own; later steps
// reuse what earlier ones created.
const path = require('path');
const assert = require('assert/strict');
const { start } = require('./env.cjs');
const { openBrowser } = require('./browser.cjs');
const { login } = require('./login.cjs');

const results = [];
const state = {};
const { BASE, OUT } = require('./config.cjs');
const SHOTS = OUT;
require('fs').mkdirSync(SHOTS, { recursive: true });

async function run(page, problems, name, fn) {
  const before = problems.length;
  try {
    await fn();
    const fresh = problems.slice(before).filter(p => !/letterheads|footers|logos/.test(p));
    results.push(fresh.length ? `WARN ${name} :: ${fresh.slice(0, 3).join(' | ')}` : `PASS ${name}`);
  } catch (error) {
    const file = path.join(SHOTS, `e2e-fail-${results.length + 1}.png`);
    await page.screenshot({ path: file }).catch(() => {});
    results.push(`FAIL ${name} :: ${String(error.message).split('\n')[0].slice(0, 220)} [${path.basename(file)}]`);
  }
}
const api = async (env, method, url, body) => {
  const res = await env.inject({ method, url, headers: { authorization: `Bearer ${state.token}`, 'content-type': 'application/json' }, body: body ? Buffer.from(JSON.stringify(body)) : undefined });
  return { status: res.status, json: JSON.parse(res.body.toString() || '{}') };
};

module.exports = { run, api, results, state, BASE, SHOTS, assert, start, openBrowser, login };
