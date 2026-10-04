function getResultOptions(test = {}) {
  // A specimen is not a detection result. Older scalar AFB defaults were
  // accidentally copied to both fields when that test was expanded.
  if (/^sample\s*type$/i.test(String(test.name || '').split(': ').pop().trim())
      && test.resultOptions?.some(option => /^(positive|negative|reactive|non-reactive)$/i.test(option))) return [];
  if (test.resultOptions?.length) return test.resultOptions;
  const reference = String(test.referenceRange || '').trim().toLowerCase().replace(/[.]/g, '');
  if (/^(negative|neg|not detected)$/.test(reference)) return ['Negative', 'Positive'];
  if (/^(non[- ]?reactive|not reactive)$/.test(reference)) return ['Non-reactive', 'Reactive'];
  if (/^(absent|nil|none)$/.test(reference)) return ['Absent', 'Present'];
  if (reference === 'clear') return ['Clear', 'Slightly turbid', 'Turbid'];
  if (reference === 'pale yellow') return ['Pale Yellow', 'Yellow', 'Dark Yellow', 'Colourless', 'Red'];
  if (test.code === 'BLOOD_GROUP_RH') return ['A Positive', 'A Negative', 'B Positive', 'B Negative', 'AB Positive', 'AB Negative', 'O Positive', 'O Negative'];
  return [];
}
module.exports = { getResultOptions };
