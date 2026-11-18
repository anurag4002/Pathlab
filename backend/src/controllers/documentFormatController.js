const LabProfile = require('../models/LabProfile');
const { validateFormatSettings } = require('../services/documentTemplateService');
const { documentPdf } = require('../services/formattedPdfService');
const { qrBuffer } = require('../services/qrService');
const { registrationSequenceInfo, registrationSettingErrors } = require('../services/registrationSequenceService');

exports.preview = async (req, res, next) => {
  try {
    const saved = await LabProfile.findOne();
    const profile = saved ? saved.toObject() : {};
    const body = req.body || {};
    const numberingErrors = registrationSettingErrors(body);
    if (Object.keys(numberingErrors).length) throw Object.assign(new Error('Invalid registration settings'), { statusCode: 400 });
    for (const field of ['caseStartNumber', 'registrationDigits']) if (body[field] !== undefined) profile[field] = Number(body[field]);
    const { nextNumber } = await registrationSequenceInfo(profile);
    const formatPatch = Object.fromEntries(['documentFormats', 'reportFormatId', 'billFormatId'].filter(key => body[key] !== undefined).map(key => [key, body[key]]));
    Object.assign(profile, validateFormatSettings(formatPatch, profile));
    // Preview unsaved text/toggles, but assets always come from the stored
    // profile and its authenticated upload endpoints.
    for (const key of ['labName', 'tagline', 'phone', 'address', 'email', 'website', 'registrationNumber', 'disclaimer', 'invoiceFooter']) {
      if (body[key] !== undefined && typeof body[key] === 'string' && body[key].length <= 2000) profile[key] = body[key];
    }
    for (const key of Object.keys(profile).filter(key => key.startsWith('show'))) if (typeof body[key] === 'boolean') profile[key] = body[key];
    if (typeof body.printSignatures === 'boolean') profile.printSignatures = body.printSignatures;
    // Unsaved "Header space" (blank top band on the pre-printed pad).
    if (body.letterheadTopMargin !== undefined) {
      const space = Number(body.letterheadTopMargin);
      if (body.letterheadTopMargin === '' || !Number.isFinite(space) || space < 0 || space > 480) throw Object.assign(new Error('Header space must be between 0 and 480 pt.'), { statusCode: 400 });
      profile.letterheadTopMargin = space;
    }
    const now = new Date();
    const context = {
      preview: true, profile, patient: { name: 'Sample Patient', age: 32, gender: 'M', registrationNumber: nextNumber, phone: '0000000000' },
      bill: { billNumber: nextNumber, date: now, department: 'BIOCHEMISTRY', totalAmount: 800, paidAmount: 500, dueAmount: 300, discount: 100, paymentMethod: 'Cash' },
      referredName: 'Sample Referring Doctor',
      report: { registrationNumber: nextNumber, tat: { registered: now, collected: now, received: now, reported: now }, results: [
        { test: 'sugar', testName: 'RANDOM BLOOD SUGAR', value: '76.30', unit: 'mg/dl', flag: 'N' },
        { test: 'urea', testName: 'SERUM UREA', value: '86.20', unit: 'mg/dl', flag: 'H' },
        { test: 'creatinine', testName: 'SERUM CREATININE', value: '6.44', unit: 'mg/dl', flag: 'H' },
        { test: 'sodium', testName: 'SERUM SODIUM', value: '137.0', unit: 'mmol/L', flag: 'N' }
      ] },
      testMap: { sugar: { referenceRange: '70 - 140', categoryName: 'KIDNEY FUNCTION TEST (KFT)' }, urea: { referenceRange: '19 - 45', categoryName: 'KIDNEY FUNCTION TEST (KFT)' }, creatinine: { referenceRange: '0.72 - 1.43', categoryName: 'KIDNEY FUNCTION TEST (KFT)', interpretation: 'Sample interpretation. Real reports use the interpretation entered in the Test Database.' }, sodium: { referenceRange: '136 - 146', categoryName: 'KIDNEY FUNCTION TEST (KFT)' } },
      items: [{ name: 'Kidney Function Test', price: 900 }]
    };
    const qrPng = await qrBuffer('Format preview - sample data');
    // Report template page: preview on blank paper with the drawn letterhead,
    // or as it prints on the lab's pre-printed pad (letterhead: false).
    // layoutOut: where each part landed, so the page can be edited on the PDF.
    const requestOptions = { qrPng, layoutOut: [] };
    if (typeof body.letterhead === 'boolean') requestOptions.letterhead = body.letterhead;
    const kind = body.kind === 'bill' ? 'bill' : 'report';
    const pdf = await documentPdf(context, requestOptions, kind);
    // Zones are in PDF points from the page's top-left (A4 for reports; the
    // client reads each page's own size from the PDF for bills).
    const round = value => Math.round(value * 100) / 100;
    const zones = requestOptions.layoutOut.map(z => ({ kind: z.kind, page: z.page, x: round(z.x), y: round(z.y), w: round(z.w), h: round(z.h) }));
    res.setHeader('X-Report-Layout', Buffer.from(JSON.stringify({ ...(kind === 'report' ? { pageWidth: 595.28, pageHeight: 841.89 } : {}), zones })).toString('base64'));
    res.setHeader('Access-Control-Expose-Headers', 'X-Report-Layout');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Disposition', 'inline; filename="Format-preview.pdf"');
    res.send(pdf);
  } catch (error) { next(error); }
};
