const AGE_SCALE = { d: 1 / 365.25, days: 1 / 365.25, mo: 1 / 12, months: 1 / 12, y: 1, years: 1 };
const numeric = (value) => value == null || String(value).trim() === '' ? null : Number(value);

function parseBounds(text) {
  const source = String(text || '').trim().replace(/,/g, '');
  const n = '(-?\\d+(?:\\.\\d+)?)';
  const interval = source.match(new RegExp(`^${n}\\s*[-–]\\s*${n}(?:\\s+[^\\d]*)?$`));
  if (interval) return { normalLow: Number(interval[1]), normalHigh: Number(interval[2]), lowInclusive: true, highInclusive: true };
  const limit = source.match(new RegExp(`^(<=|>=|<|>|≤|≥|UP TO)\\s*${n}(?:\\s+[^\\d]*)?$`, 'i'));
  if (limit) {
    const below = ['<', '<=', '≤', 'UP TO'].includes(limit[1].toUpperCase());
    return { normalLow: below ? null : Number(limit[2]), normalHigh: below ? Number(limit[2]) : null,
      lowInclusive: limit[1] !== '>', highInclusive: limit[1] !== '<' };
  }
  return null;
}

function parseAgeRanges(text) {
  return String(text || '').split(/\r?\n/).flatMap((line) => {
    const match = line.match(/^\s*(Any|Male|Female)\s*\(age\s+(\d+(?:\.\d+)?)(d|mo|y)\s*[-–]\s*(\d+(?:\.\d+)?)(d|mo|y)\):\s*(.+)$/i);
    if (!match) return [];
    return [{ sex: match[1][0].toUpperCase() + match[1].slice(1).toLowerCase(),
      ageMin: Number(match[2]), ageMinUnit: match[3].toLowerCase(), ageMax: Number(match[4]), ageMaxUnit: match[5].toLowerCase(),
      referenceRange: match[6].trim(), ...parseBounds(match[6]) }];
  });
}

function resolveReferenceRange(test = {}, patient = {}) {
  test = test || {};
  patient = patient || {};
  const bands = test.referenceRanges?.length ? test.referenceRanges : parseAgeRanges(test.referenceRange);
  const age = numeric(patient.age);
  // Imported Labsmart ages use 365 days/year. Keep their source boundaries
  // consistent with ages entered in years or months, without changing other labs.
  const daysPerYear = test.referenceAgeDaysPerYear || 365.25;
  const scale = unit => ['d', 'days'].includes(unit) ? 1 / daysPerYear : AGE_SCALE[unit] || 1;
  const years = age == null ? null : age * scale(patient.ageUnit);
  const sex = String(patient.gender || '').toLowerCase();
  if (bands.length) {
    const matching = bands.filter((band) => {
      const min = numeric(band.ageMin), max = numeric(band.ageMax);
      return (band.sex === 'Any' || String(band.sex).toLowerCase() === sex)
        && (min == null || (years != null && years >= min * scale(band.ageMinUnit)))
        && (max == null || (years != null && years <= max * scale(band.ageMaxUnit)));
    }).sort((a, b) => {
      const sexOrder = (a.sex === 'Any' ? 1 : 0) - (b.sex === 'Any' ? 1 : 0);
      if (sexOrder) return sexOrder;
      const minOrder = (numeric(b.ageMin) ?? 0) * scale(b.ageMinUnit) - (numeric(a.ageMin) ?? 0) * scale(a.ageMinUnit);
      if (minOrder) return minOrder;
      const specificity = (band) => (band.sex === 'Any' ? 1e6 : 0)
        + ((numeric(band.ageMax) ?? 10000) * scale(band.ageMaxUnit) - (numeric(band.ageMin) ?? 0) * scale(band.ageMinUnit));
      return specificity(a) - specificity(b);
    });
    if (!matching.length) return { ...test, referenceRange: 'No reference range configured for this age / sex', normalLow: null, normalHigh: null, criticalLow: null, criticalHigh: null, rangeMissing: true };
    const band = matching[0];
    const bounds = parseBounds(band.referenceRange) || {};
    return { ...test, ...bounds, ...Object.fromEntries(['normalLow', 'normalHigh', 'criticalLow', 'criticalHigh'].map((key) => [key, band[key] ?? bounds[key] ?? null])),
      lowInclusive: band.lowInclusive ?? bounds.lowInclusive, highInclusive: band.highInclusive ?? bounds.highInclusive,
      referenceRange: band.referenceRange || formatBounds(band), rangeMissing: false };
  }
  const sexRange = sex === 'male' ? test.maleReferenceRange : sex === 'female' ? test.femaleReferenceRange : '';
  const outsideAge = (test.ageMin != null && (years == null || years < test.ageMin))
    || (test.ageMax != null && (years == null || years > test.ageMax));
  const outsideSex = test.sexApplicable && test.sexApplicable !== 'Any' && test.sexApplicable.toLowerCase() !== sex;
  if (outsideAge || outsideSex) return { ...test, referenceRange: 'No reference range configured for this age / sex', normalLow: null, normalHigh: null, criticalLow: null, criticalHigh: null, rangeMissing: true };
  const referenceRange = sexRange || test.referenceRange || '';
  const bounds = parseBounds(referenceRange);
  return { ...test, ...(bounds || {}), referenceRange };
}

function formatBounds(range) {
  if (range.normalLow != null && range.normalHigh != null) return `${range.normalLow} - ${range.normalHigh}`;
  if (range.normalLow != null) return `>= ${range.normalLow}`;
  if (range.normalHigh != null) return `<= ${range.normalHigh}`;
  return '';
}

module.exports = { parseBounds, parseAgeRanges, resolveReferenceRange };
