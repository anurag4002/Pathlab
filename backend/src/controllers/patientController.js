const patientService = require('../services/patientService');
const Bill = require('../models/Bill');
const Report = require('../models/Report');
const Transaction = require('../models/Transaction');
const Activity = require('../models/Activity');
const { successResponse, errorResponse } = require('../utils/response');
const { validatePatient } = require('../validators/patientValidator');
const MESSAGES = require('../constants/messages');

const getPatients = async (req, res, next) => {
  try {
    const filters = {
      search: req.query.search,
      page: req.query.page,
      limit: req.query.limit
    };
    const data = await patientService.getAllPatients(filters);
    return successResponse(res, 'Patients list fetched successfully', data);
  } catch (error) {
    next(error);
  }
};

const getPatientDetails = async (req, res, next) => {
  try {
    const { id } = req.params;
    const patient = await patientService.getPatientById(id);
    if (!patient) {
      return errorResponse(res, MESSAGES.PATIENT.NOT_FOUND, 404);
    }

    // Fetch related cases / history
    const bills = await Bill.find({ patient: id })
      .populate('referringDoctor', 'name')
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 });

    const reports = await Report.find({ patient: id })
      .populate('test', 'name code')
      .populate('bill', 'billNumber')
      .sort({ createdAt: -1 });

    const transactions = await Transaction.find({ patient: id })
      .populate('bill', 'billNumber')
      .sort({ createdAt: -1 });

    const patientDetails = {
      patient,
      bills,
      reports,
      transactions
    };

    return successResponse(res, 'Patient details loaded successfully', patientDetails);
  } catch (error) {
    next(error);
  }
};

const createPatient = async (req, res, next) => {
  try {
    const { errors, isValid } = validatePatient(req.body);
    if (!isValid) {
      return errorResponse(res, MESSAGES.GENERAL.VALIDATION_ERROR, 400, errors);
    }

    const patient = await patientService.createPatient(req.body);

    // Log Activity
    await Activity.create({
      user: req.user._id,
      action: 'Create Patient',
      module: 'Cases',
      description: `Registered patient ${patient.name} (${patient.registrationNumber}).`
    });

    return successResponse(res, MESSAGES.PATIENT.CREATED, patient, 201);
  } catch (error) {
    next(error);
  }
};

const updatePatient = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { errors, isValid } = validatePatient(req.body);
    if (!isValid) {
      return errorResponse(res, MESSAGES.GENERAL.VALIDATION_ERROR, 400, errors);
    }

    const patient = await patientService.updatePatient(id, req.body);
    if (!patient) {
      return errorResponse(res, MESSAGES.PATIENT.NOT_FOUND, 404);
    }

    // Log Activity
    await Activity.create({
      user: req.user._id,
      action: 'Update Patient',
      module: 'Cases',
      description: `Updated patient details for ${patient.name} (${patient.registrationNumber}).`
    });

    return successResponse(res, MESSAGES.PATIENT.UPDATED, patient);
  } catch (error) {
    next(error);
  }
};

const deletePatient = async (req, res, next) => {
  try {
    const { id } = req.params;
    const patient = await patientService.deletePatient(id);
    if (!patient) {
      return errorResponse(res, MESSAGES.PATIENT.NOT_FOUND, 404);
    }

    // Log Activity
    await Activity.create({
      user: req.user._id,
      action: 'Delete Patient',
      module: 'Cases',
      description: `Deleted patient file of ${patient.name} (${patient.registrationNumber}).`
    });

    return successResponse(res, MESSAGES.PATIENT.DELETED);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getPatients,
  getPatientDetails,
  createPatient,
  updatePatient,
  deletePatient
};
