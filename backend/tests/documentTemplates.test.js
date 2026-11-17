const { test } = require('node:test');
const assert = require('node:assert/strict');
const { REFERENCE_FORMAT, formatSettings, validateFormatSettings, resolveFormat } = require('../src/services/documentTemplateService');
const LabProfile = require('../src/models/LabProfile');

test('old profiles and new profiles use the reference format', () => {
  assert.equal(resolveFormat({}).tableStyle, 'outlined');
  assert.equal(resolveFormat(new LabProfile()).id, 'reference');
  assert.equal(formatSettings({}).documentFormats[0].flagPlacement, 'before-value');
});
test('report and bill defaults are resolved separately and survive profile serialization', () => {
  const settings = validateFormatSettings({ documentFormats: [{ ...REFERENCE_FORMAT }, { ...REFERENCE_FORMAT, id: 'custom', name: 'Custom bill', tableStyle: 'banded', fontSize: 12 }], reportFormatId: 'reference', billFormatId: 'custom' });
  const profile = new LabProfile(settings).toObject();
  assert.equal(resolveFormat(profile, 'bill').fontSize, 12);
  assert.equal(resolveFormat(profile, 'report').fontSize, 9);
});
test('deleting the active format requires a replacement default', () => {
  assert.throws(() => validateFormatSettings({ documentFormats: [{ ...REFERENCE_FORMAT, id: 'new' }] }), /existing report/);
  assert.equal(validateFormatSettings({ documentFormats: [{ ...REFERENCE_FORMAT, id: 'new' }], reportFormatId: 'new', billFormatId: 'new' }).billFormatId, 'new');
});
test('invalid layout settings are rejected before persistence', () => {
  for (const change of [{ pageMargin: 0 }, { fontSize: 40 }, { headerHeight: Infinity }, { accentColor: 'red' }, { tableStyle: 'anything' }, { name: '' }, { useReferenceBranding: 'false' }]) {
    assert.throws(() => validateFormatSettings({ documentFormats: [{ ...REFERENCE_FORMAT, ...change }] }), error => error.statusCode === 400);
  }
  // Messages use the form's field names, not internal keys like pageMargin.
  assert.throws(() => validateFormatSettings({ documentFormats: [{ ...REFERENCE_FORMAT, pageMargin: 5 }] }), { message: 'Page margin must be between 12 and 54 pt.' });
  assert.throws(() => validateFormatSettings({ documentFormats: [{ ...REFERENCE_FORMAT, rowPadding: 20 }] }), { message: 'Table row padding must be between 2 and 8 pt.' });
  assert.throws(() => validateFormatSettings({ documentFormats: [{ ...REFERENCE_FORMAT, tableStyle: 'x' }] }), { message: 'Choose a valid table appearance.' });
  assert.throws(() => validateFormatSettings({ documentFormats: [REFERENCE_FORMAT, REFERENCE_FORMAT] }), /unique/);
  assert.throws(() => validateFormatSettings({ documentFormats: [] }), /between 1 and 20/);
});
test('print flags use saved defaults unless explicitly overridden', () => {
  const { resolveReportOptions, reportOptionsFromQuery } = require('../src/services/pdfService');
  const profile = { showQR: false, showBarcode: false, showLetterheadByDefault: false };
  assert.equal(resolveReportOptions({}, profile).qr, false);
  assert.equal(resolveReportOptions(reportOptionsFromQuery({ qr: '1' }), profile).qr, true);
  assert.equal(resolveReportOptions(reportOptionsFromQuery({ footer: '0' }), profile).footer, false);
});
