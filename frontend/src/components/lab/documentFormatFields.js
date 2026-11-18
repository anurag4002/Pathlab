// Numeric layout settings of a report/bill format: key, form label, min, max.
// The bounds match the server (backend documentTemplateService NUMBER_BOUNDS).
export const NUMERIC_FORMAT_FIELDS = [
  ['pageMargin', 'Page margin (pt)', 12, 54], ['headerHeight', 'Header height (pt)', 60, 480],
  ['footerHeight', 'Footer height (pt)', 30, 330], ['fontSize', 'Body text size (pt)', 8, 12], ['rowPadding', 'Table row padding (pt)', 2, 8]
];

// Choice settings of a format: key, form label, [value, option text] pairs.
export const SELECT_FORMAT_FIELDS = [
  ['fontFamily', 'Font', [['Helvetica', 'Helvetica'], ['Times-Roman', 'Times'], ['Courier', 'Courier']]],
  ['tableStyle', 'Table appearance', [['outlined', 'Reference outline'], ['plain', 'Plain'], ['banded', 'Colored header and alternating rows']]],
  ['flagPlacement', 'Abnormal flag position', [['before-value', 'Before value (reference)'], ['last', 'Last column']]],
  ['patientLayout', 'Patient details', [['columns', 'Three columns (reference)'], ['stacked', 'Stacked']]]
];

// Field-error key for one setting of one format, e.g. documentFormats.<id>.pageMargin.
export const formatFieldKey = (formatId, key) => `documentFormats.${formatId}.${key}`;

// Checks every format before saving, so the person sees which field is wrong
// (and in which format) without a round trip. Returns { [fieldKey]: message }.
export function validateDocumentFormats(formats) {
  const errors = {};
  if (!Array.isArray(formats)) return errors;
  const many = formats.length > 1;
  for (const format of formats) {
    const where = many && format?.name ? ` in "${format.name}"` : '';
    if (!String(format?.name ?? '').trim()) errors[formatFieldKey(format?.id, 'name')] = 'Enter a format name.';
    for (const [key, label, min, max] of NUMERIC_FORMAT_FIELDS) {
      const raw = format?.[key];
      const value = Number(raw);
      if (raw === '' || raw === null || raw === undefined || !Number.isFinite(value) || value < min || value > max) {
        errors[formatFieldKey(format?.id, key)] = `${label.replace(' (pt)', '')} must be between ${min} and ${max} pt${where}.`;
      }
    }
  }
  return errors;
}
