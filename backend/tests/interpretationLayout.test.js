const { test } = require('node:test');
const assert = require('node:assert/strict');
const { interpretationBlocks, reportNoteBlocks } = require('../src/services/interpretationLayout');
const appPanels = require('./fixtures/labsmart/panels.app.json');

function flat(blocks) {
  return blocks.map(block => block.rows ? block.rows.map(row => row.join('\t')).join('\n') : block.text || '').join('\n');
}

test('section override replaces panel and test notes', () => {
  const lft = appPanels.find(panel => panel.name === 'Liver Function Test (LFT)');
  const blocks = reportNoteBlocks({
    title: lft.name,
    description: lft.description,
    interpretationOverride: 'Report specific note only.',
    groups: [{ items: [{ result: { testName: 'SGPT' }, test: { name: 'SGPT', interpretation: 'essay' } }] }]
  });
  const text = flat(blocks);
  assert.ok(text.includes('Report specific note only.'));
  assert.ok(!text.includes('LFT Interpretation'));
});

test('result override survives panel guidance', () => {
  const lft = appPanels.find(panel => panel.name === 'Liver Function Test (LFT)');
  const blocks = reportNoteBlocks({
    title: lft.name,
    description: lft.description,
    groups: [{ items: [{
      result: { testName: 'SGPT', interpretationOverride: 'Patient specific SGPT' },
      test: { name: 'SGPT', interpretation: 'imported essay', sourceInterpretation: { text: 'imported essay', method: 'Calculated' } }
    }] }]
  });
  const text = flat(blocks);
  assert.ok(text.includes('Patient specific SGPT'));
  assert.ok(text.includes('LFT Interpretation'));
  assert.ok(!text.includes('imported essay'));
  assert.ok(!text.includes('Method:'));
});

test('Migrated from Labsmart descriptions are not treated as panel guidance', () => {
  const blocks = reportNoteBlocks({
    title: 'Liver Function Test (LFT)',
    description: 'Migrated from Labsmart panel import',
    groups: [{ items: [{
      result: { testName: 'SGPT' },
      test: { name: 'SGPT', interpretation: 'Keep essay', sourceInterpretation: { text: 'Keep essay' } }
    }] }]
  });
  const text = flat(blocks);
  assert.ok(text.includes('Keep essay'));
  assert.ok(!text.includes('Migrated from Labsmart'));
});

test('interpretationBlocks parse Labsmart headings and tables', () => {
  const blocks = interpretationBlocks('Clinical significance:\nBody.\n\nItem\tMeaning\nA\tFirst');
  assert.equal(blocks[0].kind, 'heading');
  assert.equal(blocks[2].kind, 'table');
  assert.deepEqual(blocks[2].rows[1], ['A', 'First']);
});
