// "Mr Shivam" from title + name, without repeating the title when the name
// was saved with it already ("Mr Shivam" / "Mr. Shivam" as the name).
// Word boundary: a name like "Mrinal" still gets its "Mr".
const escape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const patientName = (patient) => {
  const name = String(patient?.name || '').trim();
  const title = String(patient?.title || '').trim().replace(/\.$/, '');
  if (!title) return name;
  if (!name) return '';
  return new RegExp(`^${escape(title)}\\.?(\\s|$)`, 'i').test(name) ? name : `${title} ${name}`;
};

export default patientName;
