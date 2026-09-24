const USGCase = require('../models/USGCase');
const Patient = require('../models/Patient');
const { successResponse, errorResponse } = require('../utils/response');
const Activity = require('../models/Activity');

const { getBranchFilter, resolveBranchForCreate, assertBranchAccess } = require('../middleware/branchMiddleware');

const getUSGCases = async (req, res, next) => {
  try {
    const { search, date, status } = req.query;
    const query = { ...getBranchFilter(req) };

    if (status) query.status = status;
    
    if (date) {
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(date);
      end.setHours(23, 59, 59, 999);
      query.date = { $gte: start, $lte: end };
    }

    if (search) {
      const patients = await Patient.find({
        name: { $regex: search, $options: 'i' }
      }).select('_id');
      query.patient = { $in: patients.map(p => p._id) };
    }

    const cases = await USGCase.find(query)
      .populate('patient')
      .populate('referringDoctor')
      .sort({ date: -1 });

    return successResponse(res, 'USG cases loaded successfully', cases);
  } catch (error) {
    next(error);
  }
};

const createUSGCase = async (req, res, next) => {
  try {
    const { patient, referringDoctor, templateName, findings, signatureUrl, status } = req.body;

    if (!patient || !findings) {
      return errorResponse(res, 'Patient and findings text are required', 400);
    }

    const newCase = await USGCase.create({
      patient,
      branch: resolveBranchForCreate(req, req.body),
      referringDoctor: referringDoctor || null,
      templateName,
      findings,
      signatureUrl,
      status: status || 'Completed'
    });

    const populatedCase = await USGCase.findById(newCase._id)
      .populate('patient')
      .populate('referringDoctor');

    // Log Activity
    await Activity.create({
      user: req.user._id,
      action: 'Create USG Case',
      module: 'USG',
      description: `Created USG case record for patient ${populatedCase.patient.name}.`
    });

    return successResponse(res, 'USG case created successfully', populatedCase, 201);
  } catch (error) {
    next(error);
  }
};

const getUSGTemplates = async (req, res, next) => {
  // Static USG templates reference list
  const templates = [
    {
      name: 'Abdomen & Pelvis (Normal)',
      findings: 'LIVER: Normal size, shape, and echotexture. No focal lesion. Biliary tree is normal.\nGALLBLADDER: Well distended, wall thickness is normal. No calculus seen.\nSPLEEN: Normal size and shape. Echotexture is normal.\nPANCREAS: Visualized portions are normal.\nKIDNEYS: Normal size and position. Normal cortical thickness and corticomedullary differentiation. No calculus or hydronephrosis.\nBLADDER: Well distended, wall thickness is normal. No calculus or mass.\nIMPRESSION: Normal scan of Abdomen & Pelvis.'
    },
    {
      name: 'Obstetric Scan (First Trimester)',
      findings: 'Uterus is gravid. Single gestational sac is noted.\nFetal cardiac activity is present and normal.\nMean gestational age is approximately 8 weeks 4 days (+/- 1 week).\nNo subchorionic hemorrhage or adnexal mass detected.\nIMPRESSION: Live intrauterine gestation of approx 8 weeks.'
    },
    {
      name: 'Renal Ultrasound (Normal)',
      findings: 'RIGHT KIDNEY: Measures 10.2 cm. Normal parenchyma. No hydronephrosis or stone.\nLEFT KIDNEY: Measures 10.5 cm. Normal parenchyma. No hydronephrosis or stone.\nURINARY BLADDER: Distended, normal wall thickness. Empty post-void volume is within normal limits.\nIMPRESSION: Normal Renal Ultrasound.'
    }
  ];
  return successResponse(res, 'USG templates loaded', templates);
};

const updateUSGCase = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { findings, templateName, referringDoctor, signatureUrl, status } = req.body;

    const usgCase = await USGCase.findById(id);
    if (!usgCase) return errorResponse(res, 'USG Case not found', 404);
    try { assertBranchAccess(req, usgCase.branch); } catch (e) { return errorResponse(res, 'Access denied for this branch', 403); }

    if (findings) usgCase.findings = findings;
    if (templateName) usgCase.templateName = templateName;
    if (referringDoctor) usgCase.referringDoctor = referringDoctor;
    if (signatureUrl) usgCase.signatureUrl = signatureUrl;
    if (status) usgCase.status = status;

    await usgCase.save();

    const populatedCase = await USGCase.findById(usgCase._id)
      .populate('patient')
      .populate('referringDoctor');

    // Log Activity
    await Activity.create({
      user: req.user._id,
      action: 'Update USG Case',
      module: 'USG',
      description: `Updated USG findings for patient ${populatedCase.patient.name}.`
    });

    return successResponse(res, 'USG findings updated', populatedCase);
  } catch (error) {
    next(error);
  }
};

const getUSGCaseById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const usgCase = await USGCase.findById(id)
      .populate('patient')
      .populate('referringDoctor');
    if (!usgCase) return errorResponse(res, 'USG Case not found', 404);
    try { assertBranchAccess(req, usgCase.branch); } catch (e) { return errorResponse(res, 'Access denied for this branch', 403); }
    return successResponse(res, 'USG case loaded successfully', usgCase);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getUSGCases,
  getUSGCaseById,
  createUSGCase,
  getUSGTemplates,
  updateUSGCase
};
