/* Formula/calculated result display — presentation-only mapping over data
   the API already returns. The backend stores formula rows in
   `report.results` with `test: null, derived: true`, so a billed formula test
   (Test.isDerived) has no `existingValue` in the /entry payload. This maps
   those server-calculated rows (matched by test name, the same convention the
   verification queue already uses) onto the billed test entries, keyed by
   testId. No formula logic or value is computed here — API values only. */

/* Reference range display — backend-provided strings/numbers only, never
   computed here. Shared by the result screens (Result Entry / Result
   Verification) and the Report Preview so the formatting stays identical. */
export const formatReferenceRange = (testEntry) => {
  if (testEntry.referenceRange) return testEntry.referenceRange;
  const parts = [];
  if (testEntry.maleReferenceRange) parts.push(`Male: ${testEntry.maleReferenceRange}`);
  if (testEntry.femaleReferenceRange) parts.push(`Female: ${testEntry.femaleReferenceRange}`);
  if (parts.length) return parts.join(' / ');
  // Fall back to the numeric normal bounds the API also provides (Phase 2).
  const { normalLow, normalHigh } = testEntry;
  if (normalLow != null && normalHigh != null) return `${normalLow} - ${normalHigh}`;
  if (normalLow != null) return `>= ${normalLow}`;
  if (normalHigh != null) return `<= ${normalHigh}`;
  return '—';
};

/* The same test can arrive twice (billed directly + inside a package). */
export const dedupeTestEntries = (list) => {
  const seen = new Set();
  const out = [];
  (list || []).forEach((testEntry) => {
    const key = testEntry.testId ?? `name:${testEntry.testName}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(testEntry);
  });
  return out;
};

export const buildCalculatedResults = (testEntries, results) => {
  const byName = new Map();
  (results || []).forEach((row) => {
    if (row?.derived === true && row.testName) byName.set(row.testName, row);
  });

  const calculated = {};
  (testEntries || []).forEach((testEntry) => {
    if (!testEntry?.isDerived || !testEntry.testId) return;
    const row = byName.get(testEntry.testName);
    if (!row) return;
    calculated[testEntry.testId] = {
      value: row.value != null ? String(row.value) : '',
      unit: row.unit || '',
      flag: row.flag || ''
    };
  });
  return calculated;
};
