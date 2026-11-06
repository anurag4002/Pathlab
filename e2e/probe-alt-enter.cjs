// Reproduces Alt+Enter on the new-bill screen from the different places the
// cursor can be (after clicking a test, a dropdown, a field), and reports
// where the page ends up.
const { start } = require('./env.cjs');
const { openBrowser } = require('./browser.cjs');
const { login } = require('./login.cjs');
const { BASE } = require('./config.cjs');

(async () => {
  const env = await start();
  const { browser, page } = await openBrowser(env);
  await login(page, env.admin.email, env.admin.password);
  const cases = [
    ['after clicking a test in the list', async () => { await page.locator('.test-picker-item').first().click(); }],
    ['after choosing a payment mode', async () => { await page.locator('.test-picker-item').first().click(); await page.getByLabel('Payment Mode').selectOption({ index: 1 }); }],
    ['from the amount field', async () => { await page.locator('.test-picker-item').first().click(); await page.getByLabel(/Amount Received/).click(); }],
    ['after pressing and releasing Alt first', async () => { await page.locator('.test-picker-item').first().click(); await page.keyboard.press('Alt'); }],
    ['nothing focused (clicked page background)', async () => { await page.locator('.test-picker-item').first().click(); await page.mouse.click(700, 20); }],
  ];
  for (const [name, prepare] of cases) {
    await page.goto(BASE + '/cases/bills/new', { waitUntil: 'networkidle' });
    await page.getByPlaceholder(/type name, phone or reg no/i).fill('Walk');
    await page.waitForTimeout(400);
    // Register a new patient quickly (fresh database has no patients).
    await page.getByRole('button', { name: 'Register New' }).click();
    await page.getByRole('textbox', { name: 'First Name' }).fill('Alt');
    await page.getByPlaceholder('Years').fill('30');
    await page.getByRole('textbox', { name: /Phone/i }).first().fill('9876511111');
    await prepare();
    const focus = await page.evaluate(() => `${document.activeElement?.tagName} ${document.activeElement?.getAttribute('aria-label') || document.activeElement?.innerText?.slice(0, 40) || ''}`);
    await page.keyboard.press('Alt+Enter');
    await page.waitForTimeout(2500);
    const toast = await page.locator('.toast').allInnerTexts().catch(() => []);
    console.log(`${name.padEnd(42)} focus=[${focus.replace(/\s+/g, ' ')}] -> ${page.url().replace(BASE, '')} ${toast.length ? `toast: ${toast.join(' | ')}` : ''}`);
  }
  await browser.close(); await env.stop();
})().catch(e => { console.error(e); process.exit(1); });
