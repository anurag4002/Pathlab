const Bill = require('../models/Bill');

const generateBillNumber = async () => {
  try {
    const count = await Bill.countDocuments();
    const nextId = count + 1;
    const paddedId = String(nextId).padStart(5, '0');
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    return `INV-${dateStr}-${paddedId}`;
  } catch (error) {
    // Fallback in case of database error
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `INV-TEMP-${rand}`;
  }
};

module.exports = generateBillNumber;
