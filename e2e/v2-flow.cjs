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

  await step('new bill: referral visible, doctor added in place, bill created', async () => {
    assert.ok(await page.locator('.page-tip').isVisible(), 'tip shown under the title');
    const fit = await page.evaluate(() => {
      const tall = [...document.querySelectorAll('body *')].filter((el) => el.getBoundingClientRect().bottom > window.innerHeight + 2 && getComputedStyle(el).position !== 'fixed')
        .map((el) => `${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]}:${Math.round(el.getBoundingClientRect().bottom)}`).slice(0, 8);
      return { page: document.scrollingElement.scrollHeight, win: window.innerHeight, pay: Math.round(document.querySelector('.bill-pay').getBoundingClientRect().bottom), tall };
    });
    assert.ok(fit.pay <= fit.win && fit.page <= fit.win + 2, `new bill fits the window: ${JSON.stringify(fit)}`);
    assert.ok(await page.getByRole('combobox', { name: 'Referred by' }).isVisible(), 'Referred by visible without opening anything');
    assert.ok(await page.getByRole('combobox', { name: 'Collection agent' }).isVisible(), 'Collection agent visible');
    await page.getByRole('button', { name: 'New doctor' }).click();
    const doctorPanel = page.locator('.modal-content--drawer'); await doctorPanel.waitFor({ timeout: 5000 });
    await doctorPanel.getByLabel(/Doctor name/).fill('Dr Quick Add');
    await doctorPanel.getByLabel(/Phone number/).fill('9811100000');
    await doctorPanel.getByRole('button', { name: 'Add doctor' }).click(); await page.waitForTimeout(800);
    assert.equal(await doctorPanel.count(), 0, 'panel closes after adding');
    assert.equal(await page.getByRole('combobox', { name: 'Referred by' }).inputValue(), 'Dr Quick Add');
    // The doctor list is searchable: type part of the name, Enter picks it.
    await page.getByRole('button', { name: 'Clear Referred by' }).click();
    await page.getByRole('combobox', { name: 'Referred by' }).click();
    await page.keyboard.type('quick'); await page.keyboard.press('Enter');
    assert.equal(await page.getByRole('combobox', { name: 'Referred by' }).inputValue(), 'Dr Quick Add', 'found by typing');
    assert.match(page.url(), /\/cases\/bills\/new/, 'still on the bill');
    const deptOptions = await page.getByLabel('Show tests from department').locator('option').allInnerTexts();
    assert.ok(!deptOptions.some((o) => /OUTSOURCE/.test(o)), `no Outsource in departments: ${deptOptions}`);
    await page.getByRole('button', { name: 'Outsource test' }).click(); await page.waitForTimeout(300);
    await page.keyboard.press('Escape'); await page.waitForTimeout(300);
    assert.doesNotMatch(await page.locator('.bill-step-tests').innerText(), /send-out tests/i, 'closing the outsource form changes nothing');
    assert.equal(await page.getByLabel('Show tests from department').inputValue(), 'ALL');
    await page.getByLabel(/Type a test name/).fill('Complete Blood');
    await page.keyboard.press('Enter'); await page.waitForTimeout(400);
    const total = (await page.locator('.bill-summary-column').innerText()).match(/Total\s*₹([\d,]+(?:\.\d+)?)/)[1].replace(/,/g, '');
    assert.ok(Number(total) > 0, 'test added');
    await page.getByRole('button', { name: '+ Add', exact: true }).click();
    await page.getByLabel('Amount received now', { exact: true }).fill('100');
    const tops = await page.locator('.bill-pay .pay-label').evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().top)));
    assert.equal(new Set(tops).size, 1, `payment bar labels on one line: ${tops}`);
    await page.locator('.bill-pay').screenshot({ path: path.join(OUT, 'v2-pay-bar.png') });
    await page.getByLabel('Amount received now', { exact: true }).fill(total);
    await page.keyboard.press('Enter'); await page.waitForTimeout(1500);
    const latest = (await env.mongoose.model('Bill').find({}).sort({ createdAt: -1 }).limit(1).populate('referringDoctor').lean())[0];
    assert.equal(latest.referringDoctor?.name, 'Dr Quick Add');
    assert.equal(Number(latest.dueAmount), 0);
  });

  await step('one search box: the top bar filters the bills list; tips can be closed', async () => {
    await page.goto(BASE + '/cases/bills', { waitUntil: 'networkidle' }); await page.waitForTimeout(800);
    const header = page.locator('[data-header-page-search]');
    assert.ok(await header.isVisible(), 'header search drives the page');
    assert.equal(await page.locator('main .afb-v2-row input[data-filter-text]:visible').count(), 0, 'no second search box');
    await header.fill('Meera'); await page.waitForTimeout(1500);
    const rows = await page.locator('table tbody tr').allInnerTexts();
    assert.ok(rows.length > 0 && rows.every((r) => /Meera/.test(r)), `only Meera rows: ${rows.length}`);
    await page.getByRole('button', { name: 'Hide this tip' }).click();
    await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(600);
    assert.equal(await page.locator('.page-tip').count(), 0, 'tip stays hidden');
  });

  await step('new patient: right-side panel, nothing lost when closed by mistake or reloaded', async () => {
    await page.goto(BASE + '/cases/bills/new', { waitUntil: 'networkidle' }); await page.waitForTimeout(800);
    await page.getByRole('button', { name: '+ New patient' }).click();
    const drawer = page.locator('.modal-content--drawer'); await drawer.waitFor({ timeout: 5000 });
    await drawer.getByPlaceholder('Phone number').fill('9822200000');
    await drawer.getByPlaceholder('First Name').fill('Asha');
    await page.keyboard.press('Escape'); await page.waitForTimeout(300);
    assert.equal(await drawer.count(), 0, 'panel closed');
    const summary = page.locator('.bill-new-patient-summary');
    assert.match(await summary.innerText(), /Asha[\s\S]*9822200000[\s\S]*Still needed: age/);
    await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(800);
    assert.match(await page.locator('.bill-new-patient-summary').innerText(), /Asha/, 'draft survives a reload');
    await page.getByRole('button', { name: 'Fill details' }).click();
    assert.equal(await page.locator('.modal-content--drawer').getByPlaceholder('First Name').inputValue(), 'Asha');
    await page.locator('.modal-content--drawer').getByLabel('Email').fill('asha@example.com');
    await page.locator('.modal-content--drawer').getByRole('button', { name: 'Done' }).click();
    assert.match(await page.locator('.bill-profile-link').innerText(), /1 added/, 'profile details counted on the card');
    assert.equal(await page.locator('.optional-field-badges').count(), 0, 'no + Email chips on the card');
    await page.locator('.modal-content--drawer').waitFor({ state: 'detached' });
    await page.evaluate(() => sessionStorage.clear());
  });

  await step('business: print has every row; Daily lists unpaid bills too', async () => {
    const billCount = await env.mongoose.model('Bill').countDocuments({ isVoided: { $ne: true } });
    await page.goto(BASE + '/business/cases', { waitUntil: 'networkidle' }); await page.waitForTimeout(800);
    await page.evaluate(() => { window.__pplPrinted = null; window.__pplPrintCapture = (html) => { window.__pplPrinted = html; }; });
    await page.getByRole('button', { name: /^Print$/ }).click();
    await page.waitForFunction(() => window.__pplPrinted, null, { timeout: 8000 });
    const html = await page.evaluate(() => window.__pplPrinted);
    const rows = (html.match(/<tbody>[\s\S]*?<\/tbody>/)[0].match(/<tr>/g) || []).length;
    assert.equal(rows, billCount, 'case-wise print lists every bill');
    assert.doesNotMatch(html, /button|Physical Signature/i, 'no app buttons or bill footer on paper');
    await page.goto(BASE + '/business/daily', { waitUntil: 'networkidle' }); await page.waitForTimeout(1200);
    assert.ok(await page.getByRole('tab', { name: `Bills made (${billCount})` }).count(), 'every bill made today is listed, paid or not');
    // A date range cannot run backwards: picking a To before From moves From.
    await page.getByRole('button', { name: /^Filters/ }).first().click();
    const panel = page.getByRole('dialog', { name: 'Filters' });
    const earlier = await page.evaluate(() => { const d = new Date(); d.setDate(d.getDate() - 3); return d.toLocaleDateString('en-CA'); });
    assert.equal(await panel.getByLabel('To', { exact: true }).getAttribute('min'), await panel.getByLabel('From', { exact: true }).inputValue(), 'To cannot be before From');
    await panel.getByLabel('To', { exact: true }).fill(earlier); await page.waitForTimeout(300);
    assert.equal(await panel.getByLabel('From', { exact: true }).inputValue(), earlier, 'From follows when To moves earlier');
    await page.keyboard.press('Escape');
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

  await step('side panel, Daily work links, empty-state action', async () => {
    await page.goto(BASE + '/cases/bills', { waitUntil: 'networkidle' }); await page.waitForTimeout(500);
    await page.locator('table tbody tr', { hasText: 'Karan Malhotra' }).first().locator('.bill-number-link').click();
    await page.locator('.modal-content--drawer').waitFor({ timeout: 5000 });
    assert.match(await page.locator('.modal-content--drawer').innerText(), /Karan Malhotra/);
    await page.keyboard.press('Escape');
    const daily = await page.locator('.sidebar-section').innerText();
    for (const label of ['Daily work', 'Bills', "Today's reports", 'Result entry', 'Verification', 'Patients', 'Dues']) assert.match(daily, new RegExp(label));
    await page.goto(BASE + '/usg/today', { waitUntil: 'networkidle' }); await page.waitForTimeout(600);
    assert.ok(await page.locator('.empty-state-action').getByRole('button', { name: 'Create USG case' }).count(), 'empty USG list offers Create USG case');
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
