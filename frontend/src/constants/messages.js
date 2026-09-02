export const SUCCESS_MESSAGES = {
  LOGIN: 'Successfully logged in to Pure Path Lab dashboard.',
  LOGOUT: 'Logged out. Have a nice day!',
  CREATE_PATIENT: 'Patient profile registered successfully.',
  CREATE_BILL: 'Invoice generated successfully.',
  UPDATE_PAYMENT: 'Payment recorded and balance updated.',
  CREATE_TEST: 'Diagnostic test recorded in database.',
  UPLOAD_REPORT: 'Report file attachment uploaded successfully.'
};

export const ERROR_MESSAGES = {
  DEFAULT: 'Something went wrong. Please try again.',
  REQUIRED: 'This field is required.',
  MIN_LENGTH: (min) => `Must be at least ${min} characters.`,
  EMAIL: 'Please enter a valid email address.',
  NUMBER: 'Please enter a valid number.'
};
