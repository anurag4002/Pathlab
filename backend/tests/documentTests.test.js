const { test } = require('node:test');
const assert = require('node:assert/strict');
const zlib = require('node:zlib');
const { documentBlocks } = require('../src/services/interpretationLayout');
const { reportPdf } = require('../src/services/pdfService');
const { REFERENCE_FORMAT } = require('../src/services/documentTemplateService');
const templates = require('../src/assets/document-formats/document-test-templates.json');

function textOf(pdf) {
  const source = pdf.toString('latin1');
  const out = [];
  for (const match of source.matchAll(/\/Length (\d+)[^>]*>>\s*stream\r?\n/g)) {
    const start = match.index + match[0].length;
    try {
      const stream = zlib.inflateSync(Buffer.from(source.slice(start, start + Number(match[1])), 'latin1')).toString('latin1');
      out.push([...stream.matchAll(/<([\da-f]+)>/gi)].map(m => Buffer.from(m[1], 'hex').toString('latin1')).join(''));
    } catch { /* not a compressed text stream */ }
  }
  return out.join('\n');
}

test('document findings: "| a | b |" lines become one grid, other lines stay as written', () => {
  const blocks = documentBlocks(templates['Widal (Tube Method)']);
  const tables = blocks.filter(block => block.kind === 'table');
  assert.equal(tables.length, 1);
  assert.equal(tables[0].grid, true);
  assert.deepEqual(tables[0].rows[0], ['', '1:30', '1:60', '1:120', '1:240', '1:480']);
  assert.deepEqual(tables[0].rows[1], ['S TYPHI "O"', '+', '+', '+', '-', '-']);
  assert.equal(tables[0].rows.length, 5);
  // "Comment: ..." is not turned into a heading.
  assert.ok(blocks.some(block => block.kind === 'paragraph' && block.text === 'Comment: WIDAL TEST <POSTIVE/NEGATIVE>'));
  assert.equal(blocks.some(block => block.kind === 'heading'), false);
});

test('every Document test has a template', () => {
  for (const name of ['Widal (Tube Method)', 'Widal (Slide Method)', 'FNAC (Fine Needle Aspiration)', 'PAP Smear', 'Peripheral Blood Smear', 'Mantoux test', 'Culture and Sensitivity']) {
    assert.ok(String(templates[name] || '').trim(), name);
  }
});

test('report PDF prints a Document test as its own titled box, after the result table', async () => {
  const format = { ...REFERENCE_FORMAT, useReferenceBranding: false };
  const profile = { labName: 'Doc Lab', documentFormats: [format], reportFormatId: 'reference', showLetterheadByDefault: false, showFooterByDefault: false, showWatermark: false, showBarcode: false, showQR: false, showSignatures: false };
  const category = { name: 'SEROLOGY', createdAt: new Date('2024-01-01') };
  const testMap = {
    widal: { _id: 'widal', name: 'Widal (Tube Method)', sourceType: 'Document', category, reportSectionKey: 'test:widal', displayOrder: 1 },
    dengue: { _id: 'dengue', name: 'Dengue IgG', category, reportSectionKey: 'test:dengue', displayOrder: 2 }
  };
  const pdf = await reportPdf({
    profile, patient: { name: 'Doc Patient', age: 30, gender: 'Male' }, bill: { billNumber: 'D1', department: 'LAB' },
    report: { registrationNumber: 'D1', results: [
      { test: 'widal', testName: 'Widal (Tube Method)', value: templates['Widal (Tube Method)'] },
      { test: 'dengue', testName: 'Dengue IgG', value: 'Negative' }
    ] }, testMap
  }, { letterhead: false, footer: false, watermark: false, barcode: false, qr: false, signatures: false, pageno: true, interpretation: true, endline: true, dept: true });
  const text = textOf(pdf);
  for (const expected of ['Widal (Tube Method)', 'Tube agglutination test', '1:120', 'S PARATYPHI "BH"', 'Comment: WIDAL TEST', 'DENGUE IGG']) assert.ok(text.includes(expected), expected);
  assert.ok(text.indexOf('DENGUE IGG') < text.indexOf('Widal (Tube Method)'), 'result table before the document box');
  assert.equal(text.includes('WIDAL (TUBE METHOD)'), false, 'not printed as a one-line table row');
});

test('nested tests print sub-headings with parameters indented under them', async () => {
  const format = { ...REFERENCE_FORMAT, useReferenceBranding: false };
  const profile = { labName: 'Doc Lab', documentFormats: [format], reportFormatId: 'reference', showLetterheadByDefault: false, showFooterByDefault: false, showWatermark: false, showBarcode: false, showQR: false, showSignatures: false };
  const category = { name: 'CLINICAL PATHOLOGY', createdAt: new Date('2024-01-01') };
  const stool = { _id: 'stool', name: 'Stool Routine Examination', category, reportSectionKey: 'test:stool', parameters: [
    { code: 'C', name: 'Colour', subheading: 'MACROSCOPIC' }, { code: 'M', name: 'Mucus', subheading: 'MACROSCOPIC' }, { code: 'O', name: 'OVA', subheading: 'MICROSCOPIC' }] };
  const { expandTests } = require('../src/services/testDefinitions');
  const testMap = {};
  const results = expandTests([stool]).map(t => { testMap[`stool:${t.parameterCode}`] = { ...t, reportSectionKey: 'test:stool' }; return { test: 'stool', parameterCode: t.parameterCode, testName: t.name, value: '10' }; });
  // The renderer looks tests up by "<id>:<parameterCode>".
  const pdf = await reportPdf({ profile, patient: { name: 'P', age: 30, gender: 'Male' }, bill: { billNumber: 'N1', department: 'LAB' },
    report: { registrationNumber: 'N1', results }, testMap: { ...testMap, stool: { ...stool } } },
  { letterhead: false, footer: false, watermark: false, barcode: false, qr: false, signatures: false, pageno: true, interpretation: true, endline: true, dept: true });
  const text = textOf(pdf);
  const order = ['STOOL ROUTINE EXAMINATION', 'MACROSCOPIC', 'COLOUR', 'MUCUS', 'MICROSCOPIC', 'OVA'].map(word => text.indexOf(word));
  assert.ok(order.every(i => i >= 0), JSON.stringify(order));
  assert.deepEqual([...order].sort((a, b) => a - b), order);
  assert.equal(text.split('MACROSCOPIC').length - 1, 1, 'each sub-heading printed once');
});
