// Real frontend (dev server on :3000) in a headless browser; every /api and
// /uploads request is answered by the in-process backend from env.cjs.
const { loadPlaywright, chromePath, BASE } = require('./config.cjs');
const { chromium } = loadPlaywright();

async function openBrowser(env, { width = 1440, height = 900 } = {}) {
  const browser = await chromium.launch({ executablePath: chromePath(), headless: true });
  const context = await browser.newContext({ viewport: { width, height }, acceptDownloads: true });
  const problems = [];
  const whatsapp = [];
  await context.route('https://wa.me/**', route => { whatsapp.push(decodeURIComponent(route.request().url())); return route.fulfill({ status: 200, body: 'wa' }); });
  await context.route(/\/(api|uploads)\//, async route => {
    const req = route.request();
    const url = req.url().replace(/^https?:\/\/[^/]+/, '');
    const res = await env.inject({ method: req.method(), url, headers: req.headers(), body: req.postDataBuffer() });
    if (res.status === 404 || res.status === 400) problems.push(`HTTP ${res.status} ${req.method()} ${url}`);
    if (res.status >= 500) problems.push(`HTTP ${res.status} ${req.method()} ${url} ${res.body.toString().slice(0, 200)}`);
    return route.fulfill({ status: res.status, headers: res.headers, body: res.body });
  });
  const page = await context.newPage();
  page.on('response', r => { const u = r.url(); if (r.status() >= 400 && !/\/(api|uploads)\//.test(u) && !/wa\.me|favicon/.test(u)) problems.push(`HTTP ${r.status()} ${u.replace(BASE, '')}`); });
  page.on('pageerror', e => problems.push(`PAGE ERROR ${page.url()}: ${e.message.slice(0, 200)}`));
  page.on('console', m => { if (m.type() === 'error' && !/favicon|DevTools|Download the React|Failed to load resource|ERR_NETWORK_CHANGED/.test(m.text()) && !problems.includes(m.text())) problems.push(`CONSOLE ${page.url().replace(BASE, '')}: ${m.text().slice(0, 200)}`); });
  return { browser, context, page, problems, whatsapp };
}

module.exports = { openBrowser };
