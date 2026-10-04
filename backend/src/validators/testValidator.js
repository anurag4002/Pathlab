const { parseBounds } = require('../services/referenceRangeService');
const validateTest = (data) => {
  const errors = {};

  if (!data.name || data.name.trim() === '') {
    errors.name = 'Test name is required';
  }

  if (!data.code || data.code.trim() === '') {
    errors.code = 'Test code is required';
  }

  if (!data.category) {
    errors.category = 'Test category ID is required';
  }

  if (!data.sampleType || data.sampleType.trim() === '') {
    errors.sampleType = 'Sample type is required';
  }

  if (data.price === undefined || data.price === null || data.price === '') {
    errors.price = 'Price is required';
  } else {
    const val = Number(data.price);
    if (isNaN(val) || val < 0) {
      errors.price = 'Price must be a positive number';
    }
  }

  const numOrNull = (v) => (v === undefined || v === null || v === '' ? null : Number(v));

  const normalLow = numOrNull(data.normalLow);
  const normalHigh = numOrNull(data.normalHigh);
  const criticalLow = numOrNull(data.criticalLow);
  const criticalHigh = numOrNull(data.criticalHigh);
  const ageMin = numOrNull(data.ageMin);
  const ageMax = numOrNull(data.ageMax);

  for (const [key, val] of [['normalLow', normalLow], ['normalHigh', normalHigh], ['criticalLow', criticalLow], ['criticalHigh', criticalHigh], ['ageMin', ageMin], ['ageMax', ageMax]]) {
    if (val !== null && isNaN(val)) errors[key] = `${key} must be a number`;
  }
  if (normalLow !== null && normalHigh !== null && !isNaN(normalLow) && !isNaN(normalHigh) && normalLow > normalHigh) {
    errors.normalHigh = 'normalHigh must be >= normalLow';
  }
  if (criticalLow !== null && normalLow !== null && !isNaN(criticalLow) && !isNaN(normalLow) && criticalLow > normalLow) {
    errors.criticalLow = 'criticalLow must be <= normalLow';
  }
  if (criticalHigh !== null && normalHigh !== null && !isNaN(criticalHigh) && !isNaN(normalHigh) && criticalHigh < normalHigh) {
    errors.criticalHigh = 'criticalHigh must be >= normalHigh';
  }
  if (ageMin !== null && !isNaN(ageMin) && ageMin < 0) errors.ageMin = 'ageMin must be >= 0';
  if (ageMax !== null && !isNaN(ageMax) && ageMax < 0) errors.ageMax = 'ageMax must be >= 0';
  if (ageMin !== null && ageMax !== null && !isNaN(ageMin) && !isNaN(ageMax) && ageMin > ageMax) {
    errors.ageMax = 'ageMax must be >= ageMin';
  }
  if (data.sexApplicable !== undefined && data.sexApplicable !== null && data.sexApplicable !== '' && !['Any', 'Male', 'Female'].includes(data.sexApplicable)) {
    errors.sexApplicable = 'sexApplicable must be Any, Male or Female';
  }
  if (data.isDerived === true && (!data.formula || String(data.formula).trim() === '')) {
    errors.formula = 'Derived tests require a formula';
  }

  if (data.referenceRanges !== undefined) {
    const bands = data.referenceRanges;
    if (!Array.isArray(bands) || bands.length > 100) errors.referenceRanges = 'Reference ranges must be an array of at most 100 bands';
    else bands.forEach((band, index) => {
      const prefix = `Age / sex range ${index + 1}`;
      const scales = { d: 1 / 365.25, mo: 1 / 12, y: 1 };
      if (!band || !['Any', 'Male', 'Female'].includes(band.sex || 'Any')) { errors.referenceRanges = `${prefix}: invalid sex`; return; }
      if (!scales[band.ageMinUnit || 'y'] || !scales[band.ageMaxUnit || 'y']) errors.referenceRanges = `${prefix}: invalid age unit`;
      const min = numOrNull(band.ageMin), max = numOrNull(band.ageMax);
      if ((min != null && (!Number.isFinite(min) || min < 0)) || (max != null && (!Number.isFinite(max) || max < 0))) errors.referenceRanges = `${prefix}: age must be a non-negative number`;
      if (min != null && max != null && min * scales[band.ageMinUnit || 'y'] > max * scales[band.ageMaxUnit || 'y']) errors.referenceRanges = `${prefix}: maximum age must follow minimum age`;
      const bounds = parseBounds(band.referenceRange);
      const low = numOrNull(band.normalLow) ?? bounds?.normalLow, high = numOrNull(band.normalHigh) ?? bounds?.normalHigh;
      for (const key of ['normalLow', 'normalHigh', 'criticalLow', 'criticalHigh']) {
        const value = numOrNull(band[key]);
        if (value != null && !Number.isFinite(value)) errors.referenceRanges = `${prefix}: ${key} must be finite`;
      }
      if (low != null && high != null && low > high) errors.referenceRanges = `${prefix}: high value must be at least the low value`;
      if (!String(band.referenceRange || '').trim() && low == null && high == null) errors.referenceRanges = `${prefix}: enter a reference range or numeric bounds`;
    });
  }
  if (data.parameters !== undefined) {
    if (!Array.isArray(data.parameters) || data.parameters.length > 100) errors.parameters = 'Parameters must be an array of at most 100 items';
    else {
      const codes = new Set();
      for (const parameter of data.parameters) {
        if (!parameter?.code || !parameter?.name || codes.has(String(parameter.code).toUpperCase())) errors.parameters = 'Each parameter needs a unique code and a name';
        codes.add(String(parameter?.code).toUpperCase());
        if (parameter?.isDerived && !String(parameter.formula || '').trim()) errors.parameters = 'Each calculated parameter requires a formula';
        if (parameter) {
          const validation = validateTest({ ...parameter, category: data.category, sampleType: data.sampleType, price: data.price, parameters: undefined });
          if (!validation.isValid) errors.parameters = `${parameter.name || 'Parameter'}: ${Object.values(validation.errors).join('; ')}`;
        }
      }
    }
  }
  if (data.resultOptions !== undefined && (!Array.isArray(data.resultOptions) || data.resultOptions.length > 50 || data.resultOptions.some((option) => typeof option !== 'string' || option.length > 100))) errors.resultOptions = 'Result options must contain at most 50 text choices';

  return {
    errors,
    isValid: Object.keys(errors).length === 0
  };
};

module.exports = {
  validateTest
};
