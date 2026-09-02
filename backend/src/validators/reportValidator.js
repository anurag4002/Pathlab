const validateReport = (data) => {
  const errors = {};

  if (!data.patient) {
    errors.patient = 'Patient ID is required';
  }

  if (!data.registrationNumber || data.registrationNumber.trim() === '') {
    errors.registrationNumber = 'Registration number is required';
  }

  if (!data.bill) {
    errors.bill = 'Bill ID is required';
  }

  return {
    errors,
    isValid: Object.keys(errors).length === 0
  };
};

module.exports = {
  validateReport
};
