const { before, test } = require('node:test');
const assert = require('node:assert/strict');
const { reportNoteBlocks } = require('../src/services/interpretationLayout');
const appPanels = require('./fixtures/labsmart/panels.app.json');
const {
  assertCovers,
  flatBlocks,
  sectionFromPanel,
  sectionFromTest,
  loadLabsmartWebsiteSource,
  normalize
} = require('./helpers/labsmartParity');

let website;

before(async () => {
  website = await loadLabsmartWebsiteSource();
});

test('Labsmart website source includes every panel and test interpretation', () => {
  assert.equal(website.panels.length, 8, 'Labsmart has 8 panel interpretations');
  assert.ok(website.tests.length >= 80, `Labsmart has 82 test interpretations, got ${website.tests.length}`);
  assert.deepEqual(website.panels.map(panel => panel.name).sort(), [
    'Blood Sugar Fasting & PP',
    'Complete Blood Count (CBC)',
    'Free Thyroid Function Test (FTFT)',
    'Iron Studies',
    'Kidney Function Test (KFT)',
    'Liver Function Test (LFT)',
    'Thyroid Function Test (TFT)',
    'Viral Marker'
  ]);
});

test('our code has a formatted description for every Labsmart panel', () => {
  for (const panel of website.panels) {
    const ours = appPanels.find(item => item.name === panel.name);
    assert.ok(ours, `missing app description for ${panel.name}`);
    assertCovers(ours.description, panel.text, `app description vs Labsmart website for ${panel.name}`);
  }
});

for (const panelName of [
  'Blood Sugar Fasting & PP',
  'Complete Blood Count (CBC)',
  'Free Thyroid Function Test (FTFT)',
  'Iron Studies',
  'Kidney Function Test (KFT)',
  'Liver Function Test (LFT)',
  'Thyroid Function Test (TFT)',
  'Viral Marker'
]) {
  test(`our report notes for ${panelName} match Labsmart website panel interpretation`, () => {
    const labsmart = website.panels.find(panel => panel.name === panelName);
    const ours = appPanels.find(panel => panel.name === panelName);
    assert.ok(labsmart && ours, panelName);

    // Simulate a billed panel: Labsmart panel guidance + imported per-test essays.
    // Our code must print the website panel text and hide the essays.
    const memberEssays = website.tests.slice(0, 3).map(item => ({
      name: item.name,
      text: item.text
    }));
    const produced = flatBlocks(reportNoteBlocks(sectionFromPanel({
      name: panelName,
      description: ours.description
    }, memberEssays)));

    assertCovers(produced, labsmart.text, `${panelName} produced notes vs Labsmart website`);

    for (const essay of memberEssays) {
      const essayNorm = normalize(essay.text);
      const producedNorm = normalize(produced);
      const distinctive = essayNorm.split(' ').filter(token => token.length > 6).slice(8, 14);
      const leaked = distinctive.filter(token => producedNorm.includes(token)
        && !normalize(labsmart.text).includes(token));
      assert.equal(leaked.length, 0, `${panelName} leaked imported essay tokens: ${leaked.join(', ')}`);
    }
    assert.ok(!/method\s*:/i.test(produced), `${panelName} must not append Method under panel guidance`);
    assert.ok(!/specimen\s*:/i.test(produced), `${panelName} must not append Specimen`);
  });
}

test('our report notes for every Labsmart website test interpretation match', () => {
  const failures = [];
  for (const item of website.tests) {
    const produced = flatBlocks(reportNoteBlocks(sectionFromTest(item)));
    try {
      assertCovers(produced, item.text, item.name, 0.9);
    } catch (error) {
      failures.push(error.message);
    }
  }
  assert.equal(failures.length, 0, failures.slice(0, 8).join('\n') || 'ok');
});

test('panels without Labsmart website guidance still keep per-test Labsmart essays', () => {
  const sample = website.tests.filter(item => /triglyceride|cholesterol|ldl|hdl/i.test(item.name)).slice(0, 2);
  const fallback = sample.length ? sample : website.tests.slice(20, 22);
  const produced = flatBlocks(reportNoteBlocks(sectionFromPanel({
    name: 'Lipid Profile',
    description: ''
  }, fallback.map(item => ({ name: item.name, text: item.text })))));
  for (const item of fallback) {
    assertCovers(produced, item.text, `fallback ${item.name}`, 0.85);
  }
});

test('set LABSMART_PARITY_LIVE=1 to refresh fixtures from the Labsmart website', () => {
  // Documents the live path. Default CI uses committed website snapshots.
  assert.ok(typeof loadLabsmartWebsiteSource === 'function');
  if (process.env.LABSMART_PARITY_LIVE === '1') {
    assert.ok(website.panels.length === 8);
    assert.ok(website.tests.length >= 80);
  }
});
