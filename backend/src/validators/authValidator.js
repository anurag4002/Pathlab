const validateLogin = (data) => {
  const errors = {};
  
  if (!data.email) {
    errors.email = 'Email or phone is required';
  }
  
  if (!data.password) {
    errors.password = 'Password is required';
  } else if (data.password.length < 4) {
    errors.password = 'Password must be at least 4 characters long';
  }

  return {
    errors,
    isValid: Object.keys(errors).length === 0
  };
};

const validateUserCreate = (data) => {
  const errors = {};

  if (!data.name || data.name.trim() === '') {
    errors.name = 'Name is required';
  }

  if (!data.email) {
    errors.email = 'Email is required';
  } else if (!/\S+@\S+\.\S+/.test(data.email)) {
    errors.email = 'Email address is invalid';
  }

  if (!data.phone || data.phone.trim() === '') {
    errors.phone = 'Phone number is required';
  }

  if (!data.role) {
    errors.role = 'Role is required';
  } else if (!['Admin', 'Employee', 'Doctor'].includes(data.role)) {
    errors.role = 'Invalid role specified';
  }

  if (!data.password) {
    errors.password = 'Password is required';
  } else if (data.password.length < 4) {
    errors.password = 'Password must be at least 4 characters';
  }

  return {
    errors,
    isValid: Object.keys(errors).length === 0
  };
};

module.exports = {
  validateLogin,
  validateUserCreate
};
