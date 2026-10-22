const { launchLabsmartBrowser } = require('./browser');

(async () => {
  const { browser, context, labId, origin } = await launchLabsmartBrowser();
  const page = await context.newPage();
  const hits = [];
  page.on('response', async response => {
    const url = response.url();
    if (!/lab_reports/i.test(url)) return;
    if (!['xhr', 'fetch', 'document'].includes(response.request().resourceType())) return;
    hits.push({ status: response.status(), type: response.request().resourceType(), url });
  });

  await page.goto(`${origin}/${labId}/lab_reports`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(1500);

  // Open duration and pick 90 days.
  await page.evaluate(() => {
    const duration = [...document.querySelectorAll('*')].find(el => (el.textContent || '').trim() === 'Duration');
    if (duration) duration.click();
  });
  await page.waitForTimeout(500);
  const clicked90 = await page.evaluate(() => {
    const node = [...document.querySelectorAll('button, a, li, div, span')]
      .find(el => /^(Last|Past) 90 days$/i.test((el.textContent || '').trim()));
    if (!node) return false;
    node.click();
    return (node.textContent || '').trim();
  });
  console.log('clicked90', clicked90);
  await page.waitForTimeout(3000);

  const page1 = await page.evaluate(() => [...new Set([...document.querySelectorAll('a[href*="lab_reports/"]')]
    .map(a => (a.getAttribute('href') || '').match(/\/lab_reports\/(\d+)/)?.[1])
    .filter(Boolean))]);
  console.log('page1 ids', page1);

  // Click the pagination Next near the table footer if present.
  const nextInfo = await page.evaluate(() => {
    const candidates = [...document.querySelectorAll('button, a, [role="button"]')]
      .map(el => ({
        text: (el.textContent || '').trim(),
        cls: el.className,
        disabled: !!(el.disabled || el.getAttribute('aria-disabled') === 'true'),
        href: el.getAttribute('href')
      }))
      .filter(item => /^next$/i.test(item.text));
    return candidates;
  });
  console.log('next buttons', nextInfo);

  await page.evaluate(() => {
    const next = [...document.querySelectorAll('button, a, [role="button"]')]
      .find(el => /^next$/i.test((el.textContent || '').trim()) && !el.disabled);
    if (next) next.click();
  });
  await page.waitForTimeout(3000);
  const page2 = await page.evaluate(() => [...new Set([...document.querySelectorAll('a[href*="lab_reports/"]')]
    .map(a => (a.getAttribute('href') || '').match(/\/lab_reports\/(\d+)/)?.[1])
    .filter(Boolean))]);
  console.log('page2 ids', page2);
  console.log('network hits', JSON.stringify(hits.slice(-15), null, 2));
  await browser.close();
})().catch(error => {
  console.error(error);
  process.exit(1);
});
