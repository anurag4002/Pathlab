const crypto = require('crypto');
const ModalityCase = require('../models/ModalityCase');
const USGCase = require('../models/USGCase');
const XrayCase = require('../models/XrayCase');
const storageService = require('../services/storageService');
const { successResponse, errorResponse } = require('../utils/response');
const Activity = require('../models/Activity');

const MODALITIES = ['CT', 'MRI', 'ECG', 'OPG', 'EEG', 'MAMMOGRAPHY', 'CARDIOLOGY', 'EPS', 'OUTSOURCE', 'USG', 'XRAY', 'LAB'];

// ---- Generic modality cases (CT/MRI/ECG/...) ----

const listCases = async (req, res, next) => {
  try {
    const query = {};
    if (req.query.modality) query.modality = String(req.query.modality).toUpperCase();
    if (req.query.patientId) query.patient = req.query.patientId;
    if (req.query.search) query.procedure = { $regex: req.query.search, $options: 'i' };
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const docs = await ModalityCase.find(query)
      .populate('patient', 'name registrationNumber phone age gender')
      .populate('bill', 'billNumber')
      .sort({ caseDate: -1 })
      .skip((page - 1) * limit)
      .limit(limit);
    const total = await ModalityCase.countDocuments(query);
    return successResponse(res, 'Cases loaded', { cases: docs, pagination: { total, page, limit, pages: Math.ceil(total / limit) } });
  } catch (error) {
    next(error);
  }
};

const createCase = async (req, res, next) => {
  try {
    const { patient, bill, modality, procedure, findings, impression, templateId, outsourcedTo } = req.body;
    if (!patient) return errorResponse(res, 'Patient is required', 400);
    if (!modality || !MODALITIES.includes(String(modality).toUpperCase())) {
      return errorResponse(res, `Modality must be one of ${MODALITIES.join(', ')}`, 400);
    }
    const doc = await ModalityCase.create({
      patient,
      bill: bill || null,
      modality: String(modality).toUpperCase(),
      procedure: procedure || '',
      findings: findings || '',
      impression: impression || '',
      templateId: templateId || '',
      outsourcedTo: outsourcedTo || '',
      qrToken: crypto.randomBytes(16).toString('hex'),
      createdBy: req.user._id
    });
    await Activity.create({
      user: req.user._id, action: 'Create Modality Case', module: 'Cases',
      description: `Registered ${doc.modality} case for patient ${patient}.`
    });
    return successResponse(res, 'Case registered', doc, 201);
  } catch (error) {
    next(error);
  }
};

const updateCase = async (req, res, next) => {
  try {
    const allowed = ['procedure', 'findings', 'impression', 'templateId', 'outsourcedTo', 'status', 'reportFileUrl'];
    const patch = {};
    allowed.forEach((k) => { if (req.body[k] !== undefined) patch[k] = req.body[k]; });
    const doc = await ModalityCase.findByIdAndUpdate(req.params.id, patch, { new: true });
    if (!doc) return errorResponse(res, 'Case not found', 404);
    return successResponse(res, 'Case updated', doc);
  } catch (error) {
    next(error);
  }
};

const deleteCase = async (req, res, next) => {
  try {
    const doc = await ModalityCase.findByIdAndDelete(req.params.id);
    if (!doc) return errorResponse(res, 'Case not found', 404);
    await Activity.create({
      user: req.user._id, action: 'Delete Modality Case', module: 'Cases',
      description: `Deleted ${doc.modality} case ${req.params.id}.`
    });
    return successResponse(res, 'Case deleted');
  } catch (error) {
    next(error);
  }
};

// ---- USG / X-Ray delete (P-9; Admin only at route) ----

const deleteUSGCase = async (req, res, next) => {
  try {
    const doc = await USGCase.findByIdAndDelete(req.params.id);
    if (!doc) return errorResponse(res, 'USG case not found', 404);
    await Activity.create({
      user: req.user._id, action: 'Delete USG Case', module: 'USG',
      description: `Deleted USG case ${req.params.id}.`
    });
    return successResponse(res, 'USG case deleted');
  } catch (error) {
    next(error);
  }
};

const deleteXrayCase = async (req, res, next) => {
  try {
    const doc = await XrayCase.findById(req.params.id);
    if (!doc) return errorResponse(res, 'X-Ray case not found', 404);
    if (doc.fileUrl) await storageService.deleteFile(doc.fileUrl);
    await XrayCase.findByIdAndDelete(req.params.id);
    await Activity.create({
      user: req.user._id, action: 'Delete X-Ray Case', module: 'XRay',
      description: `Deleted X-Ray case ${req.params.id}.`
    });
    return successResponse(res, 'X-Ray case deleted');
  } catch (error) {
    next(error);
  }
};

module.exports = { MODALITIES, listCases, createCase, updateCase, deleteCase, deleteUSGCase, deleteXrayCase };
