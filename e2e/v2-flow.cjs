// New look end to end: switch on from the user menu, use the revamped
// screens, check phone cards, switch back to Classic.
//   node e2e/v2-flow.cjs
const path = require('path');
const { run, results, BASE, OUT, assert, start, openBrowser, login } = { ...require('./flows.cjs'), OUT: require('./config.cjs').OUT };

(async () => {
  const env = await start();
  const { browser, page, problems } = await openBrowser(env);
  const step = (name, fn) => run(page, problems, name, fn);
  const auth = await env.inject({ method: 'POST', url: '/api/auth/login', headers: { 'content-type': 'application/json' }, body: Buffer.from(JSON.stringify({ email: env.admin.email, password: env.admin.password })) });
  const token = JSON.parse(auth.body.toString()).data.token;
  const call = async (method, url, body) => JSON.parse((await env.inject({ method, url, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: body ? Buffer.from(JSON.stringify(body)) : undefined })).body.toString() || '{}');

  // Seed: two patients, one unpaid and one paid bill with a report.
  const cbc = await env.mongoose.model('TestPanel').findOne({ name: 'Complete Blood Count (CBC)' }).lean();
  const seeded = [];
  for (const [i, person] of [['Meera Iyer', 'Female', 34], ['Karan Malhotra', 'Male', 51]].entries()) {
    const patient = await call('POST', '/api/patients', { name: person[0], gender: person[1], age: person[2], phone: `98765${String(43210 + i)}` });
    const price = cbc.price || 350;
    const bill = await call('POST', '/api/bills', { patient: patient.data._id, items: [{ itemType: 'TestPanel', itemId: cbc._id, name: cbc.name, price }], paidAmount: i ? price : 0, paymentMethod: 'Cash' });
    await call('POST', '/api/reports/result', { patient: patient.data._id, bill: bill.data._id, entryMode: 'inhouse' });
    seeded.push({ patient: patient.data, bill: bill.data });
  }

  await login(page, env.admin.email, env.admin.password);

  await step('switch to the new look from the user menu', async () => {
    assert.equal(await page.evaluate(() => document.documentElement.classList.contains('ui-v2')), false, 'starts in Classic');
    await page.locator('.user-menu-trigger').click();
    await page.getByRole('menuitemcheckbox', { name: /New look/ }).click();
    assert.equal(await page.evaluate(() => document.documentElement.classList.contains('ui-v2')), true);
    await page.reload({ waitUntil: 'networkidle' });
    assert.equal(await page.evaluate(() => document.documentElement.classList.contains('ui-v2')), true, 'choice remembered after reload');
  });

  await step('new dashboard: grouped figures and compact quick actions', async () => {
    await page.goto(BASE + '/dashboard', { waitUntil: 'networkidle' }); await page.waitForTimeout(800);
    const figures = await page.locator('.stat-group').innerText();
    for (const label of ['Collected today', 'Bills today', 'Waiting for results', 'Balance due', 'Patients']) assert.match(figures, new RegExp(label));
    assert.match(figures, /Waiting for results\s*2/);
    assert.ok(await page.locator('.quick-actions-bar').count(), 'quick actions bar');
    assert.equal(await page.locator('.dashboard-footnote').count(), 0, 'no developer footnote');
  });

  await step('bills: one contextual action - Pay on the unpaid bill, Results on the paid one', async () => {
    await page.goto(BASE + '/cases/bills', { waitUntil: 'networkidle' }); await page.waitForTimeout(600);
    const unpaid = page.locator('table tbody tr', { hasText: 'Meera Iyer' }).first();
    const paid = page.locator('table tbody tr', { hasText: 'Karan Malhotra' }).first();
    assert.ok(await unpaid.getByRole('button', { name: /^Pay / }).count(), 'Pay on unpaid');
    assert.equal(await paid.getByRole('button', { name: /^Pay / }).count(), 0);
    assert.ok(await paid.getByRole('button', { name: /^Results / }).count(), 'Results on paid');
    await unpaid.getByRole('button', { name: /^Pay / }).click();
    const modal = page.getByRole('dialog'); await modal.waitFor();
    await modal.getByRole('button', { name: 'Log Payment' }).click(); await page.waitForTimeout(1200);
    assert.match(await page.locator('table tbody tr', { hasText: 'Meera Iyer' }).first().innerText(), /Paid/);
    // Everything else sits in the ⋯ menu.
    await paid.locator('button.row-menu-trigger').click();
    const items = await page.getByRole('menuitem').allInnerTexts();
    for (const label of ['Details', 'Download PDF', 'Print labels']) assert.ok(items.includes(label), label);
    await page.keyboard.press('Escape');
  });

  await step('filters: panel + removable chip', async () => {
    await page.goto(BASE + '/cases/bills', { waitUntil: 'networkidle' }); await page.waitForTimeout(500);
    await page.getByRole('button', { name: /^Filters/ }).click();
    await page.getByRole('dialog', { name: 'Filters' }).getByLabel('Payment status').selectOption({ label: 'Paid' });
    await page.getByRole('dialog', { name: 'Filters' }).getByRole('button', { name: 'Apply' }).click(); await page.waitForTimeout(800);
    assert.match(await page.locator('.afb-chip').first().innerText(), /Payment status:\s*Paid/);
    await page.getByRole('button', { name: 'Remove filter Payment status' }).click(); await page.waitForTimeout(800);
    assert.equal(await page.locator('.afb-chip').count(), 0, 'chip removed');
  });

  await step("today's reports: age · sex beside the name, one action + ⋯", async () => {
    await page.goto(BASE + '/lab/reports', { waitUntil: 'networkidle' }); await page.waitForTimeout(600);
    const row = page.locator('table tbody tr', { hasText: 'Meera Iyer' }).first();
    assert.match(await row.locator('.identity-clinical').innerText(), /34 Y · F/);
    assert.ok(await row.getByRole('button', { name: /Enter results/ }).count());
    assert.match(await row.innerText(), /Complete Blood Count/);
    await row.locator('button.row-menu-trigger').click();
    assert.ok((await page.getByRole('menuitem').allInnerTexts()).includes('Delete report'));
    await page.keyboard.press('Escape');
  });

  await step('result entry and verification lists keep age · sex visible', async () => {
    await page.goto(BASE + '/lab/result-entry', { waitUntil: 'networkidle' }); await page.waitForTimeout(600);
    assert.match(await page.locator('table tbody tr', { hasText: 'Karan Malhotra' }).first().locator('.identity-clinical').innerText(), /51 Y · M/);
    assert.doesNotMatch(await page.locator('table tbody').innerText(), /\bfalse\b/);
  });

  await step('patients: New bill opens the bill form with the patient filled in', async () => {
    await page.goto(BASE + '/cases/patients', { waitUntil: 'networkidle' }); await page.waitForTimeout(600);
    await page.locator('table tbody tr', { hasText: 'Karan Malhotra' }).first().getByRole('button', { name: /New bill for/ }).click();
    await page.waitForURL(/\/cases\/bills\/new/); await page.waitForTimeout(1200);
    assert.match(await page.locator('main').innerText(), /Karan Malhotra/);
  });

  await step('dues: summary matches the dashboard balance', async () => {
    await page.goto(BASE + '/business/dues', { waitUntil: 'networkidle' }); await page.waitForTimeout(800);
    assert.match(await page.locator('.stat-group').innerText(), /Total balance due\s*₹0\.00[\s\S]*Bills with a balance\s*0/);
  });

  await step('phone: lists become labelled cards with the action visible', async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(BASE + '/cases/bills', { waitUntil: 'networkidle' }); await page.waitForTimeout(600);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1), false, 'no sideways scroll');
    const row = page.locator('table tbody tr', { hasText: 'Karan Malhotra' }).first();
    assert.ok(await row.locator('td[data-label="Total"]').count(), 'cells carry labels');
    assert.ok(await row.getByRole('button', { name: /^Results / }).isVisible(), 'action visible on phone');
    await page.screenshot({ path: path.join(OUT, 'v2-phone-bills.png') });
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  await step('switch back to Classic from the dashboard banner', async () => {
    await page.goto(BASE + '/dashboard', { waitUntil: 'networkidle' }); await page.waitForTimeout(500);
    await page.getByRole('button', { name: 'Switch back to classic' }).click();
    assert.equal(await page.evaluate(() => document.documentElement.classList.contains('ui-v2')), false);
    assert.ok(await page.locator('.dashboard-stats-grid').count(), 'classic dashboard back');
  });

  console.log(results.join('\n'));
  await browser.close(); await env.stop();
})().catch((e) => { console.error(e); process.exit(1); });
