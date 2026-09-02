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

export const validateNumber = (val) => {
  const num = Number(val);
  return !isNaN(num) && num >= 0;
};
