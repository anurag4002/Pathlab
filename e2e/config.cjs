// Machine-specific paths for the end-to-end suite. Override with env vars:
//   PLAYWRIGHT_PATH  folder of an installed `playwright` package
//   CHROME_PATH      Chromium/Chrome executable (default: Playwright's own)
//   PDFTOTEXT        pdftotext executable (Poppler / MiKTeX)
//   E2E_BASE         frontend dev server (default http://localhost:3000)
const fs = require('fs');
const path = require('path');
const first = (...paths) => paths.find(p => p && fs.existsSync(p));
const home = process.env.USERPROFILE || process.env.HOME || '';

function loadPlaywright() {
  const candidates = [process.env.PLAYWRIGHT_PATH, 'playwright', path.join(home, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')];
  for (const c of candidates.filter(Boolean)) { try { return require(c); } catch { /* next */ } }
  throw new Error('Playwright not found: `npm i -g playwright` or set PLAYWRIGHT_PATH');
}

module.exports = {
  BASE: process.env.E2E_BASE || 'http://localhost:3000',
  OUT: path.resolve(__dirname, 'output'),
  loadPlaywright,
  chromePath: () => first(process.env.CHROME_PATH, path.join(home, 'AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe')),
  pdftotext: () => first(process.env.PDFTOTEXT, path.join(home, 'AppData/Local/Programs/MiKTeX/miktex/bin/x64/pdftotext.exe')) || 'pdftotext'
};
