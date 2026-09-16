const crypto = require('crypto');
const LabProfile = require('../models/LabProfile');
const OnboardingProgress = require('../models/OnboardingProgress');
const Signature = require('../models/Signature');
const WebBrowser = require('../models/WebBrowser');
const storageService = require('../services/storageService');
const { ONBOARDING_STEPS } = require('../constants/onboarding');
const { successResponse, errorResponse } = require('../utils/response');
const Activity = require('../models/Activity');

const getProfile = async (req, res, next) => {
  try {
    let profile = await LabProfile.findOne();
    if (!profile) profile = await LabProfile.create({});
    return successResponse(res, 'Lab profile loaded', profile);
  } catch (error) {
    next(error);
  }
};

const updateProfile = async (req, res, next) => {
  try {
    const allowed = ['labName', 'tagline', 'phone', 'address', 'email', 'letterheadTopMargin', 'showLetterheadByDefault', 'smsEnabled', 'whatsappEnabled', 'emailEnabled', 'smsSenderId', 'googleReviewLink', 'caseStartNumber'];
    const patch = {};
    allowed.forEach((k) => { if (req.body[k] !== undefined) patch[k] = req.body[k]; });
    let profile = await LabProfile.findOne();
    if (!profile) profile = new LabProfile(patch);
    else Object.assign(profile, patch);
    await profile.save();
    return successResponse(res, 'Lab profile updated', profile);
  } catch (error) {
    next(error);
  }
};

const uploadAsset = (field) => async (req, res, next) => {
  try {
    if (!req.file) return errorResponse(res, 'Please upload a file', 400);
    let profile = await LabProfile.findOne();
    if (!profile) profile = new LabProfile({});
    const fileUrl = `uploads/letterheads/${req.file.filename}`;
    if (field === 'logo') profile.logoUrl = fileUrl;
    else profile.letterheadUrl = fileUrl;
    await profile.save();
    await Activity.create({
      user: req.user._id, action: 'Upload Letterhead', module: 'Settings',
      description: `Updated lab ${field}.`, ip: req.ip, userAgent: req.headers['user-agent'] || ''
    });
    return successResponse(res, 'Asset uploaded', profile, 201);
  } catch (error) {
    next(error);
  }
};

// ---- Onboarding ----

const getOnboarding = async (req, res, next) => {
  try {
    let doc = await OnboardingProgress.findOne({ key: 'default' });
    if (!doc) doc = await OnboardingProgress.create({ key: 'default', steps: {} });
    const done = ONBOARDING_STEPS.filter((s) => doc.steps.get(s.key)).length;
    return successResponse(res, 'Onboarding progress loaded', {
      steps: ONBOARDING_STEPS.map((s) => ({ ...s, done: !!doc.steps.get(s.key) })),
      done,
      total: ONBOARDING_STEPS.length,
      percent: Math.round((done / ONBOARDING_STEPS.length) * 100)
    });
  } catch (error) {
    next(error);
  }
};

const setOnboardingStep = async (req, res, next) => {
  try {
    const { key, done } = req.body;
    if (!ONBOARDING_STEPS.find((s) => s.key === key)) return errorResponse(res, 'Unknown checklist step', 400);
    let doc = await OnboardingProgress.findOne({ key: 'default' });
    if (!doc) doc = new OnboardingProgress({ key: 'default', steps: {} });
    doc.steps.set(key, done !== false);
    doc.updatedBy = req.user._id;
    await doc.save();
    return successResponse(res, 'Checklist updated', { key, done: done !== false });
  } catch (error) {
    next(error);
  }
};

// ---- Signatures ----

const listSignatures = async (req, res, next) => {
  try {
    const docs = await Signature.find().sort({ createdAt: -1 });
    return successResponse(res, 'Signatures loaded', docs);
  } catch (error) {
    next(error);
  }
};

const createSignature = async (req, res, next) => {
  try {
    const { name, title, modalities } = req.body;
    if (!name) return errorResponse(res, 'Signature name is required', 400);
    if (!req.file) return errorResponse(res, 'Signature image is required', 400);
    const doc = await Signature.create({
      name,
      title: title || '',
      imageUrl: `uploads/signatures/${req.file.filename}`,
      modalities: Array.isArray(modalities) ? modalities : (modalities ? [modalities] : []),
      createdBy: req.user._id
    });
    return successResponse(res, 'Signature added', doc, 201);
  } catch (error) {
    next(error);
  }
};

const deleteSignature = async (req, res, next) => {
  try {
    const doc = await Signature.findById(req.params.id);
    if (!doc) return errorResponse(res, 'Signature not found', 404);
    if (doc.imageUrl) await storageService.deleteFile(doc.imageUrl);
    await Signature.findByIdAndDelete(req.params.id);
    return successResponse(res, 'Signature removed');
  } catch (error) {
    next(error);
  }
};

// ---- Browser allow-list ----

const listBrowsers = async (req, res, next) => {
  try {
    const docs = await WebBrowser.find().sort({ createdAt: -1 });
    // Real session feed: recent login activity with captured IP/UA.
    const logins = await Activity.find({ module: 'Authentication', action: /login/i })
      .populate('user', 'name role')
      .sort({ date: -1 })
      .limit(50);
    return successResponse(res, 'Browsers loaded', { browsers: docs, recentLogins: logins });
  } catch (error) {
    next(error);
  }
};

const createBrowser = async (req, res, next) => {
  try {
    const { label, code } = req.body;
    const finalCode = (code || '').trim() || crypto.randomBytes(3).toString('hex').toUpperCase();
    const doc = await WebBrowser.create({ code: finalCode, label: label || '', createdBy: req.user._id });
    return successResponse(res, 'Browser registered', doc, 201);
  } catch (error) {
    if (error.code === 11000) return errorResponse(res, 'Browser code already exists', 409);
    next(error);
  }
};

const setBrowserStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!['Active', 'Blocked'].includes(status)) return errorResponse(res, 'Invalid status', 400);
    const doc = await WebBrowser.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!doc) return errorResponse(res, 'Browser not found', 404);
    return successResponse(res, 'Browser updated', doc);
  } catch (error) {
    next(error);
  }
};

const deleteBrowser = async (req, res, next) => {
  try {
    const doc = await WebBrowser.findByIdAndDelete(req.params.id);
    if (!doc) return errorResponse(res, 'Browser not found', 404);
    return successResponse(res, 'Browser removed');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getProfile,
  updateProfile,
  uploadLogo: uploadAsset('logo'),
  uploadLetterhead: uploadAsset('letterhead'),
  getOnboarding,
  setOnboardingStep,
  listSignatures,
  createSignature,
  deleteSignature,
  listBrowsers,
  createBrowser,
  setBrowserStatus,
  deleteBrowser
};
