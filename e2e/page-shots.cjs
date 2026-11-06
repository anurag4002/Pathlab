// Screenshot of every staff screen with realistic data, for UI reviews.
//   node e2e/page-shots.cjs            -> e2e/output/pages/<route>.png (1440x900)
//   W=390 H=844 node e2e/page-shots.cjs -> phone size
//   UI=v2 ...                             -> the new look (pages-v2/)
//   ONLY=/dashboard,/cases/bills ...      -> just these routes
//   PRINT=1 ...                           -> what Print gives (print media, full page) in print[-v2]/
const fs = require('fs');
const path = require('path');
const { start } = require('./env.cjs');
const { openBrowser } = require('./browser.cjs');
const { login } = require('./login.cjs');
const { BASE, OUT } = require('./config.cjs');

const routes = [...fs.readFileSync(path.resolve(__dirname, '../frontend/src/routes/AppRoutes.jsx'), 'utf8').matchAll(/<Route path="([^"]+)"/g)]
  .map((m) => m[1]).filter((p) => !process.env.ONLY || process.env.ONLY.split(',').includes(p)).filter((p) => !p.includes(':') && p !== '*' && !/^\/(login|logout|r\b|admin|$)/.test(p) && p !== '/');

(async () => {
  const env = await start();
  const mongoose = env.mongoose;
  const auth = await env.inject({ method: 'POST', url: '/api/auth/login', headers: { 'content-type': 'application/json' }, body: Buffer.from(JSON.stringify({ email: env.admin.email, password: env.admin.password })) });
  const token = JSON.parse(auth.body.toString()).data.token;
  const call = async (method, url, body) => JSON.parse((await env.inject({ method, url, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: body ? Buffer.from(JSON.stringify(body)) : undefined })).body.toString() || '{}');
  const cbc = await mongoose.model('TestPanel').findOne({ name: 'Complete Blood Count (CBC)' }).lean();
  const tests = await mongoose.model('Test').find({ status: 'Active', sourceType: { $ne: 'Document' } }).limit(12).lean();
  const names = ['Ravi Kumar', 'Sunita Sharma', 'Mohd. Irfan', 'Priya Verma', 'Anil Gupta', 'Kavita Singh', 'Rahul Yadav', 'Neha Tiwari', 'Suresh Pal', 'Pooja Mishra', 'Arjun Mehta', 'Fatima Khan', 'Deepak Joshi', 'Ritu Saxena', 'Manoj Pandey', 'Seema Rawat', 'Vikas Dubey', 'Asha Devi'];
  for (const [i, name] of names.entries()) {
    const female = ['Sunita Sharma', 'Priya Verma', 'Kavita Singh', 'Neha Tiwari', 'Pooja Mishra', 'Fatima Khan', 'Ritu Saxena', 'Seema Rawat', 'Asha Devi'].includes(name);
    const patient = await call('POST', '/api/patients', { name, age: 22 + (i * 3) % 50, gender: female ? 'Female' : 'Male', phone: `98${String(71000000 + i * 137).padStart(8, '0')}` });
    const items = [{ itemType: 'TestPanel', itemId: cbc._id, name: cbc.name, price: cbc.price || 350 }, { itemType: 'Test', itemId: tests[i % tests.length]._id, name: tests[i % tests.length].name, price: tests[i % tests.length].price || 150 }];
    const bill = await call('POST', '/api/bills', { patient: patient.data._id, items, paidAmount: i % 3 === 0 ? 0 : Math.min(500, items.reduce((sum, item) => sum + item.price, 0)), paymentMethod: ['Cash', 'UPI', 'Card'][i % 3] });
    if (i % 4 === 3) continue;
    const report = await call('POST', '/api/reports/result', { patient: patient.data._id, bill: bill.data._id, entryMode: 'inhouse' });
    const entry = await call('GET', `/api/reports/${report.data._id}/entry`);
    const results = (entry.data.testEntries || []).filter((t) => !t.isDerived && t.sourceType !== 'Document').map((t) => ({ test: t.testId, parameterCode: t.parameterCode || undefined, testName: t.testName, value: String(9 + (i % 9)) }));
    await call('PUT', `/api/reports/${report.data._id}/results/${i % 3 ? 'submit' : 'draft'}`, { results });
  }
  for (let i = 0; i < 4; i++) await call('POST', '/api/expenses', { category: 'Reagents', name: `Reagent lot ${i + 1}`, amount: 450 + i * 120, paymentMethod: 'Cash', date: new Date().toISOString() });

  const width = Number(process.env.W || 1440), height = Number(process.env.H || 900);
  const dir = path.join(OUT, `${process.env.PRINT ? 'print' : width < 600 ? 'pages-phone' : 'pages'}${process.env.UI === 'v2' ? '-v2' : ''}`);
  fs.mkdirSync(dir, { recursive: true });
  const { browser, page } = await openBrowser(env, { width, height });
  await login(page, env.admin.email, env.admin.password);
  if (process.env.UI === 'v2') {
    await page.evaluate(() => { const id = JSON.parse(localStorage.getItem('ppl_user') || '{}')._id; localStorage.setItem(`ppl_ui_version:${id}`, 'v2'); });
  }
  for (const route of [...new Set(routes)]) {
    await page.goto(BASE + route, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(900);
    const file = path.join(dir, `${route.replace(/^\//, '').replace(/\//g, '__') || 'root'}.png`);
    if (process.env.PRINT) {
      // Reports with the shared print: click Print and capture what would be printed.
      await page.evaluate(() => { window.__pplPrinted = null; window.__pplPrintCapture = (html) => { window.__pplPrinted = html; }; });
      const printButton = page.getByRole('button', { name: /^Print$/ }).first();
      if (await printButton.count()) {
        await printButton.click().catch(() => {});
        await page.waitForFunction(() => window.__pplPrinted, null, { timeout: 8000 }).catch(() => {});
        const html = await page.evaluate(() => window.__pplPrinted);
        if (html) {
          const paper = await browser.newPage({ viewport: { width: 794, height: 1123 } });
          await paper.setContent(html, { waitUntil: 'load' });
          await paper.emulateMedia({ media: 'print' });
          await paper.screenshot({ path: file, fullPage: true });
          await paper.close();
          console.log(route, '->', path.basename(file), '(shared print)');
          continue;
        }
      }
      await page.emulateMedia({ media: 'print' });
      await page.setViewportSize({ width: 794, height: 1123 }); // A4 at 96 dpi
      await page.waitForTimeout(300);
      await page.screenshot({ path: file, fullPage: true });
      await page.emulateMedia({ media: 'screen' });
      await page.setViewportSize({ width, height });
    } else {
      await page.screenshot({ path: file });
    }
    // Phone check: anything wider than the screen (sideways scroll, cut-off parts).
    if (width < 600) {
      const issues = await page.evaluate(() => {
        const vw = document.documentElement.clientWidth;
        const out = [];
        if (document.documentElement.scrollWidth > vw + 1) out.push(`page scrolls sideways (${document.documentElement.scrollWidth}px wide)`);
        const seen = new Set();
        for (const el of document.querySelectorAll('header *, main *')) {
          const r = el.getBoundingClientRect();
          if (!r.width || !r.height) continue;
          const style = getComputedStyle(el);
          if (style.visibility === 'hidden' || style.position === 'fixed') continue;
          let p = el.parentElement, clipped = false;
          while (p && p !== document.body) {
            const o = getComputedStyle(p).overflowX;
            if (o === 'auto' || o === 'scroll') { clipped = true; break; } // scrolls on purpose
            if (o === 'hidden') { // cut off by its box: a real problem if it sticks out
              const pr = p.getBoundingClientRect();
              if (r.right > pr.right + 2 && el.children.length === 0 && (el.textContent || '').trim()) out.push(`${el.tagName.toLowerCase()} "${el.textContent.trim().slice(0, 30)}" is cut off`);
              clipped = true; break;
            }
            p = p.parentElement;
          }
          if (clipped) continue;
          if (r.right > vw + 2 || r.left < -2) {
            const name = `${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/)[0] : ''}`;
            if (!seen.has(name)) { seen.add(name); out.push(`${name} spills off screen (${Math.round(r.left)}..${Math.round(r.right)})`); }
          }
          if (out.length > 6) break;
        }
        return out;
      });
      if (issues.length) console.log('  PHONE', route, '::', issues.join(' | '));
    }
    console.log(route, '->', path.basename(file));
  }
  await browser.close(); await env.stop();
})().catch((e) => { console.error(e); process.exit(1); });
