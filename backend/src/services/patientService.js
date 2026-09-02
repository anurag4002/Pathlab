const Patient = require('../models/Patient');
const generateRegistrationNumber = require('../utils/generateRegistrationNumber');

const getAllPatients = async (filters = {}) => {
  const query = {};

  if (filters.search) {
    query.$or = [
      { name: { $regex: filters.search, $options: 'i' } },
      { phone: { $regex: filters.search, $options: 'i' } },
      { registrationNumber: { $regex: filters.search, $options: 'i' } }
    ];
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
  deletePatient
};
