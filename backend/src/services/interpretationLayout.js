// Imported guidance contains both real headings and line breaks copied from
// narrow source columns. Join soft wraps while preserving headings and lists.
const HEADING = /^(physiologic(?:al)? basis|clinical significance|interpretation|increased in|decreased in|causes of (?:increased|decreased) .+|(?:high|low|raised|elevated|decreased|increased)(?: levels?)?(?: causes?| values?)?(?: in| is found in| can be found in)?|causes?|notes?|comments?|method|principle|reference(?: interval| range)?|clinical (?:utility|use)|limitations?|specimen|precautions?)\s*:?\s*$/i;
const INLINE_HEADING = /^((?:increased|decreased|high|low|elevated|raised)(?: levels?)?(?: causes?| values?)?(?: in)?|notes?|comments?|method|specimen)\s*:\s*(.+)$/i;
const LEAD_IN = /^(?:increased|decreased|elevated|raised|high|low|reduced)(?: levels?)?(?: values?)?(?: in| is found in| can be found in)?$/i;
const isImportNote = value => /^\s*Migrated from Labsmart\b/i.test(String(value || ''));
const normalized = value => String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();

function interpretationBlocks(value) {
  const { isRichInterpretation, richInterpretationBlocks } = require('./richInterpretation');
  if (isRichInterpretation(value)) return richInterpretationBlocks(value);
  const blocks = [];
  let paragraph = '', tableRows = [];
  const flush = () => { if (paragraph) blocks.push({ kind: 'paragraph', text: paragraph }); paragraph = ''; };
  const flushTable = () => { if (tableRows.length) blocks.push({ kind: 'table', rows: tableRows }); tableRows = []; };
  for (const raw of String(value || '').replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trim();
    if (raw.includes('\t')) { flush(); tableRows.push(raw.split('\t').map(cell => cell.trim())); continue; }
    flushTable();
    if (!line) { flush(); continue; }
    if (HEADING.test(line) || (line.length <= 90 && /:$/.test(line) && !/^[-•]|^\d+[.)]/.test(line))) {
      flush(); blocks.push({ kind: 'heading', text: line.replace(/:\s*$/, '') });
    } else {
      const inline = line.match(INLINE_HEADING);
      if (inline) {
        flush(); blocks.push({ kind: 'heading', text: inline[1] }); paragraph = inline[2];
      } else if (/^[-•]\s+|^\d+[.)](?:\s+|(?=[A-Za-z]))/.test(line)) {
        flush(); blocks.push({ kind: 'list', text: line.replace(/^•\s+/, '- ') });
      } else paragraph = paragraph ? `${paragraph} ${line}` : line;
    }
  }
  flush();
  flushTable();
  // Pair explicitly labelled cause lists from saved content. Never infer a
  // high/low mapping for flattened imports with adjacent, empty headings.
  for (let i = 0; i < blocks.length; i++) {
    if (blocks[i].kind !== 'heading' || !/^causes of increased /i.test(blocks[i].text)) continue;
    let middle = i + 1;
    while (blocks[middle]?.kind === 'list') middle++;
    if (middle === i + 1 || blocks[middle]?.kind !== 'heading' || !/^causes of decreased /i.test(blocks[middle].text)) continue;
    let end = middle + 1;
    while (blocks[end]?.kind === 'list') end++;
    if (end === middle + 1) continue;
    blocks.splice(i, end - i, { kind: 'comparison', columns: [
      { heading: blocks[i].text, items: blocks.slice(i + 1, middle).map(block => block.text) },
      { heading: blocks[middle].text, items: blocks.slice(middle + 1, end).map(block => block.text) }
    ] });
  }
  // The reference sheet runs "Increased in:" style labels into their text
  // ("Increased in: Acute viral hepatitis ...") with the label in bold.
  for (let i = 0; i < blocks.length - 1; i++) {
    if (blocks[i].kind !== 'heading' || !LEAD_IN.test(blocks[i].text) || blocks[i + 1].kind !== 'paragraph') continue;
    blocks.splice(i, 2, { kind: 'paragraph', text: `${blocks[i].text}: ${blocks[i + 1].text}`, runs: [{ text: `${blocks[i].text}: `, bold: true }, { text: blocks[i + 1].text }] });
  }
  return blocks;
}

// Document-type tests (Widal, FNAC, PAP smear ...) print their findings as
// written: one paragraph per line, "| a | b |" lines (or tab-separated lines)
// as a grid, blank lines as spacing. No heading guessing, so "Comment: ..."
// stays on one line as on the reference sheet. HTML from the rich editor
// keeps its own structure.
const isTableLine = line => /^\|.*\|$/.test(line.trim());
const tableCells = line => line.trim().replace(/^\||\|$/g, '').split('|').map(cell => cell.trim());
function documentBlocks(value) {
  const { isRichInterpretation, richInterpretationBlocks } = require('./richInterpretation');
  if (isRichInterpretation(value)) return richInterpretationBlocks(value);
  const blocks = [];
  let rows = [];
  const flushTable = () => { if (rows.length) blocks.push({ kind: 'table', rows, grid: true }); rows = []; };
  for (const raw of String(value || '').replace(/\r\n?/g, '\n').split('\n')) {
    if (isTableLine(raw)) { rows.push(tableCells(raw)); continue; }
    if (raw.includes('\t') && raw.trim()) { rows.push(raw.split('\t').map(cell => cell.trim())); continue; }
    flushTable();
    const line = raw.trim();
    if (!line) { if (blocks.length && blocks.at(-1).kind !== 'gap') blocks.push({ kind: 'gap' }); continue; }
    blocks.push({ kind: 'paragraph', text: line });
  }
  flushTable();
  while (blocks.at(-1)?.kind === 'gap') blocks.pop();
  return blocks;
}

// Word content of plain or rich (HTML) guidance, used to recognise a saved
// report "override" that is really the catalog text reformatted by the editor.
function interpretationWords(value) {
  const { isRichInterpretation, richInterpretationBlocks } = require('./richInterpretation');
  // Table blocks also carry a text summary; count their cells only once.
  const flat = block => (block.richRows ? block.richRows.flat().flatMap(cell => (cell.runs || []).map(run => run.text))
    : block.rows ? block.rows.flat()
      : block.columns ? block.columns.flatMap(column => [column.heading, ...column.items])
        : [block.runs ? block.runs.map(run => run.text).join('') : block.text]).filter(Boolean).join(' ');
  const text = isRichInterpretation(value) ? richInterpretationBlocks(value).map(flat).join(' ') : String(value || '');
  return text.replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ').toLowerCase().match(/[a-z0-9]+/g) || [];
}

// Dice overlap of the two word bags. Editor round-trips drop or repeat a few
// heading words ("Interpretation", "Physiological basis"); real edits change
// substantially more than that.
function sameInterpretation(a, b, threshold = 0.9) {
  const left = interpretationWords(a), right = interpretationWords(b);
  if (!left.length || !right.length) return left.length === right.length;
  const counts = new Map();
  left.forEach(word => counts.set(word, (counts.get(word) || 0) + 1));
  let shared = 0;
  right.forEach(word => { const n = counts.get(word); if (n) { shared++; counts.set(word, n - 1); } });
  return (2 * shared) / (left.length + right.length) >= threshold;
}

const isPanelSection = section => !!section.panel || /^(?:panel|package):/.test(String(section.key || ''));

function reportNoteBlocks(section) {
  if (typeof section.interpretationOverride === 'string') {
    return section.interpretationOverride.trim()
      ? [{ kind: 'title', text: 'Interpretation' }, ...interpretationBlocks(section.interpretationOverride)] : [];
  }
  const blocks = [], seen = new Set();
  const add = (title, value) => {
    const content = String(value || '').trim();
    const key = normalized(content);
    if (!content || isImportNote(content) || seen.has(key)) return;
    seen.add(key); blocks.push(...(title ? [{ kind: 'title', text: title }] : []), ...interpretationBlocks(content));
  };
  const tests = section.groups.flatMap(group => group.items);
  // Reference reports print only the panel's own guidance under a billed
  // panel (nothing when the panel has none); member tests' imported essays
  // never appear. Lab-authored catalog text and genuine report edits still
  // print. A saved "edit" that is just the catalog text reformatted by the
  // editor counts as the catalog text.
  if (isPanelSection(section)) {
    add('', section.description);
    const panelNames = new Set(tests.map(({ result, test }) => test.parentName || test.name || result.testName || 'Test'));
    for (const { result, test } of tests) {
      const name = test.parentName || test.name || result.testName || 'Test';
      const prefix = panelNames.size > 1 ? `${name} - ` : '';
      const override = result.interpretationOverride;
      if (typeof override === 'string' && !sameInterpretation(override, test.interpretation)) {
        add(`${result.testName || test.name || 'Test'} - Interpretation`, override);
        continue;
      }
      const unchangedImport = test.sourceInterpretation?.text && sameInterpretation(test.interpretation, test.sourceInterpretation.text);
      if (!unchangedImport) add(`${prefix}Interpretation`, test.interpretation);
    }
    return blocks;
  }
  const panelGuidance = section.description?.trim() && !isImportNote(section.description);
  add('', section.description);
  const names = new Set(tests.map(({ result, test }) => test.parentName || test.name || result.testName || 'Test'));
  for (const { result, test } of tests) {
    const custom = typeof result.interpretationOverride === 'string';
    const name = custom ? result.testName || test.name || 'Test' : test.parentName || test.name || result.testName || 'Test';
    const prefix = names.size > 1 ? `${name} - ` : '';
    const descriptionIncluded = test.description?.trim() && normalized(test.interpretation).includes(normalized(test.description));
    if (!panelGuidance && !String(test.interpretation || '').trim() && test.description && !descriptionIncluded && test.description !== test.sourceType && !/^(?:numeric|text|document|single parameter|multiple parameters?)$/i.test(test.description.trim())) add(`${prefix}Description`, test.description);
    // A lab-authored panel interpretation replaces the individual tests' full
    // imported boilerplate, matching the source reports. Keep explicit overrides.
    const unchangedImport = test.sourceInterpretation?.text && normalized(test.interpretation) === normalized(test.sourceInterpretation.text);
    // Standalone tests print their guidance directly under the result row,
    // without a "<test> - Interpretation" banner. The method is printed in
    // the row itself (see formattedPdfService), not in this box.
    if (custom) add(names.size > 1 ? `${name} - Interpretation` : '', result.interpretationOverride);
    else if (!panelGuidance || !unchangedImport) add(prefix ? `${prefix}Interpretation` : '', test.interpretation);
  }
  return blocks;
}

module.exports = { documentBlocks, interpretationBlocks, reportNoteBlocks, sameInterpretation, isPanelSection };
