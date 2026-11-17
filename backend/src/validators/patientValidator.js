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

// Phone is optional; when given it must look like a phone number.
const validatePhone = (phone, errors) => {
  if (phone !== undefined && phone !== null && String(phone).trim() !== '' && !PHONE_RE.test(String(phone).trim())) {
    errors.phone = 'Phone number format is invalid';
  }
};

const hasValue = (v) => v !== undefined && v !== null && String(v).trim() !== '';
const hasPhone = hasValue;
const BIRTH_YEAR_NEEDED = 'Birth year is required when a phone number is given. It is the patient password for online reports and booking.';

/** Full create — name / age / gender required; phone optional. Profile extras optional. */
const validatePatient = (data) => {
  const errors = {};
  if (data.birthYear !== undefined && data.birthYear !== null && data.birthYear !== '' && (!Number.isInteger(Number(data.birthYear)) || Number(data.birthYear) < 1850 || Number(data.birthYear) > Number(new Intl.DateTimeFormat('en', { timeZone: 'Asia/Kolkata', year: 'numeric' }).format(new Date())))) errors.birthYear = 'Enter a valid four-digit birth year';

  if (!data.name || String(data.name).trim() === '') {
    errors.name = 'Patient name is required';
  }
  validateAge(data.age, errors, data.ageUnit || 'years');
  validateGender(data.gender, errors);
  validatePhone(data.phone, errors);
  // The birth year is the patient's password for online reports and booking,
  // so a patient with a phone number must have one.
  if (hasPhone(data.phone) && !hasValue(data.birthYear) && !errors.birthYear) errors.birthYear = BIRTH_YEAR_NEEDED;

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
  if (data.birthYear !== undefined && data.birthYear !== null && data.birthYear !== '' && (!Number.isInteger(Number(data.birthYear)) || Number(data.birthYear) < 1850 || Number(data.birthYear) > Number(new Intl.DateTimeFormat('en', { timeZone: 'Asia/Kolkata', year: 'numeric' }).format(new Date())))) errors.birthYear = 'Enter a valid four-digit birth year';

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
  if (data.phone !== undefined) validatePhone(data.phone, errors);
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
  BIRTH_YEAR_NEEDED,
  validatePatient,
  validatePatientUpdate
};
