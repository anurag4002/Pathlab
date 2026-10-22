const fs = require('fs');
const path = require('path');

const FIXTURE_DIR = path.join(__dirname, '../fixtures/labsmart');
const PANEL_FIXTURE = path.join(FIXTURE_DIR, 'panels.website.json');
const TEST_FIXTURE = path.join(FIXTURE_DIR, 'tests.website.json');
const APP_PANEL_FIXTURE = path.join(FIXTURE_DIR, 'panels.app.json');

function normalize(value) {
  return String(value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#xa0;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&apos;|&#39;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/[\u2018\u2019\u201A]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u03b2/gi, 'beta')
    .replace(/\u2013|\u2014/g, '-')
    .replace(/view all\s*$/i, '')
    .toLowerCase()
    .replace(/[^a-z0-9.<>%\-\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function significantTokens(value) {
  return normalize(value).split(' ').filter(token => token.length > 3);
}

function coverage(actual, expected) {
  const haystack = normalize(actual);
  const tokens = significantTokens(expected);
  if (!tokens.length) return { hit: 0, total: 0, ratio: 1, missing: [] };
  const missing = tokens.filter(token => !haystack.includes(token));
  const hit = tokens.length - missing.length;
  return { hit, total: tokens.length, ratio: hit / tokens.length, missing: missing.slice(0, 12) };
}

function assertCovers(actual, expected, label, minimum = 0.92) {
  const result = coverage(actual, expected);
  if (result.ratio < minimum) {
    const error = new Error(
      `${label}: only ${(result.ratio * 100).toFixed(1)}% of Labsmart tokens matched `
      + `(${result.hit}/${result.total}). Missing eg: ${result.missing.join(', ') || '(none)'}`
    );
    error.coverage = result;
    throw error;
  }
  return result;
}

function flatBlocks(blocks) {
  return blocks.map(block => {
    if (block.rows) return block.rows.map(row => row.join('\t')).join('\n');
    if (block.columns) {
      return block.columns.map(column => [column.heading, ...column.items].join('\n')).join('\n');
    }
    return block.text || '';
  }).join('\n\n');
}

function sectionFromPanel(panel, memberTests = []) {
  return {
    title: panel.name,
    description: panel.description || panel.text || '',
    groups: [{
      items: (memberTests.length ? memberTests : [{ name: `${panel.name} member`, text: 'Imported essay that Labsmart hides under panel guidance.' }]).map(item => ({
        result: { testName: item.name },
        test: {
          name: item.name,
          interpretation: item.text || item.interpretation || '',
          sourceInterpretation: {
            text: item.text || item.interpretation || '',
            method: item.method || 'Calculated'
          }
        }
      }))
    }]
  };
}

function sectionFromTest(item) {
  return {
    title: item.name,
    description: '',
    groups: [{
      items: [{
        result: { testName: item.name },
        test: {
          name: item.name,
          interpretation: item.text,
          sourceInterpretation: { text: item.text }
        }
      }]
    }]
  };
}

function loadWebsiteFixtures() {
  return {
    panels: JSON.parse(fs.readFileSync(PANEL_FIXTURE, 'utf8')),
    tests: JSON.parse(fs.readFileSync(TEST_FIXTURE, 'utf8'))
  };
}

async function fetchWebsiteInterpretations() {
  const playwrightPath = process.env.LABSMART_PLAYWRIGHT_PATH
    || 'C:/Users/Pratyush Mishra/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright';
  const chromiumPath = process.env.LABSMART_CHROMIUM_PATH
    || 'C:\\Users\\Pratyush Mishra\\AppData\\Local\\ms-playwright\\chromium-1234\\chrome-win64\\chrome.exe';
  const cookiePairs = String(process.env.LABSMART_COOKIES || '')
    .split(';')
    .map(part => part.trim())
    .filter(Boolean)
    .map(part => {
      const index = part.indexOf('=');
      return index === -1 ? null : [part.slice(0, index).trim(), part.slice(index + 1).trim()];
    })
    .filter(Boolean);
  if (!cookiePairs.length) {
    throw new Error('Set LABSMART_COOKIES="name=value; name2=value2" to fetch live Labsmart interpretations.');
  }

  const { chromium } = require(playwrightPath);
  const { parseDocument } = require('htmlparser2');
  const DomUtils = require('domutils');
  const browser = await chromium.launch({ executablePath: chromiumPath, headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addCookies(cookiePairs.map(([name, value]) => ({
    name, value, domain: 'app.labsmartlis.com', path: '/'
  })));
  const page = await context.newPage();
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

  function findLabelDiv(node, label) {
    let found = null;
    const visit = el => {
      if (found) return;
      if (el.type === 'tag' && el.name === 'div') {
        const text = DomUtils.textContent(el).trim();
        if (!el.children.some(child => child.type === 'tag') && text === label) {
          found = el;
          return;
        }
      }
      for (const child of el.children || []) visit(child);
    };
    visit(node);
    return found;
  }

  function nextContentDiv(labelDiv) {
    let sibling = labelDiv.next;
    while (sibling && !(sibling.type === 'tag' && sibling.name === 'div')) sibling = sibling.next;
    return sibling;
  }

  function extractPopup(html, nameLabel) {
    const doc = parseDocument(html);
    const nameDiv = findLabelDiv(doc, nameLabel);
    const name = nameDiv ? DomUtils.textContent(nameDiv.next).trim() : '';
    const label = findLabelDiv(doc, 'Interpretation:');
    const content = label ? nextContentDiv(label) : null;
    return {
      name: name || '',
      html: content ? DomUtils.getInnerHTML(content).trim() : '',
      text: content ? DomUtils.textContent(content).trim() : ''
    };
  }

  async function extractRows(listUrl, popupTitle) {
    await page.goto(listUrl, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(1200);
    return page.evaluate(title => {
      const tables = [...document.querySelectorAll('table')];
      const table = tables.find(candidate => /Name/i.test(candidate.innerText) && /Interpretation/i.test(candidate.innerText));
      return [...table.querySelectorAll('tbody tr')].map(row => {
        const cells = [...row.querySelectorAll('td')];
        const button = [...row.querySelectorAll('button')].find(item => item.getAttribute('data-popup-title') === title);
        return { name: (cells[1]?.innerText || '').trim(), url: button?.getAttribute('data-url') || '' };
      });
    }, popupTitle);
  }

  try {
    const panelRows = await extractRows('https://app.labsmartlis.com/22707599/panel_interpretations', 'Panel interpretation');
    const panels = [];
    for (const row of panelRows) {
      if (!row.url) continue;
      const response = await context.request.get(`https://app.labsmartlis.com${row.url}`);
      const extracted = extractPopup(await response.text(), 'Panel name:');
      panels.push({ name: row.name, url: row.url, text: extracted.text, html: extracted.html });
      await sleep(120);
    }

    const testRows = await extractRows('https://app.labsmartlis.com/22707599/test_interpretations', 'Interpreation');
    const tests = [];
    for (const row of testRows) {
      if (!row.url) continue;
      const response = await context.request.get(`https://app.labsmartlis.com${row.url}`);
      const extracted = extractPopup(await response.text(), 'Test name:');
      tests.push({ name: row.name, url: row.url, text: extracted.text, html: extracted.html });
      await sleep(100);
    }
    return { panels, tests };
  } finally {
    await browser.close();
  }
}

async function loadLabsmartWebsiteSource() {
  if (process.env.LABSMART_PARITY_LIVE === '1') {
    const live = await fetchWebsiteInterpretations();
    fs.mkdirSync(FIXTURE_DIR, { recursive: true });
    fs.writeFileSync(PANEL_FIXTURE, JSON.stringify(live.panels, null, 2));
    fs.writeFileSync(TEST_FIXTURE, JSON.stringify(live.tests, null, 2));
    return live;
  }
  return loadWebsiteFixtures();
}

module.exports = {
  normalize,
  coverage,
  assertCovers,
  flatBlocks,
  sectionFromPanel,
  sectionFromTest,
  loadLabsmartWebsiteSource,
  fetchWebsiteInterpretations,
  PANEL_FIXTURE,
  TEST_FIXTURE
};
