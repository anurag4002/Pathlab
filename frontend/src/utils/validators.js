export const validateEmail = (email) => {
  if (!email) return false;
  const re = /\S+@\S+\.\S+/;
  return re.test(email);
};

export const validatePhone = (phone) => {
  if (!phone) return false;
  const re = /^\+?[0-9\s-]{7,15}$/;
  return re.test(phone);
};

// The lab can list more than one number, separated by commas or slashes
// ("9194112151, 9194102151"); each one must be a valid phone number.
export const validatePhoneList = (value) => {
  const parts = String(value || '').split(/[,/;]/).map((part) => part.trim());
  return parts.length > 0 && parts.every(validatePhone);
};

export const validateNumber = (val) => {
  const num = Number(val);
  return !isNaN(num) && num >= 0;
};
