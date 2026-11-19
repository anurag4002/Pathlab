const path = require('path');
const contentDisposition = require('content-disposition');

// Every report file the lab hands out - downloaded, printed, sent or opened
// from a QR / patient / doctor link - is named "<Reg no>-<Patient name>",
// e.g. "000009-Swati Soni.pdf".
const clean = (value) => String(value || '')
  .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

function reportFileName(registrationNumber, patientName, ext = '.pdf') {
  const base = [clean(registrationNumber), clean(patientName)].filter(Boolean).join('-') || 'Report';
  return `${base}${ext || '.pdf'}`;
}

// Same name for any report-like record (lab report, USG / X-ray / ECG case),
// loading the patient and bill number when they are not populated.
async function reportFileNameFor(record, ext = '.pdf') {
  const mongoose = require('mongoose');
  let patient = record?.patient;
  if (patient && !patient.name && mongoose.isValidObjectId(patient)) {
    patient = await mongoose.model('Patient').findById(patient).select('name registrationNumber').lean();
  }
  let bill = record?.bill;
  if (bill && !bill.billNumber && mongoose.isValidObjectId(bill)) {
    bill = await mongoose.model('Bill').findById(bill).select('billNumber').lean();
  }
  const registration = record?.registrationNumber || bill?.billNumber || patient?.registrationNumber;
  return reportFileName(registration, patient?.name, ext);
}

// Extension of a stored file name / path, defaulting to .pdf.
const extOf = (name) => path.extname(String(name || '')).toLowerCase() || '.pdf';

// Content-Disposition value that is safe for any patient name (Hindi etc.).
const disposition = (fileName, type = 'attachment') => contentDisposition(fileName, { type });

module.exports = { reportFileName, reportFileNameFor, extOf, disposition };
