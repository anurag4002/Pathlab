/* Map saved formula results to their test/parameter fields for report display. */

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
    const key = testEntry.resultKey || testEntry.testId || `name:${testEntry.testName}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(testEntry);
  });
  return out;
};

export const buildCalculatedResults = (testEntries, results) => {
  const byName = new Map();
  const byId = new Map();
  (results || []).forEach((row) => {
    if (row?.derived === true && row.testName) byName.set(row.testName, row);
    if (row?.derived === true && row.test) {
      const id = String(row.test?._id || row.test);
      byId.set(row.parameterCode ? `${id}:${row.parameterCode}` : id, row);
    }
  });

  const calculated = {};
  (testEntries || []).forEach((testEntry) => {
    if (!testEntry?.isDerived || !testEntry.testId) return;
    const key = testEntry.resultKey || String(testEntry.testId);
    const row = byId.get(key) || byName.get(testEntry.testName) || byName.get(testEntry.testCode);
    if (!row) return;
    calculated[key] = {
      value: row.value != null ? String(row.value) : '',
      unit: row.unit || '',
      flag: row.flag || ''
    };
  });
  return calculated;
};
