const LabProfile = require('../models/LabProfile');
const { validateFormatSettings } = require('../services/documentTemplateService');
const { documentPdf } = require('../services/formattedPdfService');
const { qrBuffer } = require('../services/qrService');

exports.preview = async (req, res, next) => {
  try {
    const saved = await LabProfile.findOne();
    const profile = saved ? saved.toObject() : {};
    const body = req.body || {};
    Object.assign(profile, validateFormatSettings({ documentFormats: body.documentFormats, reportFormatId: body.reportFormatId, billFormatId: body.billFormatId }, profile));
    // Preview unsaved text/toggles, but assets always come from the stored
    // profile and its authenticated upload endpoints.
    for (const key of ['labName', 'tagline', 'phone', 'address', 'email', 'website', 'registrationNumber', 'disclaimer', 'invoiceFooter']) {
      if (body[key] !== undefined && typeof body[key] === 'string' && body[key].length <= 2000) profile[key] = body[key];
    }
    for (const key of Object.keys(profile).filter(key => key.startsWith('show'))) if (typeof body[key] === 'boolean') profile[key] = body[key];
    const now = new Date();
    const context = {
      preview: true, profile, patient: { name: 'Sample Patient', age: 32, gender: 'M', registrationNumber: 'SAMPLE-5830', phone: '0000000000' },
      bill: { billNumber: 'SAMPLE-001', date: now, department: 'BIOCHEMISTRY', totalAmount: 800, paidAmount: 500, dueAmount: 300, discount: 100, paymentMethod: 'Cash' },
      referredName: 'Sample Referring Doctor',
      report: { registrationNumber: 'SAMPLE-5830', tat: { registered: now, collected: now, received: now, reported: now }, results: [
        { test: 'sugar', testName: 'RANDOM BLOOD SUGAR', value: '76.30', unit: 'mg/dl', flag: 'N' },
        { test: 'urea', testName: 'SERUM UREA', value: '86.20', unit: 'mg/dl', flag: 'H' },
        { test: 'creatinine', testName: 'SERUM CREATININE', value: '6.44', unit: 'mg/dl', flag: 'H' },
        { test: 'sodium', testName: 'SERUM SODIUM', value: '137.0', unit: 'mmol/L', flag: 'N' }
      ] },
      testMap: { sugar: { referenceRange: '70 - 140', categoryName: 'KIDNEY FUNCTION TEST (KFT)' }, urea: { referenceRange: '19 - 45', categoryName: 'KIDNEY FUNCTION TEST (KFT)' }, creatinine: { referenceRange: '0.72 - 1.43', categoryName: 'KIDNEY FUNCTION TEST (KFT)', interpretation: 'Sample interpretation. Real reports use the interpretation entered in the Test Database.' }, sodium: { referenceRange: '136 - 146', categoryName: 'KIDNEY FUNCTION TEST (KFT)' } },
      items: [{ name: 'Kidney Function Test', price: 900 }]
    };
    const qrPng = await qrBuffer('Format preview - sample data');
    const pdf = await documentPdf(context, { qrPng }, body.kind === 'bill' ? 'bill' : 'report');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Disposition', 'inline; filename="Format-preview.pdf"');
    res.send(pdf);
  } catch (error) { next(error); }
};
