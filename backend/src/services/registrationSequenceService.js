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

// Every number already on a patient or bill. New numbers skip these so a
// lowered sequence never collides with an existing registration.
async function usedNumbers() {
  const [patients, bills] = await Promise.all([
    Patient.find({ registrationNumber: /^\d+$/ }).select('registrationNumber').lean(),
    Bill.find({ billNumber: /^\d+$/ }).select('billNumber').lean()
  ]);
  return new Set([...patients, ...bills].map((row) => Number(row.registrationNumber || row.billNumber)));
}

async function registrationSequenceInfo(profile) {
  const settings = profile || await LabProfile.findOne().select('caseStartNumber registrationDigits').lean() || {};
  const [counter, used] = await Promise.all([Sequence.findById('registration').lean(), usedNumbers()]);
  // Before the counter exists, carry on after the highest number in use.
  let lastIssued = counter ? counter.value : 0;
  if (!counter) for (const n of used) lastIssued = Math.max(lastIssued, n);
  const minimum = Number(settings.caseStartNumber) || 1;
  const digits = Number(settings.registrationDigits) || 6;
  let nextValue = Math.max(minimum, lastIssued + 1);
  while (used.has(nextValue)) nextValue++;
  return { lastIssued, minimum, digits, nextValue, nextNumber: String(nextValue).padStart(digits, '0') };
}

// Make `nextValue` the next number handed out (the lab set it in Lab profile).
async function setNextRegistrationNumber(nextValue) {
  await Sequence.updateOne({ _id: 'registration' }, { $set: { value: Number(nextValue) - 1 } }, { upsert: true });
}

async function allocateRegistrationNumber() {
  for (let attempt = 0; attempt < 20; attempt++) {
    const info = await registrationSequenceInfo();
    if (!Number.isSafeInteger(info.nextValue)) throw Object.assign(new Error('Registration sequence has reached its supported limit.'), { statusCode: 409 });
    // Claim nextValue only if nobody else moved the counter since we read it.
    const claimed = await Sequence.findOneAndUpdate(
      { _id: 'registration', value: info.lastIssued },
      { $set: { value: info.nextValue } },
      { new: true }
    ).catch(() => null) || (await Sequence.exists({ _id: 'registration' }) ? null
      : await Sequence.create({ _id: 'registration', value: info.nextValue }).catch(() => null));
    if (claimed) return String(info.nextValue).padStart(info.digits, '0');
  }
  throw Object.assign(new Error('Could not allocate a registration number. Please try again.'), { statusCode: 409 });
}

module.exports = { registrationSequenceInfo, allocateRegistrationNumber, registrationSettingErrors, setNextRegistrationNumber };
