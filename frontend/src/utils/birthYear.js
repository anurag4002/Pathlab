// A patient's birth year is their password for online reports and booking,
// so it is needed whenever a phone number is given.
export const birthYearError = (phone, birthYear) => {
  const year = String(birthYear ?? '').trim();
  if (String(phone ?? '').trim() && !year) return 'Birth year is needed when a phone number is given';
  if (year && (!/^\d{4}$/.test(year) || Number(year) < 1850 || Number(year) > new Date().getFullYear())) return 'Enter a four-digit birth year';
  return '';
};

export default birthYearError;
