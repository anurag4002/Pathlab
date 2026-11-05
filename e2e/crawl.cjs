// Visits every route a signed-in admin can reach and records crashes,
// 5xx responses and console errors per page.
const fs = require('fs');
const path = require('path');
const { start } = require('./env.cjs');
const { openBrowser } = require('./browser.cjs');
const { login } = require('./login.cjs');
const { BASE } = require('./config.cjs');

const routes = [...fs.readFileSync(path.resolve(__dirname, '../frontend/src/routes/AppRoutes.jsx'), 'utf8').matchAll(/<Route path="([^"]+)"/g)]
  .map(m => m[1]).filter(p => !process.env.ONLY || process.env.ONLY.split(',').includes(p)).filter(p => !p.includes(':') && p !== '*' && !/^\/(login|logout|r\b|portal|patient|forgot|reset|verify|book)/.test(p));

(async () => {
  const env = await start();
  const { browser, page, problems } = await openBrowser(env, { width: Number(process.env.W || 1440), height: Number(process.env.H || 900) });
  await login(page, env.admin.email, env.admin.password);
  const report = [];
  for (const route of [...new Set(routes)]) {
    const before = problems.length;
    await page.goto(BASE + route, { waitUntil: 'networkidle', timeout: 60000 }).catch(e => problems.push(`NAV ${route}: ${e.message.slice(0, 80)}`));
    await page.waitForTimeout(Number(process.env.WAIT || 700));
    const info = await page.evaluate(() => ({
      h1: document.querySelector('h1')?.textContent?.trim().slice(0, 50) || '',
      blank: (document.querySelector('main')?.innerText || document.body.innerText).trim().length < 20,
      errorBox: [...document.querySelectorAll('[role=alert]')].map(e => e.textContent.trim()).filter(Boolean).slice(0, 2).join(' | ').slice(0, 160),
      overflowX: document.documentElement.scrollWidth > window.innerWidth + 1
    }));
    const issues = problems.slice(before);
    report.push({ route, ...info, issues });
  }
  for (const r of report) {
    const flags = [r.blank ? 'BLANK' : '', r.overflowX ? 'H-SCROLL' : '', r.errorBox ? `ALERT: ${r.errorBox}` : '', ...r.issues].filter(Boolean);
    console.log(`${flags.length ? 'ISSUE' : 'ok   '} ${r.route.padEnd(32)} ${r.h1.padEnd(36)} ${flags.join(' || ')}`);
  }
  await browser.close(); await env.stop();
})().catch(e => { console.error(e); process.exit(1); });
