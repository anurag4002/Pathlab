// Admin: give a referring doctor a login (Referral doctors screen).
// The login ID is the doctor's mobile number or email; the admin sets the
// password and can reset it or turn the login off.
const Doctor = require('../models/Doctor');
const User = require('../models/User');
const Branch = require('../models/Branch');
const Activity = require('../models/Activity');
const ROLES = require('../constants/roles');
const { successResponse, errorResponse } = require('../utils/response');

const OBJECT_ID = /^[a-f\d]{24}$/i;
const PLACEHOLDER_DOMAIN = '@referrer.invalid';
const MIN_PASSWORD = 8;

const cleanPhone = (value) => {
  const digits = String(value || '').replace(/\D/g, '');
  const local = digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits.length === 11 && digits.startsWith('0') ? digits.slice(1) : digits;
  return /^[6-9]\d{9}$/.test(local) ? local : '';
};

// The sign-in ID shown to the admin: the mobile number, or the email.
const loginIdOf = (user) => (String(user.email || '').endsWith(PLACEHOLDER_DOMAIN) ? user.phone : user.email);

const loginView = (doctor, user) => ({
  doctorId: doctor._id,
  userId: user._id,
  loginId: loginIdOf(user),
  loginType: String(user.email || '').endsWith(PLACEHOLDER_DOMAIN) ? 'phone' : 'email',
  status: user.status,
  role: user.role,
  branch: doctor.branch || null
});

const checkPassword = (password) => {
  const text = typeof password === 'string' ? password : '';
  if (text.length < MIN_PASSWORD) return `Password must be at least ${MIN_PASSWORD} characters`;
  if (text.length > 128) return 'Password is too long';
  return '';
};

const loadDoctor = async (id) => (OBJECT_ID.test(String(id || '')) ? Doctor.findById(id) : null);
const linkedUserOf = async (doctor) => (doctor && doctor.linkedUser ? User.findById(doctor.linkedUser) : null);

// Optional branch for the doctor's requests ('' clears it -> Main).
const resolveBranch = async (value) => {
  if (value === undefined) return { skip: true };
  if (value === null || value === '') return { branch: null };
  if (!OBJECT_ID.test(String(value))) return { error: 'Invalid branch' };
  const branch = await Branch.findById(value).select('_id').lean();
  return branch ? { branch: branch._id } : { error: 'Invalid branch' };
};

// GET /api/doctors/logins
const listLogins = async (req, res, next) => {
  try {
    const doctors = await Doctor.find({ linkedUser: { $ne: null } }).select('linkedUser branch').lean();
    const users = await User.find({ _id: { $in: doctors.map((d) => d.linkedUser) } }).select('email phone status role').lean();
    const byId = new Map(users.map((u) => [String(u._id), u]));
    const logins = doctors.filter((d) => byId.has(String(d.linkedUser))).map((d) => loginView(d, byId.get(String(d.linkedUser))));
    return successResponse(res, 'Doctor logins loaded', logins);
  } catch (error) {
    next(error);
  }
};

// POST /api/doctors/:id/login { loginId, password, branch? }
const giveLogin = async (req, res, next) => {
  try {
    const doctor = await loadDoctor(req.params.id);
    if (!doctor) return errorResponse(res, 'Doctor not found', 404);
    if (await linkedUserOf(doctor)) return errorResponse(res, 'This doctor already has a login. Use Reset password instead.', 409);

    const { loginId, password } = req.body || {};
    const raw = String(loginId || '').trim();
    const passwordError = checkPassword(password);
    if (passwordError) return errorResponse(res, passwordError, 400, { password: passwordError });

    let email;
    let phone = '';
    if (raw.includes('@')) {
      email = raw.toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.endsWith(PLACEHOLDER_DOMAIN)) {
        return errorResponse(res, 'Enter a valid email address', 400, { loginId: 'Enter a valid email address' });
      }
      if (await User.exists({ email })) {
        return errorResponse(res, 'Another login already uses this email', 409, { loginId: 'Another login already uses this email' });
      }
    } else {
      phone = cleanPhone(raw);
      if (!phone) return errorResponse(res, 'Enter a valid 10-digit mobile number', 400, { loginId: 'Enter a valid 10-digit mobile number' });
      // Same number stored with spaces or +91 counts as taken too.
      if (await User.exists({ phone: { $regex: `${phone.split('').join('\\D*')}$` } })) {
        return errorResponse(res, 'Another login already uses this mobile number', 409, { loginId: 'Another login already uses this mobile number' });
      }
      email = `referrer-${doctor._id}${PLACEHOLDER_DOMAIN}`;
    }

    const branch = await resolveBranch(req.body?.branch);
    if (branch.error) return errorResponse(res, branch.error, 400);

    const user = await User.create({
      name: doctor.name,
      email,
      phone,
      password,
      role: ROLES.REFERRER,
      status: 'Active'
    });
    doctor.linkedUser = user._id;
    if (!branch.skip) doctor.branch = branch.branch;
    await doctor.save();
    await Activity.create({
      user: req.user._id,
      action: 'Give Doctor Login',
      module: 'Cases',
      description: `Gave referring doctor ${doctor.name} a login.`
    });
    return successResponse(res, 'Login created. Give the doctor the ID and password.', loginView(doctor, user), 201);
  } catch (error) {
    if (error && error.code === 11000) return errorResponse(res, 'Another login already uses this ID', 409);
    next(error);
  }
};

// Only logins made for referring doctors are managed here; a staff login
// that happens to be linked is managed in Staff.
const loadReferrerLogin = async (req, res) => {
  const doctor = await loadDoctor(req.params.id);
  if (!doctor) { errorResponse(res, 'Doctor not found', 404); return null; }
  const user = await linkedUserOf(doctor);
  if (!user) { errorResponse(res, 'This doctor has no login yet', 404); return null; }
  if (user.role !== ROLES.REFERRER) { errorResponse(res, 'This doctor is linked to a staff login. Manage it under Staff.', 409); return null; }
  return { doctor, user };
};

// PUT /api/doctors/:id/login/password { password }
const resetPassword = async (req, res, next) => {
  try {
    const found = await loadReferrerLogin(req, res);
    if (!found) return undefined;
    const passwordError = checkPassword(req.body?.password);
    if (passwordError) return errorResponse(res, passwordError, 400, { password: passwordError });
    found.user.password = req.body.password;
    // Signs the doctor out everywhere: old sessions stop working.
    found.user.passwordChangedAt = new Date();
    await found.user.save();
    await Activity.create({
      user: req.user._id,
      action: 'Reset Doctor Password',
      module: 'Cases',
      description: `Reset the login password of referring doctor ${found.doctor.name}.`
    });
    return successResponse(res, 'Password changed. Give the doctor the new password.', loginView(found.doctor, found.user));
  } catch (error) {
    next(error);
  }
};

// PATCH /api/doctors/:id/login { status?: 'Active'|'Inactive', branch? }
const updateLogin = async (req, res, next) => {
  try {
    const found = await loadReferrerLogin(req, res);
    if (!found) return undefined;
    const { status } = req.body || {};
    if (status !== undefined && !['Active', 'Inactive'].includes(status)) return errorResponse(res, 'Invalid status', 400);
    const branch = await resolveBranch(req.body?.branch);
    if (branch.error) return errorResponse(res, branch.error, 400);
    if (status) {
      found.user.status = status;
      await found.user.save();
    }
    if (!branch.skip) {
      found.doctor.branch = branch.branch;
      await found.doctor.save();
    }
    await Activity.create({
      user: req.user._id,
      action: status === 'Inactive' ? 'Disable Doctor Login' : 'Update Doctor Login',
      module: 'Cases',
      description: `${status === 'Inactive' ? 'Turned off' : 'Updated'} the login of referring doctor ${found.doctor.name}.`
    });
    return successResponse(res, status === 'Inactive' ? 'Login turned off' : 'Login updated', loginView(found.doctor, found.user));
  } catch (error) {
    next(error);
  }
};

module.exports = { listLogins, giveLogin, resetPassword, updateLogin, loginIdOf, cleanPhone };
