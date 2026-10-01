// Version-controlled template and artwork ship with every deployment. Existing
// profiles use this default immediately, without an upload or setup step.
const REFERENCE_FORMAT = Object.freeze(require('../assets/document-formats/pure-path-reference.json'));
const NUMBER_BOUNDS = { pageMargin: [12, 54], headerHeight: [60, 160], footerHeight: [30, 110], fontSize: [8, 12], rowPadding: [2, 8] };
const ENUMS = { fontFamily: ['Helvetica', 'Times-Roman', 'Courier'], tableStyle: ['outlined', 'plain', 'banded'], flagPlacement: ['before-value', 'last'], patientLayout: ['columns', 'stacked'] };
function invalid(message) { const error = new Error(message); error.statusCode = 400; throw error; }
function normalizeFormat(raw = {}, strict = false) {
  const format = { ...REFERENCE_FORMAT };
  for (const [key, bounds] of Object.entries(NUMBER_BOUNDS)) {
    if (raw[key] === undefined) continue;
    const value = Number(raw[key]);
    if (!Number.isFinite(value) || value < bounds[0] || value > bounds[1]) {
      if (strict) invalid(`${key} must be between ${bounds[0]} and ${bounds[1]}.`);
    } else format[key] = value;
  }
  for (const [key, values] of Object.entries(ENUMS)) {
    if (raw[key] === undefined) continue;
    if (values.includes(raw[key])) format[key] = raw[key];
    else if (strict) invalid(`Invalid ${key}.`);
  }
  for (const key of ['id', 'name', 'reportTitle', 'billTitle', 'endOfReportText']) {
    if (raw[key] === undefined) continue;
    if (typeof raw[key] !== 'string' || raw[key].length > 120 || (['id', 'name'].includes(key) && !raw[key].trim())) {
      if (strict) invalid(`Enter a valid ${key} (up to 120 characters).`);
    } else format[key] = raw[key].trim();
  }
  if (raw.accentColor !== undefined) {
    if (/^#[0-9a-f]{6}$/i.test(raw.accentColor)) format.accentColor = raw.accentColor;
    else if (strict) invalid('Choose a valid accent color.');
  }
  if (raw.useReferenceBranding !== undefined) {
    if (typeof raw.useReferenceBranding === 'boolean') format.useReferenceBranding = raw.useReferenceBranding;
    else if (strict) invalid('Reference branding must be on or off.');
  }
  return format;
}
function formatSettings(profile = {}) {
  const formats = profile.documentFormats?.length ? Array.from(profile.documentFormats, f => normalizeFormat(f)) : [{ ...REFERENCE_FORMAT }];
  return { documentFormats: formats, reportFormatId: profile.reportFormatId || formats[0].id, billFormatId: profile.billFormatId || formats[0].id };
}
function validateFormatSettings(patch, current = {}) {
  const settings = { ...formatSettings(current), ...patch };
  if (!Array.isArray(settings.documentFormats) || !settings.documentFormats.length || settings.documentFormats.length > 20) invalid('Keep between 1 and 20 document formats.');
  settings.documentFormats = settings.documentFormats.map(f => {
    if (!f || typeof f !== 'object' || Array.isArray(f)) invalid('Invalid document format.');
    return normalizeFormat(f, true);
  });
  const ids = new Set(settings.documentFormats.map(f => f.id));
  if (ids.size !== settings.documentFormats.length) invalid('Each document format must have a unique ID.');
  for (const key of ['reportFormatId', 'billFormatId']) if (!ids.has(settings[key])) invalid(`Choose an existing ${key === 'reportFormatId' ? 'report' : 'bill'} format before saving.`);
  return settings;
}
function resolveFormat(profile = {}, kind = 'report') {
  const settings = formatSettings(profile);
  return settings.documentFormats.find(f => f.id === settings[`${kind === 'bill' ? 'bill' : 'report'}FormatId`]) || settings.documentFormats[0];
}
module.exports = { REFERENCE_FORMAT, normalizeFormat, formatSettings, validateFormatSettings, resolveFormat };
