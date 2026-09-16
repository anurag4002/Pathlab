// Server-side PDF generation (pdfkit). The client stays light: it only
// downloads the finished PDF via GET .../pdf?letterhead=1|0 — no jsPDF,
// no html2canvas, no heavy browser rendering.
const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');
const { encode: encode39 } = require('./code39Service');

const MARGIN = 36;

function backendDir() {
  return path.join(__dirname, '..', '..');
}

// Stored fileUrl looks like 'uploads/reports/f.png' (relative to src/).
function resolveUploadAbsolute(fileUrl) {
  if (!fileUrl) return null;
  const rel = String(fileUrl).replace(/^src\//, '');
  const abs = process.env.VERCEL
    ? path.join('/tmp/uploads', rel.replace(/^uploads\//, ''))
    : path.join(backendDir(), 'src', rel);
  return fs.existsSync(abs) ? abs : null;
}

function collectBuffer(doc) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
}

function contentWidth(doc) {
  return doc.page.width - MARGIN * 2;
}

function ensureSpace(doc, needed) {
  if (doc.y + needed > doc.page.height - 50) {
    doc.addPage();
    return true;
  }
  return false;
}

// Fixed-column table row. Cells are drawn at the SAME y (no drift), the row
// advances by the tallest wrapped cell. Returns the y for the next row.
// cells: [{ text, width, align, bold, color, size }]
function tableRow(doc, cells, { header = false, fill = null } = {}) {
  const pad = 4;
  const gap = 6;
  const font = (bold) => (bold ? 'Helvetica-Bold' : 'Helvetica');
  doc.fontSize(10);
  let h = 16;
  cells.forEach((c) => {
    doc.font(font(c.bold || header)).fontSize(c.size || 10);
    h = Math.max(h, doc.heightOfString(String(c.text ?? ''), { width: c.width - gap }) + pad * 2);
  });
  ensureSpace(doc, h);
  const y = doc.y;
  const totalW = cells.reduce((s, c) => s + c.width, 0);
  if (fill || header) {
    doc.save().fillColor(fill || '#1f2937').rect(MARGIN, y, totalW, h).fill().restore();
  }
  let x = MARGIN;
  cells.forEach((c) => {
    doc.fillColor(c.color || (header ? '#ffffff' : '#111827'))
      .font(font(c.bold || header)).fontSize(c.size || 10)
      .text(String(c.text ?? ''), x + gap / 2, y + pad, { width: c.width - gap, align: c.align || 'left' });
    x += c.width;
  });
  doc.y = y + h;
  doc.fillColor('#111827').font('Helvetica').fontSize(10);
  return doc.y;
}

// Right-aligned label/value pairs (totals block). One pair per line.
function kvBlock(doc, pairs) {
  const W = contentWidth(doc);
  const labelW = W - 170;
  const valW = 170;
  pairs.forEach(([label, value, bold]) => {
    ensureSpace(doc, 16);
    const y = doc.y;
    doc.font('Helvetica').fontSize(10).fillColor('#374151')
      .text(label, MARGIN, y, { width: labelW, align: 'right' });
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fillColor('#111827')
      .text(value, MARGIN + labelW, y, { width: valW, align: 'right' });
    doc.y = y + 15;
  });
  doc.fillColor('#111827').font('Helvetica');
}

// Header: letterhead image when enabled+present, else typed lab block.
function drawHeader(doc, profile, letterhead, topMargin) {
  const p = profile || {};
  if (letterhead && p.letterheadUrl) {
    const abs = resolveUploadAbsolute(p.letterheadUrl);
    if (abs) {
      try {
        doc.image(abs, MARGIN, 20, { width: contentWidth(doc) });
        doc.y = topMargin || 110;
        doc.moveDown(0.5);
        return;
      } catch (e) { /* fall through to typed block */ }
    }
  }
  doc.fontSize(20).font('Helvetica-Bold').fillColor('#111827')
    .text(p.labName || 'PURE PATH LAB', MARGIN, 32, { align: 'center', width: contentWidth(doc) });
  doc.fontSize(10).font('Helvetica').fillColor('#4b5563')
    .text(p.tagline || 'Pathology & Diagnostic Center', { align: 'center' });
  const contact = [p.phone && `Ph: ${p.phone}`, p.address].filter(Boolean).join(' | ');
  if (contact) doc.fontSize(9).text(contact, { align: 'center' });
  doc.moveDown(0.5);
  doc.strokeColor('#9ca3af').lineWidth(1)
    .moveTo(MARGIN, doc.y).lineTo(doc.page.width - MARGIN, doc.y).stroke();
  doc.moveDown(0.5);
}

function drawFooter(doc, left) {
  const bottom = doc.page.height - 30;
  doc.fontSize(8).fillColor('#6b7280')
    .text(left || 'Computer generated document.',
      MARGIN, bottom, { align: 'center', width: contentWidth(doc) });
}

function metaLines(doc, lines) {
  doc.fontSize(10);
  lines.forEach(([label, value]) => {
    ensureSpace(doc, 15);
    const y = doc.y;
    doc.font('Helvetica-Bold').fillColor('#111827').text(label, MARGIN, y, { continued: true })
      .font('Helvetica').fillColor('#1f2937').text(` ${value || '-'}`);
    doc.y = Math.max(doc.y, y + 14);
  });
  doc.moveDown(0.4);
  doc.fillColor('#111827').font('Helvetica');
}

// Code39 barcode drawn with rects (no image dep). Returns height used.
function drawBarcode(doc, text, maxWidth) {
  const { bars, width } = encode39(text);
  const unit = Math.min(1.6, maxWidth / width);
  ensureSpace(doc, 60);
  const y = doc.y;
  const x = MARGIN;
  doc.save().fillColor('#000000');
  bars.forEach((b) => doc.rect(x + b.x * unit, y, Math.max(b.w * unit - 0.15, 0.4), 34).fill());
  doc.restore();
  doc.fontSize(9).font('Courier').fillColor('#111827')
    .text(text, x, y + 38, { width: maxWidth, align: 'left' });
  doc.y = y + 54;
  doc.font('Helvetica');
  return doc.y;
}

const inr = (n) => `Rs. ${Number(n || 0).toFixed(2)}`;

function billPdf({ bill, patient, doctor, agent, items, profile }, { letterhead = true, qrPng = null } = {}) {
  const doc = new PDFDocument({ margin: MARGIN, size: 'A4' });
  const done = collectBuffer(doc);
  drawHeader(doc, profile, letterhead, profile && profile.letterheadTopMargin);

  doc.fontSize(14).font('Helvetica-Bold').fillColor('#111827')
    .text('BILL / INVOICE', MARGIN, doc.y, { align: 'center', width: contentWidth(doc) });
  doc.moveDown(0.6);

  metaLines(doc, [
    ['Bill No: ', bill.billNumber],
    ['Date: ', new Date(bill.date).toLocaleString()],
    ['Patient: ', `${patient.name} (${patient.gender}, ${patient.age}y)`],
    ['Reg No: ', patient.registrationNumber],
    ['Phone: ', patient.phone],
    ...(doctor ? [['Referred By: ', doctor.name]] : []),
    ...(bill.department ? [['Department: ', bill.department]] : [])
  ]);

  const W = contentWidth(doc);
  tableRow(doc, [
    { text: '#', width: 36, align: 'center' },
    { text: 'Particulars', width: W - 36 - 110 },
    { text: 'Amount (Rs.)', width: 110, align: 'right' }
  ], { header: true });
  (items || []).forEach((it, i) => {
    tableRow(doc, [
      { text: String(i + 1), width: 36, align: 'center' },
      { text: it.name || it.itemId || 'Test', width: W - 36 - 110 },
      { text: Number(it.price || 0).toFixed(2), width: 110, align: 'right' }
    ]);
  });

  doc.moveDown(0.4);
  const sub = Number(bill.totalAmount || 0) + Number(bill.discount || 0);
  kvBlock(doc, [
    ['Gross Subtotal:', inr(sub), false],
    ['Discount:', inr(bill.discount), false],
    ['Net Payable:', inr(bill.totalAmount), true],
    [`Paid (${bill.paymentMethod || 'Cash'}):`, inr(bill.paidAmount), false],
    ['Balance Due:', inr(bill.dueAmount), true]
  ]);
  doc.moveDown(0.6);

  // Barcode (left) + QR (right) on the same band.
  ensureSpace(doc, 110);
  const bandY = doc.y;
  drawBarcode(doc, bill.billNumber, 230);
  const afterBarcodeY = doc.y;
  if (qrPng) {
    try {
      doc.image(qrPng, MARGIN + W - 110, bandY, { width: 100 });
      doc.fontSize(8).fillColor('#4b5563')
        .text('Scan to verify bill', MARGIN + W - 110, bandY + 104, { width: 100, align: 'center' });
      doc.y = Math.max(afterBarcodeY, bandY + 118);
    } catch (e) { doc.y = afterBarcodeY; }
  }
  doc.fillColor('#111827');
  drawFooter(doc, `Bill ${bill.billNumber} • Verify via QR • ${profile ? profile.phone || '' : ''}`);
  doc.end();
  return done;
}

function reportPdf({ report, patient, bill, testMap, profile }, { letterhead = true, qrPng = null, signaturePngs = [] } = {}) {
  const doc = new PDFDocument({ margin: MARGIN, size: 'A4' });
  const done = collectBuffer(doc);
  drawHeader(doc, profile, letterhead, profile && profile.letterheadTopMargin);

  doc.fontSize(14).font('Helvetica-Bold').fillColor('#111827')
    .text('LABORATORY REPORT', MARGIN, doc.y, { align: 'center', width: contentWidth(doc) });
  doc.moveDown(0.6);

  metaLines(doc, [
    ['Patient: ', `${patient.name} (${patient.gender}, ${patient.age}y)`],
    ['Reg No: ', report.registrationNumber],
    ...(bill ? [['Bill No: ', bill.billNumber]] : []),
    ['Report Date: ', new Date(report.reportDate).toLocaleString()],
    ...((report.tat && report.tat.collected) ? [['Sample Collected: ', new Date(report.tat.collected).toLocaleString()]] : [])
  ]);

  const W = contentWidth(doc);
  const wTest = 190, wResult = 80, wUnit = 90, wFlag = 45;
  const wRange = W - wTest - wResult - wUnit - wFlag;
  tableRow(doc, [
    { text: 'Test', width: wTest },
    { text: 'Result', width: wResult, align: 'right' },
    { text: 'Unit', width: wUnit },
    { text: 'Ref. Range', width: wRange },
    { text: 'Flag', width: wFlag, align: 'center' }
  ], { header: true });

  (report.results || []).forEach((r) => {
    const t = (testMap && (testMap[String(r.test)] || testMap[r.testName])) || {};
    const range = (t.normalLow !== null && t.normalLow !== undefined && t.normalHigh !== null && t.normalHigh !== undefined)
      ? `${t.normalLow} - ${t.normalHigh}` : (t.referenceRange || '-');
    const abnormal = r.flag === 'H' || r.flag === 'L' || r.flag === 'C';
    tableRow(doc, [
      { text: `${r.testName || ''}${r.derived ? ' *' : ''}`, width: wTest, bold: abnormal, color: abnormal ? '#b91c1c' : '#111827' },
      { text: String(r.value ?? ''), width: wResult, align: 'right', bold: abnormal, color: abnormal ? '#b91c1c' : '#111827' },
      { text: r.unit || t.unit || '-', width: wUnit, color: '#374151' },
      { text: range, width: wRange, color: '#374151' },
      { text: r.flag && r.flag !== 'N' ? `[${r.flag}]` : '', width: wFlag, align: 'center', bold: abnormal, color: abnormal ? '#b91c1c' : '#111827' }
    ]);
  });

  doc.fontSize(8).fillColor('#6b7280');
  ensureSpace(doc, 14);
  doc.text('* Derived (auto-calculated). H = High, L = Low, C = Critical.', MARGIN, doc.y, { width: W });
  doc.moveDown(0.8);

  // TAT block — two compact lines.
  if (report.tat) {
    const f = (d) => (d ? new Date(d).toLocaleString() : '-');
    doc.fontSize(9).fillColor('#4b5563');
    ensureSpace(doc, 28);
    doc.text(`Registered: ${f(report.tat.registered)}      Collected: ${f(report.tat.collected)}`, MARGIN, doc.y, { width: W });
    doc.moveDown(0.2);
    doc.text(`Received: ${f(report.tat.received)}      Reported: ${f(report.tat.reported)}`, { width: W });
    doc.moveDown(0.6);
  }

  // E-signatures, each in its own band.
  (signaturePngs || []).forEach((s) => {
    if (!s || !s.png) return;
    try {
      ensureSpace(doc, 90);
      const y = doc.y;
      doc.image(s.png, MARGIN, y, { width: 130 });
      doc.fontSize(9).fillColor('#111827')
        .text(`${s.name || ''}${s.title ? ` (${s.title})` : ''}`, MARGIN, y + 58, { width: 260 });
      doc.text('Authorised Signatory', MARGIN, doc.y + 2, { width: 260 });
      doc.y = Math.max(doc.y + 8, y + 88);
    } catch (e) { /* skip broken signature image */ }
  });

  if (qrPng) {
    try {
      ensureSpace(doc, 120);
      const y = doc.y;
      doc.image(qrPng, MARGIN + W - 110, y, { width: 100 });
      doc.fontSize(8).fillColor('#4b5563')
        .text('Scan to verify report', MARGIN + W - 110, y + 104, { width: 100, align: 'center' });
      doc.y = Math.max(doc.y, y + 118);
    } catch (e) { /* QR optional */ }
  }
  doc.fillColor('#111827');
  drawFooter(doc, `Report ${report.registrationNumber} • H/L/C flags explained above • Verify via QR`);
  doc.end();
  return done;
}

module.exports = { billPdf, reportPdf, resolveUploadAbsolute, drawBarcode };
