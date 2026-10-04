export const normalizeAgeRanges = (ranges = []) => ranges.map((range) => ({ ...range,
  ...Object.fromEntries(['ageMin', 'ageMax', 'normalLow', 'normalHigh', 'criticalLow', 'criticalHigh']
    .map((key) => [key, range[key] === '' || range[key] == null ? null : Number(range[key])]))
}));
export const formatAgeRanges = (ranges = []) => ranges.map((range) => {
  const age = range.ageMin == null || range.ageMin === '' ? 'all ages' : `${range.ageMin}${range.ageMinUnit || 'y'}–${range.ageMax ?? ''}${range.ageMaxUnit || 'y'}`;
  return `${range.sex || 'Any'} (age ${age}): ${range.referenceRange || ''}`;
}).join('\n');

