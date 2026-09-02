const Report = require('../models/Report');
const Patient = require('../models/Patient');
const Bill = require('../models/Bill');
const fs = require('fs');
const path = require('path');

const getReports = async (filters = {}) => {
  const query = {};

  if (filters.patientId) query.patient = filters.patientId;
  if (filters.billId) query.bill = filters.billId;
  
  if (filters.registrationNumber) {
    query.registrationNumber = { $regex: filters.registrationNumber, $options: 'i' };
  }

  const page = parseInt(filters.page) || 1;
  const limit = parseInt(filters.limit) || 10;
  const skip = (page - 1) * limit;

  const reports = await Report.find(query)
    .populate('patient', 'name registrationNumber phone')
    .populate('bill', 'billNumber totalAmount paidAmount dueAmount')
    .populate('test', 'name code')
    .populate('uploadedBy', 'name')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const total = await Report.countDocuments(query);

  return {
    reports,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit)
    }
  };
};

const createReport = async (reportData, file, user) => {
  const { patient, bill, test } = reportData;

  const patientRecord = await Patient.findById(patient);
  if (!patientRecord) {
    throw new Error('Patient not found');
  }

  const billRecord = await Bill.findById(bill);
  if (!billRecord) {
    throw new Error('Bill invoice not found');
  }

  // File path relative to client server base
  const fileUrl = `uploads/reports/${file.filename}`;

  const report = new Report({
    patient,
    registrationNumber: patientRecord.registrationNumber,
    bill,
    test: test || null,
    fileUrl,
    uploadedBy: user._id,
    status: 'Completed'
  });

  return await report.save();
};

const deleteReport = async (id) => {
  const report = await Report.findById(id);
  if (!report) {
    throw new Error('Report not found');
  }

  // Delete physical file
  const filepath = path.resolve(__dirname, '../../', report.fileUrl);
  if (fs.existsSync(filepath)) {
    fs.unlinkSync(filepath);
  }

  return await Report.findByIdAndDelete(id);
};

module.exports = {
  getReports,
  createReport,
  deleteReport
};
