// Imported guidance contains both real headings and line breaks copied from
// narrow source columns. Join soft wraps while preserving headings and lists.
const HEADING = /^(physiologic(?:al)? basis|clinical significance|interpretation|increased in|decreased in|causes of (?:increased|decreased) .+|(?:high|low|raised|elevated|decreased|increased)(?: levels?)?(?: causes?| values?)?(?: in| is found in| can be found in)?|causes?|notes?|comments?|method|principle|reference(?: interval| range)?|clinical (?:utility|use)|limitations?|specimen|precautions?)\s*:?\s*$/i;
const INLINE_HEADING = /^((?:increased|decreased|high|low|elevated|raised)(?: levels?)?(?: causes?| values?)?(?: in)?|notes?|comments?|method|specimen)\s*:\s*(.+)$/i;
const isImportNote = value => /^\s*Migrated from Labsmart\b/i.test(String(value || ''));
const isKft = value => /^(?:kidney function(?: test)?|renal function(?: test)?)(?:\s*\((?:kft|rft)\))?$|^(?:kft|rft)$/i.test(String(value || '').trim());

function interpretationBlocks(value) {
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
  return blocks;
}

function reportNoteBlocks(section) {
  const blocks = [], seen = new Set();
  const add = (title, value) => {
    const content = String(value || '').trim();
    if (!content || isImportNote(content) || seen.has(content)) return;
    seen.add(content); blocks.push({ kind: 'title', text: title }, ...interpretationBlocks(content));
  };
  const tests = section.groups.flatMap(group => group.items);
  const referenceKft = isKft(section.title) && section.description?.trim() && !isImportNote(section.description);
  add('Description', section.description);
  const names = new Set(tests.map(({ result, test }) => test.parentName || test.name || result.testName || 'Test'));
  for (const { result, test } of tests) {
    const name = test.parentName || test.name || result.testName || 'Test';
    const prefix = names.size > 1 ? `${name} - ` : '';
    const descriptionIncluded = test.description?.trim() && String(test.interpretation || '').replace(/\s+/g, ' ').includes(test.description.trim().replace(/\s+/g, ' '));
    if (test.description && !descriptionIncluded && test.description !== test.sourceType && !/^(?:numeric|text|document|single parameter|multiple parameters?)$/i.test(test.description.trim())) add(`${prefix}Description`, test.description);
    // The supplied KFT report has panel guidance, not every individual test's
    // full imported boilerplate. Keep lab-authored changes as additional notes.
    const unchangedImport = test.sourceInterpretation?.text && String(test.interpretation || '').trim() === test.sourceInterpretation.text.trim();
    if (!referenceKft || !unchangedImport) add(`${prefix}Interpretation`, test.interpretation);
    const method = String(test.sourceInterpretation?.method || '').trim();
    if (method && !seen.has(`method:${method}`)) {
      seen.add(`method:${method}`); blocks.push({ kind: 'detail', text: `Method: ${method}` });
    }
    const specimen = String(test.sampleType || '').trim();
    if (specimen && !seen.has(`specimen:${specimen}`)) {
      seen.add(`specimen:${specimen}`); blocks.push({ kind: 'detail', text: `Specimen: ${specimen}` });
    }
  }
  return blocks;
}

module.exports = { interpretationBlocks, reportNoteBlocks };
