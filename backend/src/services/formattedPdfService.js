const path = require('path');
const { resolveFormat } = require('./documentTemplateService');
const { encode } = require('./code39Service');
const { resolveReferenceRange } = require('./referenceRangeService');
const { expandTests } = require('./testDefinitions');
const assets = path.join(__dirname, '../assets/document-formats');
const money = n => `Rs. ${Number(n || 0).toFixed(2)}`;
const date = value => {
  if (!value || Number.isNaN(new Date(value).getTime())) return '-';
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }).format(new Date(value)).replace(',', '').toUpperCase();
};

// One renderer for staff downloads, public QR downloads, previews and printing.
// Page furniture is reserved before flowing content; rows and long paragraphs
// split safely and table headings repeat on continuation pages.
function documentPdf(context, requestOptions = {}, kind = 'report') {
  const { getPDFDocument, resolveReportOptions, resolveUploadAbsolute } = require('./pdfService');
  const profile = context.profile || {};
  const format = resolveFormat(profile, kind);
  const options = resolveReportOptions(requestOptions, profile);
  const PDFDocument = getPDFDocument();
  const doc = new PDFDocument({ size: 'A4', margins: { top: format.pageMargin, left: format.pageMargin, right: format.pageMargin, bottom: 0 }, bufferPages: true });
  const done = new Promise((resolve, reject) => {
    const chunks = [];
    doc.on('data', c => chunks.push(c)); doc.on('end', () => resolve(Buffer.concat(chunks))); doc.on('error', reject);
  });
  const m = format.pageMargin, width = doc.page.width - m * 2;
  const font = bold => bold ? ({ Helvetica: 'Helvetica-Bold', 'Times-Roman': 'Times-Bold', Courier: 'Courier-Bold' }[format.fontFamily]) : format.fontFamily;
  const limit = doc.page.height - (options.footer ? format.footerHeight + 26 : 30) - m;
  let y = m;
  const referenceAsset = fallback => format.useReferenceBranding && fallback ? path.join(assets, fallback) : null;
  const imagePath = (url, fallback) => (url ? resolveUploadAbsolute(url) : null) || referenceAsset(fallback);
  function image(source, x, top, w, h, opacity = 1) {
    if (!source) return false;
    try { doc.save(); doc.opacity(opacity); doc.image(source, x, top, { fit: [w, h], align: 'center', valign: 'center' }); doc.restore(); return true; }
    catch (_) { doc.restore(); return false; }
  }
  function text(value, x, top, w, { bold = false, size = format.fontSize, color = '#111111', align = 'left' } = {}) {
    doc.font(font(bold)).fontSize(size).fillColor(color).text(String(value ?? ''), x, top, { width: w, align, lineBreak: false });
  }
  function lines(value, w, bold = false, size = format.fontSize) {
    doc.font(font(bold)).fontSize(size);
    const output = [];
    for (const paragraph of String(value ?? '').split('\n')) {
      let line = '';
      for (const word of paragraph.split(/\s+/)) {
        // Split a single oversized token too (IDs and unbroken imported text).
        let rest = word;
        while (doc.widthOfString(rest) > w) {
          if (line) { output.push(line); line = ''; }
          let end = 1;
          while (end < rest.length && doc.widthOfString(rest.slice(0, end + 1)) <= w) end++;
          output.push(rest.slice(0, end)); rest = rest.slice(end);
        }
        if (line && doc.widthOfString(`${line} ${rest}`) > w) { output.push(line); line = rest; }
        else line = line ? `${line} ${rest}` : rest;
      }
      output.push(line);
    }
    return output;
  }
  function rule(top) { doc.strokeColor(format.accentColor).lineWidth(0.6).moveTo(m, top).lineTo(m + width, top).stroke(); }
  function header() {
    y = m;
    const headerImage = options.letterhead && imagePath(profile.letterheadUrl, 'reference-header.jpg');
    if (headerImage && (image(headerImage, m, y, width, format.headerHeight) || image(referenceAsset('reference-header.jpg'), m, y, width, format.headerHeight))) y += format.headerHeight + 6;
    else {
      const logo = imagePath(profile.logoUrl);
      const logoWidth = logo && image(logo, m, y, 48, 48) ? 58 : 0;
      const x = m + logoWidth, w = width - logoWidth;
      const nameLines = lines(profile.labName || 'PURE PATH LAB', w, true, 22);
      nameLines.forEach((line, i) => text(line, x, y + i * 25, w, { bold: true, size: 22, color: format.accentColor }));
      y += nameLines.length * 25;
      for (const value of [profile.tagline, profile.registrationNumber && `Reg. No. ${profile.registrationNumber}`, [profile.address, profile.phone, profile.email, profile.website].filter(Boolean).join(' | ')].filter(Boolean)) {
        for (const line of lines(value, w, false, 9)) { text(line, x, y, w, { size: 9 }); y += 12; }
      }
      y = Math.max(y, m + 54) + 8;
    }
    if (options.watermark) {
      const custom = !!profile.logoUrl;
      const watermark = imagePath(profile.logoUrl, 'reference-watermark.jpg');
      const uploadedLogo = !!resolveUploadAbsolute(profile.logoUrl);
      if (!image(watermark, m + width * 0.23, doc.page.height * 0.32, width * 0.54, 300, custom && uploadedLogo ? 0.07 : 1)) image(referenceAsset('reference-watermark.jpg'), m + width * 0.23, doc.page.height * 0.32, width * 0.54, 300);
    }
    patientBand();
  }
  function patientBand() {
    const patient = context.patient || {}, bill = context.bill || {}, report = context.report || {};
    const qrWidth = options.qr && requestOptions.qrPng ? 76 : 0;
    const middleWidth = width * 0.32, leftWidth = width - middleWidth - qrWidth - 20;
    const start = y, middleX = m + leftWidth + 10, qrX = m + width - qrWidth;
    const demo = [patient.age != null && patient.age !== '' ? `${patient.age} ${patient.ageUnit || 'YRS'}` : '', patient.gender].filter(Boolean).join(' / ');
    const referred = context.referredName || context.doctor?.name || bill.referringDoctor?.name;
    const identity = [patient.name || 'Walk-in Patient', `Age / Sex : ${demo || '-'}`, ...(options.referred && referred ? [`Referred by : ${referred}`] : []), `Reg. no. : ${report.registrationNumber || patient.registrationNumber || '-'}`];
    let leftY = start;
    identity.forEach((value, i) => lines(value, format.patientLayout === 'stacked' ? width : leftWidth, i === 0, i === 0 ? 12 : format.fontSize).forEach(line => {
      text(line, m, leftY, format.patientLayout === 'stacked' ? width : leftWidth, { bold: i === 0, size: i === 0 ? 12 : format.fontSize }); leftY += i === 0 ? 17 : format.fontSize + 4;
    }));
    const stacked = format.patientLayout === 'stacked';
    const mx = stacked ? m : middleX;
    let midY = stacked ? leftY + 5 : start;
    const code = kind === 'bill' ? bill.billNumber : report.registrationNumber || patient.registrationNumber;
    if (options.barcode && code) {
      const encoded = encode(String(code)); const unit = Math.min(1, middleWidth / encoded.width);
      doc.save().fillColor('#000000'); encoded.bars.forEach(b => doc.rect(mx + b.x * unit, midY, b.w * unit, 17).fill()); doc.restore();
      text(code, mx, midY + 19, middleWidth, { size: 8 }); midY += 32;
    }
    const dates = kind === 'bill' ? [`Bill No: ${bill.billNumber || '-'}`, `Date: ${date(bill.date)}`, patient.phone && `Phone: ${patient.phone}`].filter(Boolean)
      : options.tat ? Object.entries({ Registered: report.tat?.registered || report.reportDate, Collected: report.tat?.collected, Received: report.tat?.received, Reported: report.tat?.reported || report.reportDate }).map(([label, value]) => `${label} on : ${date(value)}`) : [];
    dates.forEach(value => lines(value, stacked ? width - qrWidth - 10 : middleWidth, false, 8).forEach(line => { text(line, mx, midY, stacked ? width - qrWidth - 10 : middleWidth, { size: 8 }); midY += 11; }));
    let bottom = Math.max(leftY, midY);
    if (qrWidth) {
      const qrY = stacked ? leftY + 5 : start;
      text(kind === 'bill' ? 'Scan to verify bill' : 'Scan to download', qrX, qrY, qrWidth, { size: 6, align: 'center' });
      image(requestOptions.qrPng, qrX + 3, qrY + 10, 70, 70); bottom = Math.max(bottom, qrY + 82);
    }
    if (!stacked) {
      doc.strokeColor(format.accentColor).lineWidth(0.6).moveTo(middleX - 5, start).lineTo(middleX - 5, bottom).stroke();
      if (qrWidth) doc.moveTo(qrX - 5, start).lineTo(qrX - 5, bottom).stroke();
    }
    rule(bottom + 5); y = bottom + 13;
  }
  function newPage() { doc.addPage(); header(); }
  function space(height) { if (y + height > limit) { newPage(); return true; } return false; }
  function paragraph(value, { bold = false, size = format.fontSize, align = 'left', shaded = false } = {}) {
    const rowHeight = size + 4;
    for (const line of lines(value, width - (shaded ? 12 : 0), bold, size)) {
      space(rowHeight);
      if (shaded) doc.save().fillColor('#f3f7fa').rect(m, y - 2, width, rowHeight).fill().restore();
      text(line, m + (shaded ? 6 : 0), y, width - (shaded ? 12 : 0), { bold, size, align }); y += rowHeight;
    }
    y += 5;
  }
  function heading(value) { if (value) paragraph(value, { bold: true, size: 11, align: 'center' }); }
  function table(columns, rows, title = '') {
    const pad = format.rowPadding, lineHeight = format.fontSize + 3;
    const draw = (cells, heights, isHeader, index, offset, count) => {
      const h = count * lineHeight + pad * 2;
      const banded = format.tableStyle === 'banded';
      if ((isHeader && banded) || (!isHeader && banded && index % 2 === 0)) doc.save().fillColor(isHeader ? format.accentColor : '#f3f4f6').rect(m, y, width, h).fill().restore();
      let x = m;
      cells.forEach((cell, j) => {
        for (let i = 0; i < count; i++) text(heights[j][offset + i] || '', x + pad, y + pad + i * lineHeight, columns[j].width - pad * 2, { bold: isHeader || cell.bold, color: isHeader && banded ? '#ffffff' : '#111111', align: columns[j].align || 'left' });
        x += columns[j].width;
      });
      if (format.tableStyle === 'outlined') {
        doc.strokeColor(format.accentColor).lineWidth(0.5).moveTo(m, y).lineTo(m, y + h).moveTo(m + width, y).lineTo(m + width, y + h).stroke();
        if (isHeader) { rule(y); rule(y + h); }
      }
      y += h;
    };
    const headerCells = columns.map(c => ({ text: c.label }));
    const headerLines = columns.map(c => lines(c.label, c.width - pad * 2, true));
    const headerHeight = Math.max(...headerLines.map(l => l.length)) * lineHeight + pad * 2;
    const tableHeader = () => { heading(title); draw(headerCells, headerLines, true, 0, 0, Math.max(...headerLines.map(l => l.length))); };
    space(headerHeight + 45); tableHeader();
    rows.forEach((cells, index) => {
      const heights = cells.map((cell, j) => lines(cell.text, columns[j].width - pad * 2, cell.bold));
      const total = Math.max(...heights.map(l => l.length)); let offset = 0;
      while (offset < total) {
        let available = Math.floor((limit - y - pad * 2) / lineHeight);
        if (available < 1 || (offset === 0 && total <= 12 && available < total)) { newPage(); tableHeader(); available = Math.floor((limit - y - pad * 2) / lineHeight); }
        const count = Math.max(1, Math.min(total - offset, available));
        draw(cells, heights, false, index, offset, count); offset += count;
        if (offset < total) { newPage(); tableHeader(); }
      }
    });
    if (format.tableStyle === 'outlined') rule(y);
    y += 12;
  }
  header();
  if (kind === 'bill') {
    const bill = context.bill || {};
    heading(format.billTitle);
    table([{ label: '#', width: 28 }, { label: 'PARTICULARS', width: width - 138 }, { label: 'AMOUNT (Rs.)', width: 110, align: 'right' }], (context.items || []).map((item, index) => [{ text: index + 1 }, { text: item.name || 'Test' }, { text: Number(item.price || 0).toFixed(2) }]));
    const totals = [['Gross subtotal', money(Number(bill.totalAmount || 0) + Number(bill.discount || 0))], ['Discount', money(bill.discount)], ['Net payable', money(bill.totalAmount)], [`Paid (${bill.paymentMethod || 'Cash'})`, money(bill.paidAmount)], ['Balance due', money(bill.dueAmount)]];
    space(totals.length * 18);
    totals.forEach(([label, value], i) => { text(label, m, y, width - 120, { align: 'right', bold: i === 2 || i === 4 }); text(value, m + width - 110, y, 110, { align: 'right', bold: i === 2 || i === 4 }); y += 18; });
    if (profile.invoiceFooter) paragraph(profile.invoiceFooter, { size: 8, align: 'center' });
  } else {
    const report = context.report || {};
    heading(format.reportTitle);
    if (options.dept) heading(context.department || context.bill?.department?.toUpperCase());
    if (context.findings !== undefined) paragraph(context.findings);
    else {
      const groups = [];
      (report.results || []).forEach(result => {
        const parent = context.testMap?.[String(result.test?._id || result.test)] || context.testMap?.[result.testName] || (typeof result.test === 'object' ? result.test : {});
        const definition = result.parameterCode && parent ? expandTests([parent]).find((test) => test.parameterCode === result.parameterCode) : parent;
        const test = resolveReferenceRange(definition || {}, context.patient || report.patient || {});
        const category = options.dept ? test.category?.name || test.categoryName || '' : '';
        if (!groups.length || groups[groups.length - 1].category !== category) groups.push({ category, items: [] });
        groups[groups.length - 1].items.push({ result, test });
      });
      const flag = options.flags ? Math.max(width * 0.04, format.flagPlacement === 'last' ? format.fontSize * 3 + format.rowPadding * 2 : 20) : 0;
      const columns = [{ label: 'TEST', width: width * 0.4 - flag }, { label: 'VALUE', width: width * 0.2 }, { label: 'UNIT', width: width * 0.15 }, { label: 'REFERENCE', width: width * 0.25 }];
      if (options.flags) columns.splice(format.flagPlacement === 'before-value' ? 1 : 4, 0, { label: format.flagPlacement === 'last' ? 'FLAG' : '', width: flag, align: 'center' });
      groups.forEach(group => table(columns, group.items.map(({ result: r, test: t }) => {
        const bold = ['H', 'L', 'C'].includes(r.flag);
        const range = r.referenceRange || t.referenceRange || (t.normalLow != null && t.normalHigh != null ? `${t.normalLow} - ${t.normalHigh}` : '-');
        const cells = [{ text: `${r.testName || t.name || ''}${r.derived ? ' *' : ''}`, bold }, { text: r.value ?? '', bold }, { text: r.unit || t.unit || '-', bold }, { text: range, bold }];
        if (options.flags) cells.splice(format.flagPlacement === 'before-value' ? 1 : 4, 0, { text: r.flag && r.flag !== 'N' ? r.flag : '', bold });
        return cells;
      }), group.category.toUpperCase()));
      if (options.interpretation) {
        const seen = new Set();
        groups.flatMap(g => g.items).forEach(({ result, test }) => {
          if (!test.interpretation?.trim() || seen.has(test.interpretation)) return;
          seen.add(test.interpretation); paragraph(result.testName || 'Interpretation', { bold: true }); paragraph(test.interpretation, { shaded: true });
        });
      }
    }
    for (const url of context.images || []) {
      const source = resolveUploadAbsolute(url);
      if (!source) continue;
      space(232); image(source, m, y, width, 220); y += 232;
    }
    if (options.endline && format.endOfReportText) paragraph(format.endOfReportText, { align: 'center' });
    if (profile.disclaimer) paragraph(profile.disclaimer, { size: 8, align: 'center' });
    const signatures = options.signatures ? (requestOptions.signaturePngs || []).filter(s => s.png) : [];
    // Only real signatures supplied by the record are ever rendered. Reference
    // artwork excludes the sample's patient data and baked-in signatures.
    for (let i = 0; i < signatures.length; i += 2) {
      space(90);
      if (i + 2 >= signatures.length) y = Math.max(y, limit - 90);
      const top = y, col = width / 2;
      signatures.slice(i, i + 2).forEach((signature, j) => {
        const x = m + j * col;
        image(signature.png, x, top, col - 12, 46);
        const label = [signature.name, signature.title, 'Authorised Signatory'].filter(Boolean).join('\n');
        lines(label, col - 12, false, 8).slice(0, 3).forEach((line, n) => text(line, x, top + 50 + n * 11, col - 12, { size: 8, align: j ? 'right' : 'left' }));
      });
      y = top + 90;
    }
  }
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    if (options.footer) {
      const footerTop = doc.page.height - m - format.footerHeight;
      const customFooterDrawn = profile.footerUrl && image(resolveUploadAbsolute(profile.footerUrl), m, footerTop, width, format.footerHeight);
      if (!customFooterDrawn && format.useReferenceBranding) {
        image(path.join(assets, 'reference-footer.jpg'), m + width * 0.222, footerTop, width * 0.778, format.footerHeight);
        image(path.join(assets, 'reference-corner.jpg'), m, footerTop + format.footerHeight * 0.2, width * 0.222, format.footerHeight * 0.8);
      }
    }
    const labelY = doc.page.height - m - (options.footer ? format.footerHeight + 17 : 15);
    if (context.preview) text('FORMAT PREVIEW - SAMPLE DATA', m, labelY, width, { size: 8, align: 'center' });
    if (options.pageno) text(`Page ${i + 1} of ${range.count}`, m, labelY, width, { size: 8, align: 'right' });
  }
  doc.end(); return done;
}
module.exports = { documentPdf };
