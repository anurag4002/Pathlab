const validatePatient = (data) => {
  const errors = {};

  if (!data.name || data.name.trim() === '') {
    errors.name = 'Patient name is required';
  }

  if (data.age === undefined || data.age === null || data.age === '') {
    errors.age = 'Age is required';
  } else {
    const ageNum = Number(data.age);
    if (isNaN(ageNum) || ageNum < 0 || ageNum > 150) {
      errors.age = 'Age must be a number between 0 and 150';
    }
  }

  if (!data.gender) {
    errors.gender = 'Gender is required';
  } else if (!['Male', 'Female', 'Other'].includes(data.gender)) {
    errors.gender = 'Gender must be Male, Female, or Other';
  }

  if (!data.phone || data.phone.trim() === '') {
    errors.phone = 'Phone number is required';
  } else if (!/^\+?[0-9\s-]{7,15}$/.test(data.phone.trim())) {
    errors.phone = 'Phone number format is invalid';
  }

  return {
    errors,
    isValid: Object.keys(errors).length === 0
  };
};

module.exports = {
  validatePatient
};
