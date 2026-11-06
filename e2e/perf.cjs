// Speed profile: seeds a realistic day (patients, bills, reports) in the
// isolated environment, then opens the busiest screens in the real UI and
// reports, per API request, how many database queries it ran and how long it
// took. A request whose query count grows with the rows on screen is an N+1.
//   node e2e/perf.cjs            (PATIENTS=40 by default)
const { AsyncLocalStorage } = require('async_hooks');
const { start } = require('./env.cjs');
const { openBrowser } = require('./browser.cjs');
const { login } = require('./login.cjs');
const { BASE } = require('./config.cjs');

const PATIENTS = Number(process.env.PATIENTS || 40);
const als = new AsyncLocalStorage();

(async () => {
  const env = await start();
  const mongoose = env.mongoose;
  mongoose.set('debug', (collection, method) => { const store = als.getStore(); if (store) { store.queries++; store.ops[`${collection}.${method}`] = (store.ops[`${collection}.${method}`] || 0) + 1; } });
  const rawInject = env.inject;
  const log = [];
  env.inject = (options) => {
    const store = { queries: 0, ops: {} };
    const started = process.hrtime.bigint();
    return als.run(store, () => rawInject(options)).then((res) => {
      log.push({ method: options.method, url: options.url.split('?')[0].replace(/[a-f0-9]{24}/g, ':id'), full: options.url, ms: Number(process.hrtime.bigint() - started) / 1e6, queries: store.queries, ops: store.ops, status: res.status });
      return res;
    });
  };
  const call = async (method, url, body, token) => {
    const res = await env.inject({ method, url, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: body ? Buffer.from(JSON.stringify(body)) : undefined });
    return JSON.parse(res.body.toString() || '{}');
  };

  // --- seed ---
  const auth = await env.inject({ method: 'POST', url: '/api/auth/login', headers: { 'content-type': 'application/json' }, body: Buffer.from(JSON.stringify({ email: env.admin.email, password: env.admin.password })) });
  const token = JSON.parse(auth.body.toString()).data?.token;
  const Test = mongoose.model('Test'), TestPanel = mongoose.model('TestPanel');
  const cbc = await TestPanel.findOne({ name: 'Complete Blood Count (CBC)' }).lean();
  const tests = await Test.find({ name: { $in: ['Serum Creatinine', 'Urine Sugar Fasting', 'Widal (Tube Method)'] } }).lean();
  for (let i = 0; i < PATIENTS; i++) {
    const patient = await call('POST', '/api/patients', { name: `Perf Patient ${i}`, age: 20 + (i % 50), gender: i % 2 ? 'Male' : 'Female', phone: `98${String(76000000 + i).padStart(8, '0')}` }, token);
    const items = [{ itemType: 'TestPanel', itemId: cbc._id, name: cbc.name, price: cbc.price || 300 }, ...tests.slice(0, 1 + (i % 3)).map(t => ({ itemType: 'Test', itemId: t._id, name: t.name, price: t.price || 100 }))];
    const bill = await call('POST', '/api/bills', { patient: patient.data._id, items, paidAmount: i % 2 ? 0 : Math.min(500, items.reduce((sum, item) => sum + item.price, 0)), paymentMethod: 'Cash' }, token);
    if (i % 4 === 3) continue; // some cases wait for results
    const report = await call('POST', '/api/reports/result', { patient: patient.data._id, bill: bill.data._id, entryMode: 'inhouse' }, token);
    const entry = await call('GET', `/api/reports/${report.data._id}/entry`, null, token);
    const results = (entry.data.testEntries || []).filter(t => !t.isDerived && t.sourceType !== 'Document').map(t => ({ test: t.testId, parameterCode: t.parameterCode || undefined, testName: t.testName, value: String(10 + (i % 7)) }));
    await call('PUT', `/api/reports/${report.data._id}/results/${i % 3 ? 'submit' : 'draft'}`, { results }, token);
  }
  console.log(`seeded ${PATIENTS} patients/bills, ${log.length} API calls`);
  log.length = 0;

  // --- profile the busiest screens through the real UI ---
  const { browser, page } = await openBrowser(env);
  await login(page, env.admin.email, env.admin.password);
  const screens = ['/dashboard', '/cases/bills', '/cases/bills/new', '/lab/reports', '/lab/result-entry', '/lab/verification', '/reviews', '/cases/patients', '/business/daily', '/lab/search'];
  const byScreen = [];
  for (const screen of screens) {
    const from = log.length;
    await page.goto(BASE + screen, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(500);
    byScreen.push({ screen, calls: log.slice(from) });
  }
  // A result-entry case and both PDFs.
  const anyReport = (await call('GET', '/api/reports?limit=1', null, token)).data;
  const reportId = (anyReport?.reports || anyReport || [])[0]?._id;
  const anyBill = (await call('GET', '/api/bills?limit=1', null, token)).data;
  const billId = (anyBill?.bills || anyBill || [])[0]?._id;
  for (const [label, url] of [['open case', `/lab/result-entry?report=${reportId}`]]) {
    const from = log.length;
    await page.goto(BASE + url, { waitUntil: 'networkidle', timeout: 60000 }); await page.waitForTimeout(500);
    byScreen.push({ screen: label, calls: log.slice(from) });
  }
  for (const [label, url] of [['report PDF', `/api/reports/${reportId}/pdf`], ['bill PDF', `/api/bills/${billId}/pdf`]]) {
    const from = log.length;
    await env.inject({ method: 'GET', url, headers: { authorization: `Bearer ${token}` } });
    byScreen.push({ screen: label, calls: log.slice(from) });
  }

  for (const { screen, calls } of byScreen) {
    const total = calls.reduce((s, c) => s + c.queries, 0), ms = calls.reduce((s, c) => s + c.ms, 0);
    console.log(`\n== ${screen}: ${calls.length} requests, ${total} queries, ${ms.toFixed(0)} ms server time`);
    for (const c of calls.filter(c => c.url.startsWith('/api')).sort((a, b) => b.queries - a.queries).slice(0, 6)) {
      const top = Object.entries(c.ops).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => `${k}x${v}`).join(' ');
      console.log(`  ${String(c.queries).padStart(4)}q ${c.ms.toFixed(0).padStart(5)}ms ${c.status} ${c.method} ${c.url}  [${top}]`);
    }
  }
  await browser.close(); await env.stop();
})().catch(e => { console.error(e); process.exit(1); });
