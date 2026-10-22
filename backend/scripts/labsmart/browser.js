const path = require('path');
const fs = require('fs');

const DEFAULT_PLAYWRIGHT = 'C:/Users/Pratyush Mishra/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright';
const DEFAULT_CHROMIUM = 'C:\\Users\\Pratyush Mishra\\AppData\\Local\\ms-playwright\\chromium-1234\\chrome-win64\\chrome.exe';
const LABSMART_ORIGIN = 'https://app.labsmartlis.com';
const LAB_ID = process.env.LABSMART_LAB_ID || '22707599';

function parseCookies(raw = process.env.LABSMART_COOKIES || '') {
  return String(raw)
    .split(';')
    .map(part => part.trim())
    .filter(Boolean)
    .map(part => {
      const index = part.indexOf('=');
      if (index === -1) return null;
      return [part.slice(0, index).trim(), part.slice(index + 1).trim()];
    })
    .filter(Boolean);
}

function resolvePlaywright() {
  const candidates = [
    process.env.LABSMART_PLAYWRIGHT_PATH,
    DEFAULT_PLAYWRIGHT,
    path.resolve(__dirname, '../../../node_modules/playwright'),
    path.resolve(__dirname, '../../node_modules/playwright')
  ].filter(Boolean);
  for (const candidate of candidates) {
    try {
      return require(candidate);
    } catch {
      // try next
    }
  }
  throw new Error('Playwright not found. Set LABSMART_PLAYWRIGHT_PATH or install playwright.');
}

function resolveChromium() {
  const candidates = [
    process.env.LABSMART_CHROMIUM_PATH,
    DEFAULT_CHROMIUM
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return undefined;
}

async function launchLabsmartBrowser() {
  const cookies = parseCookies();
  if (!cookies.length) {
    throw new Error('Set LABSMART_COOKIES="name=value; name2=value2" for a logged-in Labsmart session.');
  }
  const { chromium } = resolvePlaywright();
  const executablePath = resolveChromium();
  const browser = await chromium.launch({
    ...(executablePath ? { executablePath } : {}),
    headless: true
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addCookies(cookies.map(([name, value]) => ({
    name,
    value,
    domain: 'app.labsmartlis.com',
    path: '/'
  })));
  return { browser, context, labId: LAB_ID, origin: LABSMART_ORIGIN };
}

module.exports = {
  launchLabsmartBrowser,
  parseCookies,
  LABSMART_ORIGIN,
  LAB_ID
};
