// Server-side PDF generation (pdfkit). The client stays light: it only
// downloads the finished PDF via GET .../pdf?letterhead=1|0 — no jsPDF,
// no html2canvas, no heavy browser rendering.
//
// NOTE (Vercel): pdfkit's standard-font .cjs files are dynamically required
// and missed by Vercel's file tracer, which crashed EVERY route at cold
// start (top-level require). pdfkit is lazy-loaded here so the app boots
// without it; only actual PDF downloads throw (503) if the bundle is absent.
const path = require('path');
const fs = require('fs');
const { encode: encode39 } = require('./code39Service');

let _PDFDocument = null;
function getPDFDocument() {
  if (_PDFDocument) return _PDFDocument;
  try {
    _PDFDocument = require('pdfkit');
    return _PDFDocument;
  } catch (e) {
    const err = new Error(`PDF generation unavailable (pdfkit bundle missing): ${e.message}`);
    err.statusCode = 503;
    err.cause = e;
    throw err;
  }
}

const MARGIN = 36;

// Print-option defaults — mirror the LabProfile schema defaults so PDFs
// render the full reference lab format even when the stored profile
// predates these fields. Explicit per-request flags win, then the stored
// profile, then these defaults.
const REPORT_OPTION_DEFAULTS = {
  letterhead: true,
  footer: true,
  barcode: true,
  qr: true,
  tat: true,
  referred: true,
  dept: true,
  flags: true,
  interpretation: true,
  endline: true,
  signatures: true,
  watermark: true,
  pageno: true
};

//opt: { letterhead, footer, barcode, qr, tat, referred, dept, flags,
//  interpretation, endline, signatures, watermark, pageno } — each
//  true/false/'1'/'0'/undefined (undefined = fall back to profile).
function resolveReportOptions(opt = {}, profile = {}) {
  const PROFILE_KEYS = {
    letterhead: ['showLetterheadByDefault'],
    footer: ['showFooterByDefault'],
    barcode: ['showBarcode'],
    qr: ['showQR'],
    tat: ['showTatDates'],
    referred: ['showReferredBy'],
    dept: ['showDepartmentHeading'],
    flags: ['showFlagColumn'],
    interpretation: ['showInterpretation'],
    endline: ['showEndOfReport'],
    signatures: ['showSignatures'],
    watermark: ['showWatermark'],
    pageno: ['showPageNumber']
  };
  const out = {};
  for (const key of Object.keys(REPORT_OPTION_DEFAULTS)) {
    const v = opt[key];
    if (v !== undefined && v !== null && v !== '') {
      out[key] = !(v === false || v === '0' || v === 'false');
      continue;
    }
    let fromProfile;
    for (const pk of PROFILE_KEYS[key]) {
      if (profile[pk] !== undefined && profile[pk] !== null) { fromProfile = profile[pk]; break; }
    }
    out[key] = fromProfile !== undefined ? !!fromProfile : REPORT_OPTION_DEFAULTS[key];
  }
  return out;
}

// Builds the same options object from Express query params (?barcode=0 …).
// Absent params stay undefined so the stored profile decides.
function reportOptionsFromQuery(query = {}) {
  const out = {};
  for (const key of Object.keys(REPORT_OPTION_DEFAULTS)) {
    if (query[key] !== undefined) out[key] = query[key];
  }
  // Legacy single-flag callers (?letterhead=0) keep working.
  if (query.letterhead !== undefined && out.letterhead === undefined) out.letterhead = query.letterhead;
  return out;
}

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

// Header: letterhead image when enabled+present, else logo-left typed block
// (reference layout: logo at left, lab name/tagline/contact beside it).
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
  const logoAbs = p.logoUrl ? resolveUploadAbsolute(p.logoUrl) : null;
  if (logoAbs) {
    try {
      const logoBox = 52;
      const textX = MARGIN + logoBox + 10;
      const textW = contentWidth(doc) - logoBox - 10;
      doc.image(logoAbs, MARGIN, 28, { fit: [logoBox, logoBox] });
      doc.fontSize(20).font('Helvetica-Bold').fillColor('#111827')
        .text(p.labName || 'PURE PATH LAB', textX, 30, { align: 'left', width: textW });
      doc.fontSize(10).font('Helvetica').fillColor('#4b5563')
        .text(p.tagline || 'Pathology & Diagnostic Center', textX, undefined, { align: 'left', width: textW });
      const contact = [p.phone && `Ph: ${p.phone}`, p.address].filter(Boolean).join(' | ');
      if (contact) doc.fontSize(9).text(contact, textX, undefined, { align: 'left', width: textW });
      doc.y = Math.max(doc.y, 30 + logoBox + 6);
      doc.moveDown(0.25);
      doc.strokeColor('#9ca3af').lineWidth(1)
        .moveTo(MARGIN, doc.y).lineTo(doc.page.width - MARGIN, doc.y).stroke();
      doc.moveDown(0.5);
      return;
    } catch (e) { /* fall through to centered block */ }
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

function drawFooter(doc, left, pageLabel) {
  const bottom = doc.page.height - 30;
  const W = contentWidth(doc);
  doc.fontSize(8).fillColor('#6b7280')
    .text(left || 'Computer generated document.',
      MARGIN, bottom, { align: 'center', width: W });
  if (pageLabel) {
    doc.fontSize(8).fillColor('#6b7280')
      .text(pageLabel, MARGIN, bottom, { align: 'right', width: W });
  }
}

// Stamps "Page X of N" on every buffered page. Must run before doc.end().
function stampPageNumbers(doc, left) {
  let range;
  try { range = doc.bufferedPageRange(); } catch (e) { return; }
  for (let i = range.start; i < range.start + range.count; i++) {
    try {
      doc.switchToPage(i);
      drawFooter(doc, i === range.start + range.count - 1 ? left : '', `Page ${i - range.start + 1} of ${range.count}`);
    } catch (e) { /* stamp best-effort */ }
  }
  try { doc.switchToPage(range.start + range.count - 1); } catch (e) { /* noop */ }
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

// Code39 barcode drawn with rects (no image dep) at an explicit position.
// Returns the y just below the drawn barcode.
function drawBarcodeAt(doc, text, x, y, maxWidth) {
  const { bars, width } = encode39(String(text || ''));
  const unit = Math.min(1.6, maxWidth / Math.max(width, 1));
  doc.save().fillColor('#000000');
  bars.forEach((b) => doc.rect(x + b.x * unit, y, Math.max(b.w * unit - 0.15, 0.4), 34).fill());
  doc.restore();
  doc.fontSize(9).font('Courier').fillColor('#111827')
    .text(String(text || ''), x, y + 38, { width: maxWidth, align: 'left' });
  doc.font('Helvetica');
  return y + 54;
}

// Legacy flow-layout barcode (bills). Returns height used.
function drawBarcode(doc, text, maxWidth) {
  ensureSpace(doc, 60);
  const bottom = drawBarcodeAt(doc, text, MARGIN, doc.y, maxWidth);
  doc.y = bottom;
  return doc.y;
}

// Three-column patient band mirroring the reference lab format:
// left = patient identity, middle = barcode + reg no + TAT dates,
// right = QR ("Scan to download"). Missing blocks collapse gracefully.
function drawPatientBand(doc, { patient, bill, report, referredName, token }, { barcode, qrPng, qr, tat }) {
  const p = patient || {};
  const W = contentWidth(doc);
  const qrW = qr && qrPng ? 100 : 0;
  const gap = 10;
  const midW = Math.min(230, W * 0.38);
  const leftW = W - midW - qrW - gap * 2;
  const y0 = doc.y;

  // Rule above the band.
  doc.strokeColor('#9ca3af').lineWidth(1)
    .moveTo(MARGIN, y0).lineTo(MARGIN + W, y0).stroke();
  let y = y0 + 6;

  // Left: patient identity.
  const demoBits = [
    p.age === undefined || p.age === null || p.age === '' ? '' : `${p.age} YRS`,
    p.gender
  ].filter(Boolean).join(' / ');
  doc.fontSize(13).font('Helvetica-Bold').fillColor('#111827')
    .text(p.name || 'Walk-in Patient', MARGIN, y, { width: leftW });
  y = doc.y + 2;
  doc.fontSize(10).font('Helvetica').fillColor('#1f2937');
  const leftLines = [
    demoBits ? `Age / Sex     : ${demoBits}` : null,
    referredName ? `Referred by   : ${referredName}` : null,
    `Reg. no.       : ${report?.registrationNumber || p.registrationNumber || '—'}`
  ].filter(Boolean);
  leftLines.forEach((line) => {
    doc.text(line, MARGIN, y, { width: leftW });
    y = doc.y + 1;
  });
  const leftBottom = y;

  // Middle: barcode + reg no + TAT dates.
  let midBottom = y0 + 6;
  const midX = MARGIN + leftW + gap;
  if (barcode && (report?.registrationNumber || bill?.billNumber)) {
    midBottom = drawBarcodeAt(doc, report?.registrationNumber || bill?.billNumber, midX, midBottom, midW);
  }
  if (tat && report?.tat) {
    const f = (d) => (d ? new Date(d).toLocaleString() : '-');
    doc.fontSize(9).font('Helvetica').fillColor('#1f2937');
    [
      `Registered on : ${f(report.tat.registered)}`,
      `Collected on  : ${f(report.tat.collected)}`,
      `Received on   : ${f(report.tat.received)}`,
      `Reported on   : ${f(report.tat.reported)}`
    ].forEach((line) => {
      doc.text(line, midX, midBottom, { width: midW });
      midBottom = doc.y + 1;
    });
  } else if (bill) {
    doc.fontSize(9).font('Helvetica').fillColor('#1f2937')
      .text(`Bill No: ${bill.billNumber || '—'}`, midX, midBottom, { width: midW });
    midBottom = doc.y + 1;
  }

  // Right: QR.
  let qrBottom = y0 + 6;
  if (qr && qrPng) {
    try {
      const qrX = MARGIN + W - qrW;
      doc.fontSize(7).fillColor('#4b5563').font('Helvetica')
        .text('Scan to download', qrX, qrBottom, { width: qrW, align: 'center' });
      doc.image(qrPng, qrX, doc.y + 2, { width: qrW });
      qrBottom = doc.y + qrW + 6;
    } catch (e) { /* QR optional */ }
  }

  const bandBottom = Math.max(leftBottom, midBottom, qrBottom);

  // Vertical dividers + rule below the band.
  doc.strokeColor('#9ca3af').lineWidth(1);
  doc.moveTo(midX - gap / 2, y0).lineTo(midX - gap / 2, bandBottom).stroke();
  if (qrW) {
    const qrX = MARGIN + W - qrW;
    doc.moveTo(qrX - gap / 2, y0).lineTo(qrX - gap / 2, bandBottom).stroke();
  }
  doc.moveTo(MARGIN, bandBottom + 4).lineTo(MARGIN + W, bandBottom + 4).stroke();
  doc.y = bandBottom + 10;
  doc.fillColor('#111827').font('Helvetica');
}

// Faded logo watermark behind the results table (reference format).
function drawWatermark(doc, profile) {
  if (!profile?.logoUrl) return;
  const abs = resolveUploadAbsolute(profile.logoUrl);
  if (!abs) return;
  try {
    const W = contentWidth(doc);
    const size = Math.min(320, W * 0.7);
    doc.save();
    doc.opacity(0.07);
    doc.image(abs, MARGIN + (W - size) / 2, doc.y + 30, { width: size });
    doc.restore();
  } catch (e) { try { doc.restore(); } catch (_) { /* noop */ } }
}

// Footer strip image (bottom marketing/sign-off band). Drawn in-flow.
function drawFooterStrip(doc, profile) {
  if (!profile?.footerUrl) return;
  const abs = resolveUploadAbsolute(profile.footerUrl);
  if (!abs) return;
  try {
    ensureSpace(doc, 70);
    const W = contentWidth(doc);
    doc.image(abs, MARGIN, doc.y, { width: W });
    doc.moveDown(5);
  } catch (e) { /* footer strip optional */ }
}

const inr = (n) => `Rs. ${Number(n || 0).toFixed(2)}`;

function billPdf(context, options = {}) {
  return require('./formattedPdfService').documentPdf(context, options, 'bill');
}

// Interpretation box (light-blue band like the reference format).
function drawInterpretationBox(doc, title, body) {
  const W = contentWidth(doc);
  doc.fontSize(10);
  const titleH = title ? doc.heightOfString(title, { width: W - 16 }) + 6 : 0;
  const bodyH = doc.heightOfString(String(body || ''), { width: W - 16 }) + 8;
  const h = titleH + bodyH + 8;
  ensureSpace(doc, Math.min(h, 200));
  const y = doc.y;
  doc.save().fillColor('#eff6ff').rect(MARGIN, y, W, h).fill().restore();
  let ty = y + 5;
  if (title) {
    doc.fontSize(10).font('Helvetica-Bold').fillColor('#111827')
      .text(title, MARGIN + 8, ty, { width: W - 16 });
    ty = doc.y + 2;
  }
  doc.fontSize(9).font('Helvetica').fillColor('#1f2937')
    .text(String(body || ''), MARGIN + 8, ty, { width: W - 16 });
  doc.y = y + h + 6;
  doc.fillColor('#111827').font('Helvetica');
}

function categoryNameOf(t) {
  if (!t) return '';
  if (t.category && typeof t.category === 'object' && t.category.name) return String(t.category.name);
  if (typeof t.categoryName === 'string' && t.categoryName) return t.categoryName;
  return '';
}

function reportPdf(context, options = {}) {
  return require('./formattedPdfService').documentPdf(context, options, 'report');
}

module.exports = {
  billPdf, reportPdf, resolveUploadAbsolute, drawBarcode, getPDFDocument,
  resolveReportOptions, reportOptionsFromQuery, REPORT_OPTION_DEFAULTS
};
