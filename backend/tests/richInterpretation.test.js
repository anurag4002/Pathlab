const { test } = require('node:test');
const assert = require('node:assert/strict');
const { sanitizeInterpretation, richInterpretationBlocks } = require('../src/services/richInterpretation');
const { interpretationBlocks } = require('../src/services/interpretationLayout');

test('rich interpretation preserves headings, inline formatting and editable table structure', () => {
  const html = '<h2 style="text-align: center">Clinical significance</h2><p>Some <strong>important</strong> <em>details</em> <u>underlined</u>.</p><table><tbody><tr><th colspan="2"><p>Combined header</p></th></tr><tr><td rowspan="2"><p>Group</p></td><td><p>First</p></td></tr><tr><td><p>Second</p></td></tr></tbody></table><ol start="3"><li><p>Third item</p></li></ol>';
  const clean = sanitizeInterpretation(html);
  assert.ok(clean.includes('colspan="2"') && clean.includes('rowspan="2"'));
  const blocks = interpretationBlocks(clean);
  assert.equal(blocks[0].align, 'center');
  assert.equal(blocks[0].headingLevel, 2);
  assert.ok(blocks[1].runs.some(run => run.text === 'important' && run.bold));
  assert.ok(blocks[1].runs.some(run => run.text === 'details' && run.italic));
  assert.ok(blocks[1].runs.some(run => run.text === 'underlined' && run.underline));
  assert.equal(blocks[2].richRows[0][0].colspan, 2);
  assert.equal(blocks[2].richRows[1][0].rowspan, 2);
  assert.equal(blocks[3].text, '3. Third item');
});

test('pasted rich interpretation drops executable content and unsafe styles without losing cell text', () => {
  const clean = sanitizeInterpretation('<p onclick="alert(1)" style="position:fixed;color:red;text-align:right">Keep me<script>alert(2)</script><img src=x onerror=alert(3)></p><table><tr><td>Cell</td></tr></table><iframe src="https://example.test"></iframe>');
  assert.ok(!/script|onclick|onerror|<img|iframe|position|color:/i.test(clean));
  assert.ok(clean.includes('text-align:right') && clean.includes('Keep me') && clean.includes('<td>Cell</td>'));
});

test('existing plain text and tab-delimited interpretations remain supported', () => {
  const plain = 'Interpretation\nExisting text\n\nItem\tMeaning\nA\tFirst';
  assert.equal(sanitizeInterpretation(plain), plain);
  const blocks = interpretationBlocks(plain);
  assert.equal(blocks[0].kind, 'heading');
  assert.equal(blocks[2].kind, 'table');
  assert.deepEqual(blocks[2].rows[1], ['A', 'First']);
  assert.equal(richInterpretationBlocks('<p></p>').length, 0);
});
