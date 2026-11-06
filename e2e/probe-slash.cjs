// For each main screen: press "/" and report which field got the cursor,
// whether it is visible, and whether a stray "/" was typed into it.
const { start } = require('./env.cjs');
const { openBrowser } = require('./browser.cjs');
const { login } = require('./login.cjs');
const { BASE } = require('./config.cjs');

(async () => {
  const env = await start();
  const { browser, page } = await openBrowser(env);
  await login(page, env.admin.email, env.admin.password);
  const screens = ['/dashboard', '/cases/bills', '/cases/bills/new', '/cases/patients', '/lab/reports', '/lab/result-entry', '/lab/verification', '/lab/search', '/reviews', '/lab/tests', '/business/daily', '/usg/today', '/xray/today', '/manage/employees'];
  for (const screen of screens) {
    await page.goto(BASE + screen, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(600);
    await page.mouse.click(1430, 890);
    await page.keyboard.press('/');
    await page.waitForTimeout(300);
    const info = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return { what: '(nothing)' };
      const r = el.getBoundingClientRect();
      return {
        what: `${el.tagName.toLowerCase()} "${el.getAttribute('aria-label') || el.placeholder || el.name || ''}"`.slice(0, 80),
        visible: r.top >= 0 && r.bottom <= window.innerHeight,
        typed: el.value === '/',
        overlay: !!document.querySelector('[role="dialog"]'),
      };
    });
    console.log(`${screen.padEnd(20)} ${info.what}${info.visible === false ? '  [OFF-SCREEN]' : ''}${info.typed ? '  [typed "/"]' : ''}${info.overlay ? '  [dialog open]' : ''}`);
  }
  await browser.close(); await env.stop();
})().catch(e => { console.error(e); process.exit(1); });
