const { getPDFDocument } = require('./pdfService');

function uploadedReportType(buffer) {
  if (!Buffer.isBuffer(buffer)) return null;
  if (buffer.subarray(0, 5).toString() === '%PDF-') return 'application/pdf';
  if (buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'image/png';
  if (buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255) return 'image/jpeg';
  return null;
}

async function uploadedReportPdf(buffer) {
  const type = uploadedReportType(buffer);
  if (type === 'application/pdf') return buffer; // Preserve every uploaded page.
  if (!type) throw Object.assign(new Error('Upload a valid PDF, JPG or PNG report.'), { statusCode: 400 });
  const PDFDocument = getPDFDocument();
  const doc = new PDFDocument({ size: 'A4', margin: 18 });
  const output = new Promise((resolve, reject) => {
    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk)); doc.on('end', () => resolve(Buffer.concat(chunks))); doc.on('error', reject);
  });
  // Only the uploaded tracing/image is printed: no lab template or furniture.
  doc.image(buffer, 18, 18, { fit: [doc.page.width - 36, doc.page.height - 36], align: 'center', valign: 'center' });
  doc.end();
  return output;
}

module.exports = { uploadedReportType, uploadedReportPdf };
