// Every report file the lab hands out is named "<Reg no>-<Patient name>",
// e.g. "000009-Swati Soni.pdf" (same rule as backend utils/reportFileName).
const clean = (value) => String(value || '')
  .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const extOf = (name) => {
  const match = /\.[a-z0-9]{2,5}$/i.exec(String(name || ''));
  return match ? match[0].toLowerCase() : '.pdf';
};

export const reportFileName = (registrationNumber, patientName, fromName) => {
  const base = [clean(registrationNumber), clean(patientName)].filter(Boolean).join('-') || 'Report';
  return `${base}${extOf(fromName)}`;
};

// For a report-like record: lab report, or a USG / X-ray / ECG case.
export const reportFileNameFor = (record, fromName) => {
  const patient = record?.patient && typeof record.patient === 'object' ? record.patient : {};
  const bill = record?.bill && typeof record.bill === 'object' ? record.bill : {};
  return reportFileName(record?.registrationNumber || bill.billNumber || patient.registrationNumber, patient.name || record?.patientName, fromName);
};

export default reportFileName;
