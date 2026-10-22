const { launchLabsmartBrowser } = require('./browser');

(async () => {
  const { browser, context, labId, origin } = await launchLabsmartBrowser();
  const page = await context.newPage();
  await page.goto(`${origin}/${labId}/lab_reports`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(2500);
  const info = await page.evaluate(() => {
    const text = document.body.innerText;
    const clickables = [...document.querySelectorAll('button, a, [role="button"]')]
      .map(el => (el.textContent || '').trim().replace(/\s+/g, ' '))
      .filter(t => t && t.length < 40 && /next|more|page|load|older|prev|\d+/i.test(t))
      .slice(0, 40);
    const hrefs = [...document.querySelectorAll('a[href*="lab_reports/"]')]
      .map(a => a.getAttribute('href'))
      .filter(Boolean);
    return {
      url: location.href,
      title: document.title,
      linkCount: hrefs.length,
      uniqueIds: [...new Set(hrefs.map(h => (h.match(/lab_reports\/(\d+)/) || [])[1]).filter(Boolean))],
      clickables,
      sample: text.slice(0, 2500)
    };
  });
  console.log(JSON.stringify(info, null, 2));
  await browser.close();
})().catch(error => {
  console.error(error);
  process.exit(1);
});
