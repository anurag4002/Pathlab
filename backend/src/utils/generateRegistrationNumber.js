const Patient = require('../models/Patient');

const generateRegistrationNumber = async () => {
  try {
    const count = await Patient.countDocuments();
    const nextId = count + 1;
    const paddedId = String(nextId).padStart(5, '0');
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    return `PPL-${dateStr}-${paddedId}`;
  } catch (error) {
    // Fallback in case of count error
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `PPL-TEMP-${rand}`;
  }
};

module.exports = generateRegistrationNumber;
