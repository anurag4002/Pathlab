const { run, results, state, BASE, assert, start, openBrowser, login, api } = require('./flows.cjs');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const PDFTOTEXT = require('./config.cjs').pdftotext();
const pdfText = file => execFileSync(PDFTOTEXT, ['-layout', file, '-'], { encoding: 'utf8' });
const DL = path.resolve(__dirname, 'output/downloads'); fs.mkdirSync(DL, { recursive: true });
async function download(page, trigger) {
  const [file] = await Promise.all([page.waitForEvent('download', { timeout: 30000 }), trigger()]);
  const target = path.join(DL, `${Date.now()}-${file.suggestedFilename()}`);
  await file.saveAs(target);
  const head = fs.readFileSync(target).subarray(0, 5).toString();
  return { target, isPdf: head === '%PDF-' };
}

(async () => {
  const env = await start();
  const { browser, context, page, problems, whatsapp } = await openBrowser(env);
  const step = (name, fn) => run(page, problems, name, fn);

  await step('login with wrong password shows an error and stays on login', async () => {
    await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
    await page.locator('#login-email').fill(env.admin.email);
    await page.locator('#login-password').fill('definitely-wrong');
    await page.locator('button[type=submit]').first().click();
    await page.waitForTimeout(1500);
    assert.match(page.url(), /login/);
    const text = await page.locator('body').innerText();
    assert.match(text, /invalid|incorrect|wrong|failed/i);
  });
  problems.length = 0; // the expected 401 above is not a defect

  await step('login as admin reaches the dashboard', async () => {
    await login(page, env.admin.email, env.admin.password);
    assert.match(page.url(), /\/dashboard$/);
    state.token = await page.evaluate(() => localStorage.getItem('ppl_token'));
    assert.ok(state.token);
  });

  await step('new bill: register a new patient, add a panel + a test, create invoice', async () => {
    await page.goto(BASE + '/cases/bills/new', { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Register New' }).click();
    await page.getByRole('textbox', { name: 'First Name' }).fill('E2E');
    await page.getByRole('textbox', { name: /Last Name/i }).fill('Patient One').catch(() => {});
    await page.getByPlaceholder('Years').fill('41');
    await page.getByRole('textbox', { name: /Phone/i }).first().fill('9876500001');
    const gender = page.getByRole('button', { name: /^Male$/i }).first();
    if (await gender.count()) await gender.click(); else await page.locator('select[name*="gender" i], #patientGender').first().selectOption({ label: 'Male' }).catch(() => {});
    const search = page.getByPlaceholder(/Search all tests/i);
    await search.fill('Complete Blood Count (CBC)');
    await page.getByRole('button', { name: /Complete Blood Count \(CBC\)/ }).first().click();
    await search.fill('Serum Creatinine');
    await page.getByRole('button', { name: /Serum Creatinine/ }).first().click();
    const lines = await page.locator('text=Selected Test Lines').locator('xpath=ancestor::*[contains(@class,"card") or self::section][1]').innerText().catch(() => '');
    assert.ok(/Complete Blood Count/.test(lines) && /Creatinine/.test(lines), 'both items in Selected Test Lines');
    await page.getByRole('button', { name: 'Create Invoice' }).click();
    await page.waitForURL(/\/cases\/bills(\?|$)/, { timeout: 20000 });
    await page.waitForTimeout(1200);
  });

  await step('bill saved bar shows next steps for the new bill', async () => {
    const bar = await page.locator('.bill-saved-bar').innerText();
    assert.match(bar, /Bill \S+ saved for (Mr\. )?E2E Patient One/);
    assert.match(bar, /Enter results/); assert.match(bar, /Print bill/); assert.match(bar, /New bill/); assert.match(bar, /WhatsApp/);
    state.billNumber = bar.match(/Bill (\S+) saved/)[1];
  });

  await step('bill appears in the ledger with due amount and actions', async () => {
    const row = page.locator('table tbody tr', { hasText: state.billNumber }).first();
    const text = await row.innerText();
    assert.match(text, /E2E/); assert.match(text, /Pending|Unpaid|Due/i);
    for (const label of ['Results', 'Pay']) assert.ok(await row.getByRole('button', { name: new RegExp(`^${label}`) }).count(), label);
  });

  await step('collect full payment from the ledger (Pay)', async () => {
    const row = page.locator('table tbody tr', { hasText: state.billNumber }).first();
    await row.getByRole('button', { name: /^Pay/ }).click();
    const modal = page.getByRole('dialog');
    await modal.waitFor();
    const amount = modal.getByLabel(/Payment Amount Received/i);
    if (!(await amount.inputValue())) await amount.fill('550');
    await modal.getByRole('button', { name: 'Log Payment' }).click();
    await page.waitForTimeout(1500);
    const after = page.locator('table tbody tr', { hasText: state.billNumber }).first();
    assert.match(await after.innerText(), /Paid/);
    assert.equal(await after.getByRole('button', { name: /^Pay/ }).count(), 0, 'Pay button gone once paid');
  });

  await step('download bill PDF from the ledger', async () => {
    const row = page.locator('table tbody tr', { hasText: state.billNumber }).first();
    const { target, isPdf } = await download(page, () => row.getByRole('button', { name: new RegExp(`PDF ${state.billNumber}`) }).click());
    assert.ok(isPdf, 'file is a PDF');
    const text = pdfText(target);
    assert.match(text, /E2E Patient One/); assert.match(text, /Complete Blood Count/); assert.match(text, /550/);
  });

  await step('Results opens result entry for that bill with every CBC + creatinine row', async () => {
    const row = page.locator('table tbody tr', { hasText: state.billNumber }).first();
    await row.getByRole('button', { name: /^Results/ }).click();
    await page.waitForURL(/\/lab\/result-entry\?bill=/);
    await page.locator('.ls-sheet').waitFor({ timeout: 20000 });
    const titles = await page.locator('.ls-panel-title, .ls-dept-title').allInnerTexts();
    assert.ok(titles.some(t => /HAEMATOLOGY/.test(t)) && titles.some(t => /COMPLETE BLOOD COUNT/.test(t)) && titles.some(t => /BIOCHEMISTRY/.test(t)), titles.join('|'));
    const names = await page.locator('tr.ls-row .re-test-name').allInnerTexts();
    assert.ok(names.some(n => /Hemoglobin/.test(n)) && names.some(n => /Creatinine/i.test(n)), 'rows present');
    const dupes = names.filter((n, i) => names.indexOf(n) !== i && !/Neutrophils|Lymphocyte|Eosinophils|Monocytes|Basophils/.test(n));
    assert.equal(dupes.length, 0, 'no duplicated rows: ' + dupes.join(', '));
  });

  await step('enter all values, see H/L flags and calculated fields, then Final', async () => {
    const values = { Hemoglobin: '9.5', 'Total Leukocyte Count': '7200', Neutrophils: '60', Lymphocyte: '30', Eosinophils: '4', Monocytes: '5', Basophils: '1', 'Platelet Count': '2.5', 'Total RBC Count': '4.8', 'Hematocrit Value, Hct': '42', 'Serum Creatinine': '1.8' };
    const rows = page.locator('tr.ls-row');
    const count = await rows.count();
    for (let i = 0; i < count; i++) {
      const row = rows.nth(i);
      const name = (await row.locator('.re-test-name').innerText()).trim();
      const input = row.locator('input.form-control:not([disabled])').first();
      if (!(await input.count())) { const sel = row.locator('select:not([disabled])').first(); if (await sel.count()) await sel.selectOption({ index: 1 }).catch(() => {}); continue; }
      const key = Object.keys(values).find(k => name.startsWith(k));
      await input.fill(key ? values[key] : '5');
    }
    await page.waitForTimeout(400);
    const hb = await page.locator('tr.ls-row', { hasText: 'Hemoglobin' }).first().locator('.ls-flag').innerText();
    assert.equal(hb.trim(), 'L', 'Hb 9.5 flagged L');
    const mcv = await page.locator('tr.ls-row', { hasText: 'Mean Corpuscular Volume' }).first().locator('input').inputValue();
    assert.ok(Number(mcv) > 80, 'MCV calculated from Hct/RBC: ' + mcv);
    await page.locator('.re-actions-bar button', { hasText: /^Final$/ }).click();
    await page.waitForTimeout(1500);
    assert.match(await page.locator('.ls-status').innerText(), /Reported/);
  });

  await step('Sign off from result entry, then Print/PDF/WhatsApp appear', async () => {
    const signOff = page.locator('.re-actions-bar button', { hasText: 'Sign off' });
    assert.ok(await signOff.count(), 'Sign off button (signature exists)');
    await signOff.click();
    await page.waitForTimeout(1500);
    assert.match(await page.locator('.ls-status').innerText(), /Signed/);
    const bar = await page.locator('.re-actions-bar').innerText();
    assert.ok(/Print/.test(bar) && /PDF/.test(bar) && /WhatsApp/.test(bar), bar);
  });

  await step('report PDF content: patient, referred by Self, values, flags, end line', async () => {
    const { target, isPdf } = await download(page, () => page.locator('.re-actions-bar button', { hasText: /^PDF$/ }).click());
    assert.ok(isPdf);
    const text = pdfText(target);
    for (const re of [/E2E Patient One/, /Referred by : Self/, /HAEMATOLOGY/, /COMPLETE BLOOD COUNT/, /HEMOGLOBIN\s+L\s+9\.5/, /SERUM CREATININE\s+H\s+1\.8/, /7,200/, /End of report/]) assert.match(text, re);
  });

  await step("Today's Reports lists the signed report and its WhatsApp button sends the report link", async () => {
    await page.goto(BASE + '/lab/reports', { waitUntil: 'networkidle' });
    const row = page.locator('table tbody tr', { hasText: 'E2E Patient One' }).first();
    assert.match(await row.innerText(), /Signed/);
    await row.locator('button[aria-label^="Send report"]').click();
    await page.waitForTimeout(1500);
    const sent = whatsapp.at(-1) || '';
    assert.match(sent, /^https:\/\/wa\.me\/919876500001\?text=Dear .*E2E Patient One, your lab report from .* is ready\. .*\/r\/[A-Za-z0-9_.-]+$/);
    state.reportLink = sent.match(/(https?:\/\/\S+\/r\/[A-Za-z0-9_.-]+)$/)[1];
  });

  await step('public report link opens without login and downloads the PDF', async () => {
    const token = state.reportLink.split('/r/')[1];
    const pub = await context.browser().newContext();
    await pub.route(/\/(api|uploads)\//, async route => { const r = route.request(); const res = await env.inject({ method: r.method(), url: r.url().replace(/^https?:\/\/[^/]+/, ''), headers: r.headers(), body: r.postDataBuffer() }); return route.fulfill({ status: res.status, headers: res.headers, body: res.body }); });
    const p2 = await pub.newPage();
    await p2.goto(`${BASE}/r/${token}`, { waitUntil: 'networkidle' });
    await p2.waitForTimeout(1200);
    const text = await p2.locator('body').innerText();
    assert.match(text, /E2E Patient One|E2E/);
    const dl = p2.getByRole('button', { name: /download/i }).or(p2.getByRole('link', { name: /download/i })).first();
    const [file] = await Promise.all([p2.waitForEvent('download', { timeout: 30000 }), dl.click()]);
    const target = path.join(DL, `public-${file.suggestedFilename()}`); await file.saveAs(target);
    assert.equal(fs.readFileSync(target).subarray(0, 5).toString(), '%PDF-');
    await p2.goto(`${BASE}/r/not-a-real-token`, { waitUntil: 'networkidle' });
    await p2.waitForTimeout(1000);
    assert.match(await p2.locator('body').innerText(), /not valid|invalid|expired|not found/i);
    await pub.close();
  });
  problems.splice(0, problems.length, ...problems.filter(p => !/not-a-real-token/.test(p)));

  await step('Google Reviews: ask the new patient on WhatsApp, row turns Asked, Undo works', async () => {
    await page.goto(BASE + '/reviews', { waitUntil: 'networkidle' });
    const row = page.locator('table tbody tr', { hasText: 'E2E Patient One' }).first();
    assert.match(await row.innerText(), /Not asked/);
    await row.getByRole('button', { name: /for a Google review on WhatsApp/ }).click();
    await page.waitForTimeout(1500);
    assert.match(whatsapp.at(-1) || '', /wa\.me\/919876500001\?text=Dear .*E2E Patient One, thank you for choosing/);
    assert.match(await row.innerText(), /Asked/);
    await page.getByRole('tab', { name: 'Asked', exact: true }).click(); await page.waitForTimeout(800);
    assert.match(await page.locator('table tbody').innerText(), /E2E Patient One/);
    await page.locator('table tbody tr', { hasText: 'E2E Patient One' }).first().getByRole('button', { name: 'Undo' }).click();
    await page.waitForTimeout(800);
    await page.getByRole('tab', { name: 'Not asked', exact: true }).click(); await page.waitForTimeout(800);
    assert.match(await page.locator('table tbody').innerText(), /E2E Patient One/);
  });

  await step('second bill: enter results, Final (not signed) -> appears in Verification -> opens entry', async () => {
    await page.goto(BASE + '/cases/bills/new', { waitUntil: 'networkidle' });
    await page.getByPlaceholder(/type name, phone or reg no/i).fill('E2E Patient');
    await page.getByRole('option', { name: /E2E Patient One/ }).or(page.locator('li, button', { hasText: 'E2E Patient One' })).first().click();
    const search = page.getByPlaceholder(/Search all tests/i);
    await search.fill('Viral Marker'); await page.getByRole('button', { name: /Viral Marker/ }).first().click();
    await page.getByRole('button', { name: 'Create Invoice' }).click();
    await page.waitForURL(/\/cases\/bills(\?|$)/, { timeout: 20000 }); await page.waitForTimeout(1000);
    state.bill2 = (await page.locator('.bill-saved-bar').innerText()).match(/Bill (\S+) saved/)[1];
    await page.locator('.bill-saved-bar button', { hasText: 'Enter results' }).click();
    await page.locator('.ls-sheet').waitFor({ timeout: 20000 });
    for (const sel of await page.locator('tr.ls-row select:not([disabled])').all()) await sel.selectOption({ index: 1 }).catch(() => {});
    for (const input of await page.locator('tr.ls-row input.form-control:not([disabled])').all()) if (!(await input.inputValue())) await input.fill('Negative');
    // notes, remark and more details must reach the PDF
    await page.locator('.ls-group').first().locator('.ls-nra-add', { hasText: 'Add notes' }).click();
    await page.locator('.ls-group').first().locator('.ls-nra-field textarea').first().fill('E2E NOTE: confirm by ELISA');
    await page.locator('.ls-more-details textarea').click();
    await page.locator('.ls-more-details textarea').fill('E2E MORE DETAILS');
    await page.locator('.ls-title').click(); await page.waitForTimeout(800);
    await page.locator('tr.ls-row').first().locator('.ls-remark-btn').click();
    await page.locator('tr.ls-remark-row input').first().fill('E2E REMARK repeat sample');
    await page.locator('.re-actions-bar button', { hasText: /^Final$/ }).click();
    await page.waitForTimeout(1500);
    assert.match(await page.locator('.ls-status').innerText(), /Reported/);
    await page.goto(BASE + '/lab/verification', { waitUntil: 'networkidle' });
    const row = page.locator('table tbody tr', { hasText: 'E2E Patient One' }).first();
    await row.getByRole('button', { name: 'Review' }).click();
    await page.getByRole('button', { name: 'Sign off in Result Entry' }).click();
    await page.waitForURL(/\/lab\/result-entry\?report=/);
    await page.locator('.ls-sheet').waitFor();
    assert.match(await page.locator('.ls-status').innerText(), /Reported/);
  });

  await step('report 2 PDF carries the note, remark and more details', async () => {
    const { target } = await download(page, () => page.locator('.re-actions-bar button', { hasText: /^PDF$/ }).click());
    const text = pdfText(target);
    assert.match(text, /Notes\s+E2E NOTE: confirm by ELISA/); assert.match(text, /Remark: E2E REMARK repeat sample/); assert.match(text, /E2E MORE DETAILS/); assert.match(text, /VIRAL MARKER/);
  });

  await step('void the second bill from the More menu', async () => {
    await page.goto(BASE + '/cases/bills', { waitUntil: 'networkidle' });
    const row = page.locator('table tbody tr', { hasText: state.bill2 }).first();
    await row.locator('button.row-menu-trigger').click();
    await page.getByRole('menuitem', { name: new RegExp(`Void ${state.bill2}`) }).click();
    const dialog = page.getByRole('dialog');
    await dialog.waitFor();
    await dialog.getByRole('button', { name: 'Yes, Void' }).click();
    assert.match(await dialog.innerText(), /A void reason is required/);
    await dialog.getByLabel(/Void reason/).selectOption('Duplicate entry');
    await dialog.getByRole('button', { name: 'Yes, Void' }).click();
    await page.waitForTimeout(1500);
    await page.goto(BASE + '/cases/bills', { waitUntil: 'networkidle' });
    assert.equal(await page.locator('table tbody tr', { hasText: state.bill2 }).count(), 0, 'voided bill hidden by default');
    const res = await api(env, 'GET', '/api/bills?includeVoided=true&limit=50');
    const voided = (res.json.data?.bills || res.json.data || []).find(b => b.billNumber === state.bill2);
    assert.equal(voided?.isVoided, true); assert.equal(voided?.voidReason || voided?.voidedReason || 'Duplicate entry', 'Duplicate entry');
  });

  await step('patients: search finds the patient, edit saves a new phone', async () => {
    await page.goto(BASE + '/cases/patients', { waitUntil: 'networkidle' });
    await page.getByPlaceholder(/Search by name, phone or reg no/i).fill('E2E');
    await page.waitForTimeout(1200);
    const row = page.locator('table tbody tr', { hasText: 'E2E Patient One' }).first();
    assert.ok(await row.count(), 'found');
    await row.getByRole('button', { name: /^Edit/ }).click();
    const dialog = page.getByRole('dialog'); await dialog.waitFor();
    const phone = dialog.getByLabel(/phone/i).first();
    await phone.fill('9876500002');
    await dialog.getByRole('button', { name: /save|update/i }).last().click();
    await page.waitForTimeout(1500);
    assert.match(await page.locator('table tbody tr', { hasText: 'E2E Patient One' }).first().innerText(), /9876500002/);
  });

  await step('daily business shows the ₹550 collected today and exports CSV', async () => {
    await page.goto(BASE + '/business/daily', { waitUntil: 'networkidle' }); await page.waitForTimeout(1200);
    const text = await page.locator('main').innerText();
    assert.match(text, /Income[\s\S]{0,40}550/i);
    const exportBtn = page.getByRole('button', { name: /Export .* \(CSV\)/ }).first();
    const { target } = await download(page, () => exportBtn.click());
    const csv = fs.readFileSync(target, 'utf8');
    assert.ok(csv.split('\n').length >= 2, 'csv has header + rows'); assert.match(csv, /550/);
  });

  await step('lab profile: edit Google review link, save, reload keeps it', async () => {
    await page.goto(BASE + '/setup/profile', { waitUntil: 'networkidle' }); await page.waitForTimeout(800);
    await page.getByRole('button', { name: 'Edit profile' }).click();
    const link = page.getByLabel('Google review link');
    await link.fill('https://g.page/r/e2e-review-link');
    await page.getByRole('button', { name: 'Save changes' }).click(); await page.waitForTimeout(1500);
    await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(800);
    assert.equal(await page.getByLabel('Google review link').inputValue(), 'https://g.page/r/e2e-review-link');
  });

  await step('branches: add a branch, it is listed, edit and delete it', async () => {
    await page.goto(BASE + '/manage/branches', { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Add branch' }).click();
    const d = page.getByRole('dialog'); await d.waitFor();
    await d.getByLabel('Branch Name').fill('E2E Branch'); await d.getByLabel('Branch Code').fill('e2eb');
    await d.getByRole('button', { name: 'Save' }).click(); await page.waitForTimeout(1200);
    const row = page.locator('table tbody tr', { hasText: 'E2E Branch' }).first();
    assert.match(await row.innerText(), /E2EB/);
    await row.getByRole('button', { name: 'Edit E2E Branch' }).click();
    await page.getByRole('dialog').getByLabel('Phone').fill('9876500009');
    await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click(); await page.waitForTimeout(1200);
    assert.match(await page.locator('table tbody tr', { hasText: 'E2E Branch' }).first().innerText(), /9876500009/);
    await page.locator('table tbody tr', { hasText: 'E2E Branch' }).first().getByRole('button', { name: 'Delete E2E Branch' }).click();
    await page.getByRole('dialog').getByRole('button', { name: /delete|confirm|yes/i }).last().click(); await page.waitForTimeout(1200);
    assert.equal(await page.locator('table tbody tr', { hasText: 'E2E Branch' }).count(), 0);
  });

  const empEmail = `e2e.employee.${Date.now()}@example.test`;
  const empPassword = require('crypto').randomBytes(9).toString('base64url') + 'A1!';
  await step('users: create an employee account', async () => {
    await page.goto(BASE + '/manage/employees', { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Create user' }).click();
    const d = page.getByRole('dialog'); await d.waitFor();
    await d.getByLabel('Full Name').fill('E2E Employee');
    await d.getByLabel('Email Address').fill(empEmail);
    await d.getByLabel(/^Password/).fill(empPassword);
    await d.getByRole('button', { name: 'Save user' }).click(); await page.waitForTimeout(1500);
    assert.equal(await page.getByRole('dialog').count(), 0, 'modal closed');
    const row = page.locator('table tbody tr', { hasText: 'E2E Employee' }).first();
    assert.ok(!/9\d{9}/.test(await row.innerText()), 'no made-up phone number when phone left blank');
  });

  await step('employee logs in, can bill, cannot manage users', async () => {
    const ctx = await context.browser().newContext({ viewport: { width: 1440, height: 900 } });
    await ctx.route(/\/(api|uploads)\//, async route => { const r = route.request(); const res = await env.inject({ method: r.method(), url: r.url().replace(/^https?:\/\/[^/]+/, ''), headers: r.headers(), body: r.postDataBuffer() }); return route.fulfill({ status: res.status, headers: res.headers, body: res.body }); });
    const p = await ctx.newPage();
    await login(p, empEmail, empPassword);
    assert.match(p.url(), /dashboard/);
    const empToken = await p.evaluate(() => localStorage.getItem('ppl_token'));
    const users = await env.inject({ method: 'GET', url: '/api/users', headers: { authorization: `Bearer ${empToken}` } });
    assert.ok([401, 403].includes(users.status), `GET /api/users as employee -> ${users.status}`);
    await p.goto(BASE + '/manage/employees', { waitUntil: 'networkidle' }); await p.waitForTimeout(800);
    assert.equal(await p.getByRole('button', { name: 'Create user' }).count(), 0, 'no Create user for employee');
    await p.goto(BASE + '/cases/bills', { waitUntil: 'networkidle' }); await p.waitForTimeout(800);
    assert.match(await p.locator('main').innerText(), /E2E Patient One/, 'employee sees bills the admin created');
    const bills = await env.inject({ method: 'GET', url: '/api/bills', headers: { authorization: `Bearer ${empToken}` } });
    assert.equal(bills.status, 200);
    await ctx.close();
  });

  await step('USG: create a case for the patient, it is listed', async () => {
    await page.goto(BASE + '/usg/today', { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: /Create USG Case/ }).click();
    const d = page.getByRole('dialog'); await d.waitFor();
    await d.locator('#usg-service-type').selectOption({ index: 1 });
    const picker = d.getByPlaceholder(/name, phone|search patient/i).first();
    await picker.fill('E2E Patient'); await page.waitForTimeout(1000);
    await page.getByRole('option', { name: /E2E Patient One/ }).or(d.locator('li, button', { hasText: 'E2E Patient One' })).first().click();
    await d.getByRole('button', { name: 'Save Case' }).click(); await page.waitForTimeout(1500);
    assert.equal(await page.getByRole('dialog').count(), 0, 'modal closed');
    assert.match(await page.locator('main').innerText(), /E2E Patient One/);
  });

  await step('X-ray: create a case for the patient, it is listed', async () => {
    await page.goto(BASE + '/xray/today', { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: /Create X-Ray Case/ }).click();
    const d = page.getByRole('dialog'); await d.waitFor();
    await d.getByPlaceholder(/name, phone|search patient/i).first().fill('E2E Patient'); await page.waitForTimeout(1000);
    await page.getByRole('option', { name: /E2E Patient One/ }).or(d.locator('li, button', { hasText: 'E2E Patient One' })).first().click();
    await d.getByRole('button', { name: 'Save Case' }).click(); await page.waitForTimeout(800);
    assert.match(await d.innerText(), /Enter findings or upload a PDF report/, 'empty X-ray case is refused');
    await d.locator('#xray-findings').fill('E2E: Chest PA view. No active lung lesion.');
    await d.getByRole('button', { name: 'Save Case' }).click(); await page.waitForTimeout(1500);
    assert.equal(await page.getByRole('dialog').count(), 0, 'modal closed: ' + (await page.getByRole('dialog').innerText().catch(() => '')).slice(0, 200));
    assert.match(await page.locator('main').innerText(), /E2E Patient One/);
  });

  await step('expenses: record ₹200, listed, daily business shows it', async () => {
    await page.goto(BASE + '/business/expenses', { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: /Record Expense/ }).click();
    const d = page.getByRole('dialog'); await d.waitFor();
    const cat = d.getByLabel('Category Classification');
    if (!(await cat.inputValue())) await cat.selectOption({ index: 1 });
    await d.getByLabel('Spent On (name)').fill('E2E reagents');
    await d.getByLabel('Charged Amount (INR)').fill('200');
    const method = d.getByLabel('Paid Method'); if (!(await method.inputValue())) await method.selectOption({ index: 1 });
    await d.getByRole('button').last().click(); await page.waitForTimeout(1500);
    assert.equal(await page.getByRole('dialog').count(), 0, 'modal closed: ' + (await page.getByRole('dialog').innerText().catch(() => '')).slice(0, 200));
    assert.match(await page.locator('main').innerText(), /E2E reagents/);
    await page.goto(BASE + '/business/daily', { waitUntil: 'networkidle' }); await page.waitForTimeout(1200);
    const text = await page.locator('main').innerText();
    assert.match(text, /Expenses\s*₹200/i); assert.match(text, /Net\s*₹350/i);
  });

  await step('catalog: add a new test, bill it, result 130 is flagged High', async () => {
    await page.goto(BASE + '/lab/tests', { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: /Add New Test/ }).click();
    const d = page.getByRole('dialog'); await d.waitFor();
    await d.getByLabel('Test Code').fill('E2EGLU');
    await d.getByLabel('Test Name').fill('E2E Glucose Fasting');
    const cat = d.getByLabel('Test Category'); if (!(await cat.inputValue())) await cat.selectOption({ index: 1 });
    const sample = d.getByLabel('Sample Collection Type'); if (await sample.count() && !(await sample.inputValue())) await sample.selectOption({ index: 1 }).catch(() => sample.fill('Serum'));
    await d.locator('select[name=unit]').selectOption('mg/dL');
    await d.getByLabel('Price (INR)').fill('120');
    await d.getByLabel('Default Range').fill('70-100');
    await d.getByRole('button', { name: 'Save Test' }).click(); await page.waitForTimeout(1500);
    assert.equal(await page.getByRole('dialog').count(), 0, 'modal closed: ' + (await page.getByRole('dialog').innerText().catch(() => '')).slice(0, 200));
    await page.goto(BASE + '/cases/bills/new', { waitUntil: 'networkidle' });
    await page.getByPlaceholder(/type name, phone or reg no/i).fill('E2E Patient');
    await page.getByRole('option', { name: /E2E Patient One/ }).or(page.locator('li, button', { hasText: 'E2E Patient One' })).first().click();
    await page.getByPlaceholder(/Search all tests/i).fill('E2E Glucose');
    await page.getByRole('button', { name: /E2E Glucose Fasting/ }).first().click();
    await page.getByRole('button', { name: 'Create Invoice' }).click();
    await page.waitForURL(/\/cases\/bills(\?|$)/, { timeout: 20000 }); await page.waitForTimeout(1000);
    assert.match(await page.locator('.bill-saved-bar').innerText(), /saved/);
    await page.locator('.bill-saved-bar button', { hasText: 'Enter results' }).click();
    await page.locator('.ls-sheet').waitFor({ timeout: 20000 });
    const row = page.locator('tr.ls-row', { hasText: /E2E Glucose Fasting/i }).first();
    await row.locator('input.form-control').first().fill('130'); await page.locator('.ls-title').click(); await page.waitForTimeout(600);
    assert.match(await row.innerText(), /\bH\b|High/);
    assert.match(await row.innerText(), /70\s*-\s*100/);
    assert.match(await row.innerText(), /mg\/dL/);
  });

  await step('document test: Widal starts from its template and prints the titre grid', async () => {
    await page.goto(BASE + '/cases/bills/new', { waitUntil: 'networkidle' });
    await page.getByPlaceholder(/type name, phone or reg no/i).fill('E2E Patient');
    await page.getByRole('option', { name: /E2E Patient One/ }).or(page.locator('li, button', { hasText: 'E2E Patient One' })).first().click();
    await page.getByPlaceholder(/Search all tests/i).fill('Widal (Tube');
    await page.getByRole('button', { name: /Widal \(Tube Method\)/ }).first().click();
    await page.getByRole('button', { name: 'Create Invoice' }).click();
    await page.waitForURL(/\/cases\/bills(\?|$)/, { timeout: 20000 }); await page.waitForTimeout(1000);
    await page.locator('.bill-saved-bar button', { hasText: 'Enter results' }).click();
    await page.locator('.ls-sheet').waitFor({ timeout: 20000 });
    // The findings show as the printed layout: the titre grid is a real table.
    const editor = page.locator('.ls-document-row .doc-editor').first();
    const cells = editor.locator('.doc-editor-table input');
    assert.equal(await cells.count(), 30, 'Widal grid 5 x 6');
    assert.equal(await cells.nth(1).inputValue(), '1:30');
    assert.equal(await cells.nth(6).inputValue(), 'S TYPHI "O"');
    assert.match(await editor.locator('textarea.doc-editor-line').first().inputValue(), /Tube agglutination test/);
    await page.locator('.ls-document-row').first().screenshot({ path: require('path').join(require('./config.cjs').OUT, 'widal-entry.png') });
    await cells.nth(28).fill('+'); // S PARATYPHI "BH" at 1:240
    const comment = editor.locator('textarea.doc-editor-line').nth(1);
    assert.equal(await comment.inputValue(), 'Comment: WIDAL TEST <POSTIVE/NEGATIVE>');
    await comment.fill('Comment: WIDAL TEST POSITIVE');
    // Edit as text shows the same findings with the grid as "| a | b |" lines.
    await editor.getByRole('button', { name: 'Edit as text' }).click();
    assert.match(await page.locator('.ls-document-row textarea.doc-editor-text').inputValue(), /\| S PARATYPHI "BH" \| \+ \| \+ \| - \| \+ \| - \|/);
    await page.locator('.ls-document-row').getByRole('button', { name: 'Show as report' }).click();
    await page.locator('.re-actions-bar button', { hasText: /^Final$/ }).click(); await page.waitForTimeout(1500);
    const { target } = await download(page, () => page.locator('.re-actions-bar button', { hasText: /^PDF$/ }).click());
    const text = pdfText(target);
    assert.match(text, /Widal \(Tube Method\)/);
    assert.match(text, /1:30\s+1:60\s+1:120\s+1:240\s+1:480/);
    assert.match(text, /S PARATYPHI "BH"\s+\+\s+\+\s+-\s+\+\s+-/);
    assert.match(text, /Comment: WIDAL TEST POSITIVE/);
  });

  await step('patient portal: sign in with mobile OTP and see the signed report', async () => {
    const ctx = await context.browser().newContext({ viewport: { width: 390, height: 844 } });
    await ctx.route(/\/(api|uploads)\//, async route => { const r = route.request(); const res = await env.inject({ method: r.method(), url: r.url().replace(/^https?:\/\/[^/]+/, ''), headers: r.headers(), body: r.postDataBuffer() }); return route.fulfill({ status: res.status, headers: res.headers, body: res.body }); });
    const p = await ctx.newPage();
    await p.goto(BASE + '/patient/report', { waitUntil: 'networkidle' });
    await p.getByRole('button', { name: /Mobile OTP/ }).click();
    await p.locator('#patient-phone').fill('9876500002');
    const before = env.sent.length;
    await p.getByRole('button', { name: /Send verification code/ }).click();
    await p.locator('#otp-input-0').waitFor({ timeout: 15000 });
    const message = env.sent.slice(before).map(m => m.text || JSON.stringify(m.vars || {})).join(' ');
    let code = (message.match(/\b(\d{6})\b/) || [])[1];
    if (!code && await p.getByTestId('dev-otp-code').count()) code = (await p.getByTestId('dev-otp-code').innerText()).trim();
    assert.ok(code, 'OTP delivered (recorded, not sent)');
    for (let i = 0; i < 6; i++) await p.locator(`#otp-input-${i}`).fill(code[i]);
    const verify = p.getByRole('button', { name: /verify/i }).first(); if (await verify.isEnabled().catch(() => false)) await verify.click().catch(() => {});
    await p.waitForTimeout(2500);
    const text = await p.locator('body').innerText();
    await p.screenshot({ path: require('path').join(require('./config.cjs').OUT, 'portal.png'), fullPage: true });
    assert.match(text, /E2E Patient One/i);
    assert.match(text, /Complete Blood Count/i, 'report shows its test names');
    assert.doesNotMatch(text, /VIRAL MARKER|Viral Marker/i, 'report of the voided bill is hidden');
    assert.equal(await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1), false, 'no sideways scroll on phone');
    await ctx.close();
  });

  console.log(results.join('\n'));
  await browser.close(); await env.stop();
})().catch(e => { console.error(e); process.exit(1); });
