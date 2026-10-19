const Sequence = require('../models/Sequence');
const Patient = require('../models/Patient');
const Bill = require('../models/Bill');
const LabProfile = require('../models/LabProfile');

function registrationSettingErrors(body) {
  const errors = {};
  const numeric = value => ['number', 'string'].includes(typeof value) && String(value).trim() !== '';
  if (body.caseStartNumber !== undefined && (!numeric(body.caseStartNumber) || !Number.isSafeInteger(Number(body.caseStartNumber)) || Number(body.caseStartNumber) < 1)) {
    errors.caseStartNumber = 'Enter a positive whole number.';
  }
  if (body.registrationDigits !== undefined && (!numeric(body.registrationDigits) || !Number.isInteger(Number(body.registrationDigits)) || Number(body.registrationDigits) < 4 || Number(body.registrationDigits) > 12)) {
    errors.registrationDigits = 'Choose a whole number from 4 to 12 digits.';
  }
  return errors;
}

async function registrationSequenceInfo(profile) {
  const settings = profile || await LabProfile.findOne().select('caseStartNumber registrationDigits').lean() || {};
  const [counter, patients, bills] = await Promise.all([
    Sequence.findById('registration').lean(),
    Patient.find({ registrationNumber: /^\d+$/ }).select('registrationNumber').lean(),
    Bill.find({ billNumber: /^\d+$/ }).select('billNumber').lean()
  ]);
  let lastIssued = counter?.value || 0;
  for (const row of [...patients, ...bills]) lastIssued = Math.max(lastIssued, Number(row.registrationNumber || row.billNumber));
  const minimum = Number(settings.caseStartNumber) || 1;
  const digits = Number(settings.registrationDigits) || 6;
  const nextValue = Math.max(minimum, lastIssued + 1);
  return { lastIssued, minimum, digits, nextValue, nextNumber: String(nextValue).padStart(digits, '0') };
}

async function allocateRegistrationNumber() {
  const info = await registrationSequenceInfo();
  if (!Number.isSafeInteger(info.nextValue)) throw Object.assign(new Error('Registration sequence has reached its supported limit.'), { statusCode: 409 });
  const floor = info.nextValue - 1;
  try {
    await Sequence.updateOne({ _id: 'registration' }, { $max: { value: floor } }, { upsert: true });
  } catch (error) {
    if (error.code !== 11000) throw error;
    await Sequence.updateOne({ _id: 'registration' }, { $max: { value: floor } });
  }
  const next = await Sequence.findOneAndUpdate({ _id: 'registration', value: { $lt: Number.MAX_SAFE_INTEGER } }, { $inc: { value: 1 } }, { new: true });
  if (!next) throw Object.assign(new Error('Registration sequence has reached its supported limit.'), { statusCode: 409 });
  return String(next.value).padStart(info.digits, '0');
}

module.exports = { registrationSequenceInfo, allocateRegistrationNumber, registrationSettingErrors };
