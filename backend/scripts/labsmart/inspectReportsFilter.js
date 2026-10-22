const { launchLabsmartBrowser } = require('./browser');

(async () => {
  const { browser, context, labId, origin } = await launchLabsmartBrowser();
  const page = await context.newPage();
  page.on('response', async response => {
    const url = response.url();
    if (/lab_reports|search|filter/i.test(url) && ['xhr', 'fetch'].includes(response.request().resourceType())) {
      console.log('[net]', response.status(), url.slice(0, 180));
    }
  });
  await page.goto(`${origin}/${labId}/lab_reports`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(2000);

  // Try opening the test select and choosing Hemoglobin.
  const before = await page.evaluate(() => [...document.querySelectorAll('a[href*="lab_reports/"]')]
    .map(a => a.getAttribute('href')).filter(Boolean).slice(0, 5));
  console.log('before', before);

  // Click the "Select test" control / combobox-ish UI.
  await page.evaluate(() => {
    const label = [...document.querySelectorAll('*')].find(el => (el.textContent || '').trim() === 'Select test');
    if (label) label.click();
  });
  await page.waitForTimeout(1000);
  await page.keyboard.type('Hemoglobin', { delay: 50 });
  await page.waitForTimeout(1000);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1500);
  const search = page.getByRole('button', { name: /^Search$/i });
  if (await search.count()) await search.click();
  else await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find(el => (el.textContent || '').trim() === 'Search');
    if (btn) btn.click();
  });
  await page.waitForTimeout(3000);
  const after = await page.evaluate(() => ({
    ids: [...new Set([...document.querySelectorAll('a[href*="lab_reports/"]')]
      .map(a => (a.getAttribute('href') || '').match(/lab_reports\/(\d+)/)?.[1])
      .filter(Boolean))],
    sample: document.body.innerText.slice(0, 1500)
  }));
  console.log(JSON.stringify(after, null, 2));
  await browser.close();
})().catch(error => {
  console.error(error);
  process.exit(1);
});
