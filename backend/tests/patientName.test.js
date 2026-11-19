const { test } = require('node:test');
const assert = require('node:assert/strict');
const { patientName } = require('../src/utils/patientName');
const { reportPdf } = require('../src/services/pdfService');
const zlib = require('node:zlib');
const textOf = pdf => [...pdf.toString('latin1').matchAll(/stream\r?\n([\s\S]*?)\nendstream/g)].map(m => {
  try { return [...zlib.inflateSync(Buffer.from(m[1], 'latin1')).toString('latin1').matchAll(/<([\da-f]+)>/gi)].map(x => Buffer.from(x[1], 'hex').toString('latin1')).join(''); } catch { return ''; }
}).join('\n');

test('title is shown once even when the name already starts with it', () => {
  assert.equal(patientName({ title: 'Mr', name: 'Mr Shivam' }), 'Mr Shivam');
  assert.equal(patientName({ title: 'Mr', name: 'Mr. Shivam' }), 'Mr. Shivam');
  assert.equal(patientName({ title: 'Mrs', name: 'mrs sunita' }), 'mrs sunita');
  assert.equal(patientName({ title: 'Mr', name: 'Shivam' }), 'Mr Shivam');
  assert.equal(patientName({ title: 'Mr', name: 'Mrinal' }), 'Mr Mrinal', 'a name starting with the letters is not a title');
  assert.equal(patientName({ title: 'Dr.', name: 'Dr Abha' }), 'Dr Abha');
  assert.equal(patientName({ name: 'Shivam' }), 'Shivam');
  assert.equal(patientName({ title: 'Mr' }), '');
  assert.equal(patientName(null), '');
});

test('the report prints the title once', async () => {
  const render = async patient => textOf(await reportPdf({ profile: {}, patient, report: { registrationNumber: 'R', results: [] } }, { qr: false, barcode: false }));
  const doubled = await render({ title: 'Mr', name: 'Mr Shivam' });
  assert.ok(doubled.includes('Mr Shivam') && !/Mr\s+Mr/.test(doubled));
  assert.ok((await render({ title: 'Mr', name: 'Mrinal' })).includes('Mr Mrinal'));
});
