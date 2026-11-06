// Prints where Tab goes on the new-bill screen, so keyboard order can be
// checked: node e2e/tab-order.cjs [path] [presses]
const { start } = require('./env.cjs');
const { openBrowser } = require('./browser.cjs');
const { login } = require('./login.cjs');
const { BASE } = require('./config.cjs');

(async () => {
  const env = await start();
  const { browser, page } = await openBrowser(env);
  await login(page, env.admin.email, env.admin.password);
  await page.goto(BASE + (process.argv[2] || '/cases/bills/new'), { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await page.locator('main').click({ position: { x: 2, y: 2 } }).catch(() => {});
  const seen = [];
  for (let i = 0; i < Number(process.argv[3] || 70); i++) {
    await page.keyboard.press('Tab');
    seen.push(await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return '(body)';
      const label = el.getAttribute('aria-label') || el.labels?.[0]?.innerText || el.placeholder || el.innerText || el.value || el.name || '';
      const where = el.closest('main') ? 'main' : el.closest('aside, .sidebar, nav') ? 'sidebar' : el.closest('header') ? 'header' : 'other';
      return `${where} ${el.tagName.toLowerCase()}${el.type ? `[${el.type}]` : ''} ${String(label).replace(/\s+/g, ' ').trim().slice(0, 60)}`;
    }));
  }
  seen.forEach((s, i) => console.log(String(i + 1).padStart(3), s));
  await browser.close(); await env.stop();
})().catch(e => { console.error(e); process.exit(1); });
