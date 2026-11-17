// Title (Mr / Mrs / ...) must agree with the patient's sex: a female title
// cannot be billed as Male, and Mr cannot be billed as Female.
// Titles that fit anyone (Baby, Dr, Child, Mx ...) are not checked.
// Keep in sync with frontend/src/utils/titleSex.js.
const FEMALE_TITLES = ['mrs', 'mrs.', 'smt', 'smt.', 'kumari', 'km', 'miss', 'ms', 'ms.', 'miss-mrs', 'selvi', 'wife of', 'mother of', 'daughter of'];
const MALE_TITLES = ['mr', 'mr.', 'shri', 'sh', 'master', 'son of', 'mohd', 'md'];

const clean = (title) => String(title || '').trim().toLowerCase().replace(/\s+/g, ' ');

/** 'Female' / 'Male' for a title that implies one, otherwise null. */
const sexForTitle = (title) => {
  const t = clean(title);
  if (FEMALE_TITLES.includes(t)) return 'Female';
  if (MALE_TITLES.includes(t)) return 'Male';
  return null;
};

/** A plain message when title and sex disagree, otherwise ''. */
const titleSexMismatch = (title, gender) => {
  const expected = sexForTitle(title);
  if (!expected || !gender) return '';
  if (String(gender).toLowerCase() === expected.toLowerCase()) return '';
  return `Title "${String(title).trim()}" is for a ${expected.toLowerCase()} patient, but the sex is ${gender}. Change the title or the sex.`;
};

module.exports = { sexForTitle, titleSexMismatch, FEMALE_TITLES, MALE_TITLES };
