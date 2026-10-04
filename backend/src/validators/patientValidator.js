const GENDERS = ['Male', 'Female', 'Other'];
const PHONE_RE = /^\+?[0-9\s-]{7,15}$/;

const validateAge = (age, errors, ageUnit = 'years') => {
  const scales = { years: 1, months: 1 / 12, days: 1 / 365.25 };
  if (!scales[ageUnit]) errors.ageUnit = 'Age unit must be years, months or days';
  if (age === undefined || age === null || age === '') {
    errors.age = 'Age is required';
    return;
  }
  const ageNum = Number(age);
  if (!Number.isFinite(ageNum) || ageNum < 0 || ageNum * (scales[ageUnit] || 1) > 150) {
    errors.age = 'Age must be a non-negative number of at most 150 years';
  }
};

const validateGender = (gender, errors) => {
  if (!gender) {
    errors.gender = 'Gender is required';
  } else if (!GENDERS.includes(gender)) {
    errors.gender = 'Gender must be Male, Female, or Other';
  }
};

const validatePhone = (phone, errors) => {
  if (!phone || String(phone).trim() === '') {
    errors.phone = 'Phone number is required';
  } else if (!PHONE_RE.test(String(phone).trim())) {
    errors.phone = 'Phone number format is invalid';
  }
};

/** Full create — name / age / gender / phone required. Profile extras optional. */
const validatePatient = (data) => {
  const errors = {};

  if (!data.name || String(data.name).trim() === '') {
    errors.name = 'Patient name is required';
  }
  validateAge(data.age, errors, data.ageUnit || 'years');
  validateGender(data.gender, errors);
  validatePhone(data.phone, errors);

  return {
    errors,
    isValid: Object.keys(errors).length === 0
  };
};

/**
 * Partial update (e.g. billing sync of email/address/aadhaar/history).
 * Only validates fields that are present — name is not required.
 */
const validatePatientUpdate = (data) => {
  const errors = {};

  if (data.name !== undefined && (!data.name || String(data.name).trim() === '')) {
    errors.name = 'Patient name is required';
  }
  if (data.age !== undefined && data.age !== null && data.age !== '') {
    validateAge(data.age, errors, data.ageUnit || 'years');
  }
  if (data.ageUnit !== undefined && !['years', 'months', 'days'].includes(data.ageUnit)) errors.ageUnit = 'Age unit must be years, months or days';
  if (data.gender !== undefined) {
    if (!data.gender || !GENDERS.includes(data.gender)) {
      errors.gender = 'Gender must be Male, Female, or Other';
    }
  }
  if (data.phone !== undefined) {
    if (!data.phone || String(data.phone).trim() === '') {
      errors.phone = 'Phone number is required';
    } else if (!PHONE_RE.test(String(data.phone).trim())) {
      errors.phone = 'Phone number format is invalid';
    }
  }
  if (data.email !== undefined && data.email !== null && String(data.email).trim() !== '') {
    const email = String(data.email).trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = 'Email format is invalid';
    }
  }

  return {
    errors,
    isValid: Object.keys(errors).length === 0
  };
};

module.exports = {
  validatePatient,
  validatePatientUpdate
};
