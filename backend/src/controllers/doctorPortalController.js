const crypto = require('crypto');
const Bill = require('../models/Bill');
const Doctor = require('../models/Doctor');
const DoctorInvite = require('../models/DoctorInvite');
const User = require('../models/User');
const USGCase = require('../models/USGCase');
const XrayCase = require('../models/XrayCase');
const { successResponse, errorResponse } = require('../utils/response');

// Doctor's own cases: bills + USG/Xray referred by the linked Doctor record.
const myCases = async (req, res, next) => {
  try {
    const links = await Doctor.find({ linkedUser: req.user._id }).select('_id');
    const ids = links.map((d) => d._id);
    const bills = await Bill.find({ referringDoctor: { $in: ids }, isVoided: { $ne: true } })
      .populate('patient', 'name registrationNumber phone')
      .sort({ date: -1 })
      .limit(100);
    const usg = await USGCase.find({ referringDoctor: { $in: ids } })
      .populate('patient', 'name registrationNumber')
      .sort({ date: -1 })
      .limit(100);
    const xray = await XrayCase.find({ referringDoctor: { $in: ids } })
      .populate('patient', 'name registrationNumber')
      .sort({ date: -1 })
      .limit(100);
    const billed = bills.reduce((s, b) => s + (b.totalAmount || 0), 0);
    return successResponse(res, 'Doctor cases loaded', { bills, usg, xray, summary: { bills: bills.length, billed } });
  } catch (error) {
    next(error);
  }
};

// ---- Invites (Admin) ----

const listInvites = async (req, res, next) => {
  try {
    const docs = await DoctorInvite.find().sort({ createdAt: -1 }).limit(100);
    return successResponse(res, 'Invites loaded', docs);
  } catch (error) {
    next(error);
  }
};

const createInvite = async (req, res, next) => {
  try {
    const { name, email, phone } = req.body;
    if (!name || !email) return errorResponse(res, 'Name and email are required', 400);
    const doc = await DoctorInvite.create({
      name,
      email: String(email).toLowerCase().trim(),
      phone: phone || '',
      token: crypto.randomBytes(24).toString('hex'),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      createdBy: req.user._id
    });
    return successResponse(res, 'Invite created. Share the token with the doctor.', doc, 201);
  } catch (error) {
    next(error);
  }
};

// Public: doctor activates access with the invite token + password.
const acceptInvite = async (req, res, next) => {
  try {
    const { token, password } = req.body;
    if (!token || !password || String(password).length < 6) {
      return errorResponse(res, 'Valid token and a 6+ character password are required', 400);
    }
    const invite = await DoctorInvite.findOne({ token });
    if (!invite || invite.status !== 'Pending' || new Date() > invite.expiresAt) {
      return errorResponse(res, 'Invite is invalid or expired', 400);
    }
    let user = await User.findOne({ email: invite.email });
    if (!user) {
      user = await User.create({
        name: invite.name,
        email: invite.email,
        phone: invite.phone || '0000000000',
        role: 'Doctor',
        password,
        status: 'Active'
      });
    } else {
      user.role = 'Doctor';
      user.password = password;
      user.status = 'Active';
      await user.save();
    }
    // Link a Doctor referrer record by email when present.
    await Doctor.findOneAndUpdate(
      { email: invite.email },
      { $set: { linkedUser: user._id, name: invite.name } },
      { new: true }
    );
    invite.status = 'Accepted';
    await invite.save();
    return successResponse(res, 'Doctor access activated. Please login.', { email: user.email });
  } catch (error) {
    next(error);
  }
};

module.exports = { myCases, listInvites, createInvite, acceptInvite };
