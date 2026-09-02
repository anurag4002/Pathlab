const MESSAGES = {
  AUTH: {
    LOGIN_SUCCESS: 'Logged in successfully',
    INVALID_CREDENTIALS: 'Invalid email/phone or password',
    UNAUTHORIZED: 'Unauthorized access',
    FORBIDDEN: 'Access forbidden',
    USER_NOT_FOUND: 'User profile not found',
    LOGOUT_SUCCESS: 'Logged out successfully'
  },
  PATIENT: {
    CREATED: 'Patient profile created successfully',
    UPDATED: 'Patient profile updated successfully',
    DELETED: 'Patient profile deleted successfully',
    NOT_FOUND: 'Patient profile not found'
  },
  BILL: {
    CREATED: 'Invoice generated successfully',
    UPDATED: 'Invoice details updated successfully',
    NOT_FOUND: 'Invoice not found',
    PAYMENT_ADDED: 'Payment transaction logged successfully'
  },
  TEST: {
    CREATED: 'Laboratory test recorded successfully',
    UPDATED: 'Laboratory test updated successfully',
    DELETED: 'Laboratory test deleted successfully',
    NOT_FOUND: 'Laboratory test not found'
  },
  DOCTOR: {
    CREATED: 'Referral doctor profile added',
    UPDATED: 'Referral doctor profile updated',
    DELETED: 'Referral doctor profile deleted',
    NOT_FOUND: 'Referral doctor profile not found'
  },
  REPORT: {
    UPLOADED: 'Report uploaded successfully',
    NOT_FOUND: 'Report file not found',
    DELETED: 'Report file deleted successfully'
  },
  GENERAL: {
    SERVER_ERROR: 'Internal server error. Please try again later',
    VALIDATION_ERROR: 'Validation error. Please verify input data',
    NOT_FOUND: 'Resource not found'
  }
};

module.exports = MESSAGES;
