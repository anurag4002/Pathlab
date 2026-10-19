const fs = require('fs');
const LabProfile = require('../models/LabProfile');
const Signature = require('../models/Signature');
const { assertBranchAccess } = require('../middleware/branchMiddleware');
const { documentPdf } = require('../services/formattedPdfService');
const { resolveUploadAbsolute, reportOptionsFromQuery } = require('../services/pdfService');

exports.forModel = (Model, department) => async (req, res, next) => {
  try {
    let query = Model.findById(req.params.id).populate('patient');
    if (Model.schema.path('reportFile.data')) query = query.select('+reportFile.data');
    if (Model.schema.path('referringDoctor')) query = query.populate('referringDoctor');
    if (Model.schema.path('bill')) query = query.populate({ path: 'bill', populate: { path: 'referringDoctor' } });
    const record = await query;
    if (!record) { const error = new Error('Report not found'); error.statusCode = 404; throw error; }
    assertBranchAccess(req, record.branch);
    if (record.modality === 'ECG' || (['USG', 'X-RAY'].includes(department) && record.reportFile?.data?.length)) {
      const label = record.modality === 'ECG' ? 'ECG' : department;
      const original = record.reportFile?.data;
      if (!original?.length) throw Object.assign(new Error('Upload an ECG report before previewing or printing.'), { statusCode: 404 });
      const pdf = await require('../services/uploadedReportPdfService').uploadedReportPdf(original);
      res.type('application/pdf'); res.setHeader('Content-Disposition', `inline; filename="${label}_${record._id}.pdf"`);
      return res.send(pdf);
    }
    if (department === 'X-RAY' && /\.pdf$/i.test(record.fileUrl || '')) {
      const file = resolveUploadAbsolute(record.fileUrl);
      if (file) {
        res.type('application/pdf');
        return res.send(fs.readFileSync(file));
      }
    }
    if (department === 'USG' && !record.findings?.trim()) throw Object.assign(new Error('No USG report is available. Upload a PDF report first.'), { statusCode: 404 });
    const profile = await LabProfile.findOne();
    const signaturePath = record.status === 'Completed' && resolveUploadAbsolute(record.signatureUrl);
    const signaturePngs = signaturePath ? [{ png: fs.readFileSync(signaturePath) }] : [];
    if (record.status === 'Signed' && record.signatures?.length) {
      const masters = await Signature.find({ _id: { $in: record.signatures.map(s => s.signature).filter(Boolean) } });
      for (const signed of record.signatures) {
        const master = masters.find(s => String(s._id) === String(signed.signature));
        const file = master && resolveUploadAbsolute(master.imageUrl);
        if (file) signaturePngs.push({ png: fs.readFileSync(file), name: master.name, title: master.title });
      }
    }
    const pdf = await documentPdf({
      profile, patient: record.patient, referredName: record.referringDoctor?.name,
      report: { registrationNumber: record.patient?.registrationNumber, reportDate: record.date || record.caseDate },
      bill: record.bill, department: [record.modality || department, record.templateName || record.procedure].filter(Boolean).join(' - '),
      findings: [record.findings, record.impression && `IMPRESSION:\n${record.impression}`].filter(Boolean).join('\n\n'),
      images: [record.fileUrl, ...(record.images || [])].filter(url => /\.(png|jpe?g)$/i.test(url))
    }, { ...reportOptionsFromQuery(req.query), signaturePngs });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${department}_${record._id}.pdf"`);
    res.send(pdf);
  } catch (error) { next(error); }
};
