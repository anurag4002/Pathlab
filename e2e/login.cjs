async function login(page, email, password) {
  await page.goto(require('./config.cjs').BASE + '/login', { waitUntil: 'networkidle' });
  await page.locator('#login-email').fill(email);
  await page.locator('#login-password').fill(password);
  await page.locator('button[type=submit]').first().click();
  await page.waitForURL(url => !/\/login/.test(url.pathname), { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(800);
}
module.exports = { login };
