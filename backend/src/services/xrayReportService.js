const path = require('path');
const { uploadedReportType } = require('./uploadedReportPdfService');

function isPdfUpload(file) {
  return !!file && (path.extname(file.originalname || '').toLowerCase() === '.pdf'
    || file.mimetype === 'application/pdf' || uploadedReportType(file.buffer) === 'application/pdf');
}

function assignReportPdf(record, file) {
  if (!file?.buffer || uploadedReportType(file.buffer) !== 'application/pdf') {
    throw Object.assign(new Error('Choose a valid PDF report to upload.'), { statusCode: 400 });
  }
  if (file.buffer.length > 10 * 1024 * 1024) {
    throw Object.assign(new Error('PDF report must be 10 MB or smaller.'), { statusCode: 400 });
  }
  record.reportFile = { data: file.buffer, name: path.basename(file.originalname || 'X-Ray-report.pdf'),
    contentType: 'application/pdf', size: file.buffer.length, uploadedAt: new Date() };
  record.status = 'Completed';
}

module.exports = { isPdfUpload, assignReportPdf };
