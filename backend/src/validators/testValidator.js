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

  return {
    errors,
    isValid: Object.keys(errors).length === 0
  };
};

module.exports = {
  validateTest
};
