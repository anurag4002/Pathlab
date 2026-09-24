const Patient = require('../models/Patient');
const generateRegistrationNumber = require('../utils/generateRegistrationNumber');

const getAllPatients = async (filters = {}) => {
  const query = {};
  if (filters.branch) query.branch = filters.branch;

  // Labsmart §11 split filters: UHID / First / Last / Mobile / ID / From-To
  if (filters.uhid) query.uhid = { $regex: String(filters.uhid), $options: 'i' };
  if (filters.firstName) query.name = { $regex: String(filters.firstName), $options: 'i' };
  if (filters.lastName) {
    // Last token of name matches last name
    query.name = { $regex: `${String(filters.lastName)}`, $options: 'i' };
  }
  if (filters.mobile || filters.phone) {
    const v = String(filters.mobile || filters.phone);
    query.phone = { $regex: v, $options: 'i' };
  }
  if (filters.patientId || filters.id) {
    const v = String(filters.patientId || filters.id);
    // Match registrationNumber or _id
    query.$and = query.$and || [];
    const or = [{ registrationNumber: { $regex: v, $options: 'i' } }];
    if (v.match(/^[0-9a-fA-F]{24}$/)) { try { or.push({ _id: v }); } catch (e) { /* ignore */ } }
    query.$and.push({ $or: or });
  }
  if (filters.regNo) query.registrationNumber = { $regex: String(filters.regNo), $options: 'i' };
  if (filters.from || filters.to || filters.startDate || filters.endDate) {
    query.createdAt = {};
    const from = filters.from || filters.startDate;
    const to = filters.to || filters.endDate;
    if (from) query.createdAt.$gte = new Date(from);
    if (to) { const e = new Date(to); e.setHours(23, 59, 59, 999); query.createdAt.$lte = e; }
  }

  if (filters.search) {
    query.$and = query.$and || [];
    query.$and.push({
      $or: [
        { name: { $regex: filters.search, $options: 'i' } },
        { phone: { $regex: filters.search, $options: 'i' } },
        { registrationNumber: { $regex: filters.search, $options: 'i' } },
        { uhid: { $regex: filters.search, $options: 'i' } }
      ]
    });
  }

  // Support pagination
  const page = parseInt(filters.page) || 1;
  const limit = parseInt(filters.limit) || 10;
  const skip = (page - 1) * limit;

  const patients = await Patient.find(query)
    .populate('referringDoctor', 'name clinicHospital')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const total = await Patient.countDocuments(query);

  return {
    patients,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit)
    }
  };
};

const getPatientById = async (id) => {
  return await Patient.findById(id).populate('referringDoctor');
};

const createPatient = async (patientData) => {
  const registrationNumber = await generateRegistrationNumber();
  const patient = new Patient({
    ...patientData,
    registrationNumber
  });
  return await patient.save();
};

const assertPatientAccess = async (patientId, req) => {
  const { assertBranchAccess } = require('../middleware/branchMiddleware');
  const doc = await Patient.findById(patientId).select('branch');
  if (!doc) {
    const err = new Error('Patient not found');
    err.statusCode = 404;
    throw err;
  }
  assertBranchAccess(req, doc.branch);
  return doc;
};

const updatePatient = async (id, patientData) => {
  return await Patient.findByIdAndUpdate(id, patientData, {
    new: true,
    runValidators: true
  });
};

const deletePatient = async (id) => {
  return await Patient.findByIdAndDelete(id);
};

module.exports = {
  getAllPatients,
  getPatientById,
  createPatient,
  updatePatient,
  deletePatient,
  assertPatientAccess
};
