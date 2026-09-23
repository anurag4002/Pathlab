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

  return {
    errors,
    isValid: Object.keys(errors).length === 0
  };
};

module.exports = {
  validateTest
};
