// Screenshots of every chart with realistic data: seeds bills/payments and
// expenses spread over the last ~4 months, then captures the chart screens.
//   node e2e/chart-shots.cjs   -> e2e/output/charts-*.png
const path = require('path');
const { start } = require('./env.cjs');
const { openBrowser } = require('./browser.cjs');
const { login } = require('./login.cjs');
const { BASE, OUT } = require('./config.cjs');

(async () => {
  const env = await start();
  const mongoose = env.mongoose;
  const auth = await env.inject({ method: 'POST', url: '/api/auth/login', headers: { 'content-type': 'application/json' }, body: Buffer.from(JSON.stringify({ email: env.admin.email, password: env.admin.password })) });
  const token = JSON.parse(auth.body.toString()).data.token;
  const call = async (method, url, body) => JSON.parse((await env.inject({ method, url, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: body ? Buffer.from(JSON.stringify(body)) : undefined })).body.toString() || '{}');
  const tests = await mongoose.model('Test').find({ status: 'Active' }).limit(25).lean();
  for (let i = 0; i < 90; i++) {
    const patient = await call('POST', '/api/patients', { name: `Chart Patient ${i}`, age: 25 + (i % 40), gender: i % 2 ? 'Male' : 'Female', phone: `97${String(10000000 + i).padStart(8, '0')}` });
    const picks = [tests[i % tests.length], tests[(i * 7) % tests.length]].filter((t, k, a) => a.indexOf(t) === k);
    const items = picks.map((t) => ({ itemType: 'Test', itemId: t._id, name: t.name, price: Math.max(100, t.price || 100) * (1 + (i % 3)) }));
    const total = items.reduce((s, it) => s + it.price, 0);
    await call('POST', '/api/bills', { patient: patient.data._id, items, paidAmount: i % 5 === 0 ? 0 : total, paymentMethod: ['Cash', 'UPI', 'Card'][i % 3] });
  }
  for (let i = 0; i < 12; i++) await call('POST', '/api/expenses', { category: 'Reagents', name: `Expense ${i}`, amount: 300 + i * 90, paymentMethod: 'Cash', date: new Date().toISOString() });
  // Spread everything over the past 120 days (busier recently), today kept.
  const day = 24 * 3600 * 1000;
  const shift = (i) => (i % 9 === 0 ? 0 : Math.floor(((i * 37) % 120) * (0.4 + (i % 4) * 0.2)) * day);
  const db = mongoose.connection.db;
  for (const name of ['bills', 'transactions', 'expenses', 'reports']) {
    const docs = await db.collection(name).find({}, { projection: { _id: 1, date: 1, createdAt: 1 } }).toArray();
    for (const [i, doc] of docs.entries()) {
      const when = new Date(Date.now() - shift(i));
      await db.collection(name).updateOne({ _id: doc._id }, { $set: { ...(doc.date ? { date: when } : {}), createdAt: when } });
    }
  }
  const { browser, page } = await openBrowser(env, { width: Number(process.env.W || 1440), height: 1000 });
  await login(page, env.admin.email, env.admin.password);
  const from = new Date(Date.now() - 30 * day).toISOString().slice(0, 10);
  const shots = [['dashboard', '/dashboard'], ['daily', `/business/daily?from=${from}`], ['monthly', '/business/monthly'], ['analysis', '/business/analysis'], ['tests', '/lab/analysis'], ['counts', '/lab/counts']];
  for (const [name, url] of shots) {
    await page.goto(BASE + url, { waitUntil: 'networkidle', timeout: 90000 }).catch(() => {});
    await page.waitForTimeout(1500);
    const charts = page.locator('.svg-chart');
    const count = await charts.count();
    for (let i = 0; i < count; i++) {
      const card = charts.nth(i).locator('xpath=ancestor::*[contains(@class,"card")][1]');
      const target = (await card.count()) ? card : charts.nth(i);
      await target.scrollIntoViewIfNeeded().catch(() => {});
      await target.screenshot({ path: path.join(OUT, `charts-${name}-${i + 1}.png`) }).catch(() => {});
    }
    // One hover state per screen, to check the tooltip.
    if (count) {
      const plot = page.locator('.svg-chart-plot').first();
      if (await plot.count()) {
        const box = await plot.boundingBox();
        await page.mouse.move(box.x + box.width * 0.62, box.y + box.height * 0.5);
        await page.waitForTimeout(200);
        await plot.locator('xpath=..').screenshot({ path: path.join(OUT, `charts-${name}-hover.png`) }).catch(() => {});
      }
    }
    console.log(`${name}: ${count} chart(s)`);
  }
  await browser.close(); await env.stop();
})().catch((e) => { console.error(e); process.exit(1); });
