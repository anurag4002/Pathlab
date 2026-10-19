const USG_PATTERN = /\bUSG\b|ultrasound|ultrasonogra|sonography/i;
const XRAY_PATTERN = /\bx[\s-]?ray\b|radiograph/i;
const ECG_PATTERN = /\bECG\b|\bEKG\b|electrocardio/i;

function imagingDepartment(item = {}) {
  const name = String(item.name || '');
  // A renamed ECG may still have an old USG category/code.
  if (ECG_PATTERN.test(name)) return '';
  if (USG_PATTERN.test(name)) return 'USG';
  if (XRAY_PATTERN.test(name)) return 'XRAY';
  return ['USG', 'XRAY'].includes(item.reportDepartment) ? item.reportDepartment : '';
}

module.exports = { imagingDepartment, USG_PATTERN, XRAY_PATTERN, ECG_PATTERN };
