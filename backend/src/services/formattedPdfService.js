const path = require('path');
const { resolveFormat } = require('./documentTemplateService');
const { encode } = require('./code39Service');
const { resolveReferenceRange } = require('./referenceRangeService');
const { expandTests } = require('./testDefinitions');
const { reportNoteBlocks, documentBlocks } = require('./interpretationLayout');
const assets = path.join(__dirname, '../assets/document-formats');
const money = n => `Rs. ${Number(n || 0).toFixed(2)}`;
const date = value => {
  if (!value || Number.isNaN(new Date(value).getTime())) return '-';
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }).format(new Date(value)).replace(',', '').toUpperCase();
};
// Reference report interpretation band: light slate panel with generous
// horizontal padding and dashed clinical tables inside.
const NOTE_BACKGROUND = '#f1f5f9';
const NOTE_BORDER = '#334155';
const NOTE_PADDING_X = 10;
const NOTE_PADDING_Y = 6;
// Child rows (e.g. DLC differentials) sit just inside their parent row.
const TEST_INDENT = 3;
// Standalone tests' guidance prints at this share of body size (reference sheet).
const INLINE_NOTE_SCALE = 0.85;
// The reference sheet groups thousands in results and ranges ("7,800",
// "4,800 - 10,800"). Only plain numbers of 4+ integer digits are touched.
const groupThousands = value => String(value ?? '').replace(/(^|[^\d.,])(\d{4,})(?=(?:\.\d+)?(?![\d,]))/g, (_, lead, digits) => lead + digits.replace(/\B(?=(\d{3})+(?!\d))/g, ','));

// One renderer for staff downloads, public QR downloads, previews and printing.
// Page furniture is reserved before flowing content; rows and long paragraphs
// split safely and table headings repeat on continuation pages.
function documentPdf(context, requestOptions = {}, kind = 'report') {
  const { getPDFDocument, resolveReportOptions, resolveUploadAbsolute, resolveBillPaperOptions } = require('./pdfService');
  const profile = context.profile || {};
  const format = resolveFormat(profile, kind);
  const plainBill = kind === 'bill';
  if (plainBill) requestOptions = resolveBillPaperOptions(requestOptions);
  const options = resolveReportOptions(requestOptions, profile);
  const PDFDocument = getPDFDocument();
  const doc = new PDFDocument({ size: plainBill ? requestOptions.paperSize : 'A4', layout: plainBill && requestOptions.paperSize === 'A5' ? 'landscape' : 'portrait', margins: { top: format.pageMargin, left: format.pageMargin, right: format.pageMargin, bottom: 0 }, bufferPages: true });
  const done = new Promise((resolve, reject) => {
    const chunks = [];
    doc.on('data', c => chunks.push(c)); doc.on('end', () => resolve(Buffer.concat(chunks))); doc.on('error', reject);
  });
  const m = format.pageMargin, width = doc.page.width - m * 2;
  const font = bold => bold ? ({ Helvetica: 'Helvetica-Bold', 'Times-Roman': 'Times-Bold', Courier: 'Courier-Bold' }[format.fontFamily]) : format.fontFamily;
  // Preserve Greek letters and other clinical symbols absent from PDF's
  // standard fonts. Bundle the Unicode font so production needs no download.
  doc.registerFont('ClinicalUnicode', path.join(assets, 'fonts/NotoSans-Regular.ttf'));
  doc.registerFont('ClinicalUnicodeBold', path.join(assets, 'fonts/NotoSans-Bold.ttf'));
  doc.registerFont('ClinicalMath', path.join(assets, 'fonts/NotoSansMath-Regular.ttf'));
  const textFont = (value, bold) => /[↑↓≤≥]/.test(String(value)) ? 'ClinicalMath'
    : /[^\x00-\xff\u2013\u2014\u2018\u2019\u201c\u201d\u2022\u2026]/.test(String(value))
      ? bold ? 'ClinicalUnicodeBold' : 'ClinicalUnicode' : font(bold);
  // Without a drawn letterhead the lab prints on preprinted stationery — keep
  // the configured blank band so content does not ride up into the physical header.
  const preprintTop = (() => {
    if (options.letterhead || plainBill) return m;
    const configured = Number(profile.letterheadTopMargin);
    return Math.max(m, Number.isFinite(configured) ? configured : 90);
  })();
  // Preprinted footers also need their band; digital letterhead may dip slightly.
  let limit = doc.page.height - (!plainBill && (options.footer || !options.letterhead) ? format.footerHeight + 10 : 30) - m;
  const pageBottom = options.letterhead ? doc.page.height - m - 12 : limit;
  let y = m;
  const referenceAsset = fallback => format.useReferenceBranding && fallback ? path.join(assets, fallback) : null;
  const imagePath = (url, fallback) => (url ? resolveUploadAbsolute(url) : null) || referenceAsset(fallback);
  function image(source, x, top, w, h, opacity = 1) {
    if (!source) return false;
    try { doc.save(); doc.opacity(opacity); doc.image(source, x, top, { fit: [w, h], align: 'center', valign: 'center' }); doc.restore(); return true; }
    catch (_) { doc.restore(); return false; }
  }
  function text(value, x, top, w, { bold = false, size = format.fontSize, color = '#111111', align = 'left' } = {}) {
    doc.font(textFont(value, bold)).fontSize(size).fillColor(color).text(String(value ?? ''), x, top, { width: w, align, lineBreak: false });
  }
  function lines(value, w, bold = false, size = format.fontSize) {
    // PDFKit's word wrapper measures a trailing space too. Leave a small
    // allowance so it cannot re-wrap an already measured line underneath
    // the next manually positioned line.
    const availableWidth = Math.max(1, w - 4);
    const measure = value => doc.font(textFont(value, bold)).fontSize(size).widthOfString(value);
    const output = [];
    for (const paragraph of String(value ?? '').split('\n')) {
      const paragraphStart = output.length;
      let line = '';
      for (const word of paragraph.split(/\s+/)) {
        // Split a single oversized token too (IDs and unbroken imported text).
        let rest = word;
        while (measure(rest) > availableWidth) {
          if (line) { output.push(line); line = ''; }
          let end = 1;
          while (end < rest.length && measure(rest.slice(0, end + 1)) <= availableWidth) end++;
          output.push(rest.slice(0, end)); rest = rest.slice(end);
        }
        if (line && measure(`${line} ${rest}`) > availableWidth) { output.push(line); line = rest; }
        else line = line ? `${line} ${rest}` : rest;
      }
      output.push(line);
      // Avoid leaving a single word (for example the final "C" in
      // "hepatitis C") stranded on a line of its own.
      if (output.length - paragraphStart > 1 && output.at(-1).trim().split(/\s+/).length === 1) {
        const previous = output.at(-2).split(' ');
        const last = `${previous.at(-1)} ${output.at(-1)}`;
        if (previous.length > 2 && measure(last) <= availableWidth) {
          previous.pop(); output[output.length - 2] = previous.join(' '); output[output.length - 1] = last;
        }
      }
    }
    return output;
  }
  function rule(top) { doc.strokeColor(format.accentColor).lineWidth(0.6).moveTo(m, top).lineTo(m + width, top).stroke(); }
  function richFont(run) {
    const regular = textFont(run.text, run.bold);
    if (!run.italic || regular.startsWith('Clinical')) return regular;
    return { Helvetica: 'Helvetica-Oblique', 'Helvetica-Bold': 'Helvetica-BoldOblique', 'Times-Roman': 'Times-Italic', 'Times-Bold': 'Times-BoldItalic', Courier: 'Courier-Oblique', 'Courier-Bold': 'Courier-BoldOblique' }[regular] || regular;
  }
  const runWidth = (run, size) => doc.font(richFont(run)).fontSize(size).widthOfString(run.text);
  function richLines(runs, availableWidth, size, bold = false) {
    const output = []; let current = [], used = 0;
    const flush = () => {
      while (current.length && /^\s+$/.test(current.at(-1).text)) current.pop();
      output.push({ runs: current, text: current.map(run => run.text).join('') }); current = []; used = 0;
    };
    for (const input of runs) for (const token of input.text.match(/\n|[^\S\n]+|[^\s]+/g) || []) {
      if (token === '\n') { flush(); continue; }
      let run = { ...input, bold: bold || input.bold, text: token };
      if (!current.length && /^\s+$/.test(token)) continue;
      if (used + runWidth(run, size) > availableWidth && current.length) flush();
      while (runWidth(run, size) > availableWidth) {
        let end = 1;
        while (end < run.text.length && runWidth({ ...run, text: run.text.slice(0, end + 1) }, size) <= availableWidth) end++;
        current.push({ ...run, text: run.text.slice(0, end) }); flush(); run = { ...run, text: run.text.slice(end) };
      }
      if (run.text && (current.length || !/^\s+$/.test(run.text))) { current.push(run); used += runWidth(run, size); }
    }
    if (current.length || !output.length) flush();
    return output;
  }
  function drawRich(runs, x, top, lineWidth, size, align = 'left', color = '#263445') {
    const total = runs.reduce((sum, run) => sum + runWidth(run, size), 0);
    let cursor = x + (align === 'center' ? Math.max(0, (lineWidth - total) / 2) : align === 'right' ? Math.max(0, lineWidth - total) : 0);
    for (const run of runs) {
      doc.font(richFont(run)).fontSize(size).fillColor(color).text(run.text, cursor, top, { lineBreak: false, underline: !!run.underline, strike: !!run.strike });
      cursor += runWidth(run, size);
    }
  }
  function header() {
    y = m;
    if (plainBill) {
      const logo = imagePath(profile.logoUrl);
      const logoWidth = logo && image(logo, m + width - 52, y, 48, 48) ? 62 : 0;
      const headerWidth = width - logoWidth;
      const headerStart = y;
      for (const [index, value] of [profile.labName || 'PURE PATH LAB', profile.registrationNumber && `Reg. No. ${profile.registrationNumber}`, profile.phone && `Phone No.: ${profile.phone}`, profile.address].filter(Boolean).entries()) {
        const size = index === 0 ? 15 : 9;
        for (const line of lines(value, headerWidth, index === 0, size)) {
          text(line, m, y, headerWidth, { bold: index === 0, size }); y += index === 0 ? 20 : 12;
        }
      }
      y = Math.max(y, headerStart + (logoWidth ? 50 : 0));
      rule(y + 3); y += 10; patientBand();
      return;
    }
    // Preprinted letterhead/footer stationery: leave the blank header band and
    // start the patient block below it (no drawn lab branding).
    if (!options.letterhead) {
      y = preprintTop;
      patientBand();
      return;
    }
    const headerImage = imagePath(profile.letterheadUrl, 'reference-header.jpg');
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
    const qrWidth = options.qr && requestOptions.qrPng ? (plainBill ? 60 : 76) : 0;
    const middleWidth = width * 0.32, leftWidth = width - middleWidth - qrWidth - 20;
    const start = y, middleX = m + leftWidth + 10, qrX = m + width - qrWidth;
    // Reference style: "30 YRS / M" and the title before the name.
    const AGE_UNITS = { years: 'YRS', year: 'YRS', yrs: 'YRS', months: 'MONTHS', month: 'MONTHS', days: 'DAYS', day: 'DAYS' };
    const ageUnit = AGE_UNITS[String(patient.ageUnit || 'years').toLowerCase()] || String(patient.ageUnit).toUpperCase();
    const sex = { male: 'M', female: 'F', other: 'O' }[String(patient.gender || '').toLowerCase()] || patient.gender;
    const demo = [patient.age != null && patient.age !== '' ? `${patient.age} ${ageUnit}` : '', sex].filter(Boolean).join(' / ');
    const title = String(patient.title || '').trim();
    const patientName = patient.name ? (title && !patient.name.toLowerCase().startsWith(title.toLowerCase()) ? `${title} ${patient.name}` : patient.name) : '';
    // Reports without a referring doctor print "Self", as the reference sheet does.
    const referred = context.referredName || context.doctor?.name || bill.referringDoctor?.name || (kind === 'bill' ? '' : 'Self');
    const identity = [patientName || 'Walk-in Patient', `Age / Sex : ${demo || '-'}`, ...(options.referred && referred ? [`Referred by : ${referred}`] : []), `Reg. no. : ${(kind === 'bill' ? bill.billNumber : report.registrationNumber) || patient.registrationNumber || '-'}`];
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
      text(kind === 'bill' ? 'Scan to view report' : 'Scan to download', qrX, qrY, qrWidth, { size: 6, align: 'center' });
      image(requestOptions.qrPng, qrX + 3, qrY + 10, qrWidth - 6, qrWidth - 6); bottom = Math.max(bottom, qrY + qrWidth + 6);
    }
    if (!stacked) {
      doc.strokeColor(format.accentColor).lineWidth(0.6).moveTo(middleX - 5, start).lineTo(middleX - 5, bottom).stroke();
      if (qrWidth) doc.moveTo(qrX - 5, start).lineTo(qrX - 5, bottom).stroke();
    }
    rule(bottom + 5); y = bottom + 13;
  }
  // Every page repeats the (letterhead or preprinted band and) patient band,
  // as the reference LIS prints its page header on each sheet.
  // Where content starts on a fresh page (below letterhead / patient band).
  let contentTop = m;
  function newPage() {
    doc.addPage();
    header();
    contentTop = y;
  }
  function space(height) { if (y + height > limit) { newPage(); return true; } return false; }
  function paragraph(value, { bold = false, size = format.fontSize, align = 'left', shaded = false, leading = size + 4, gap = 5 } = {}) {
    const rowHeight = leading;
    for (const line of lines(value, width - (shaded ? 12 : 0), bold, size)) {
      space(rowHeight);
      if (shaded) doc.save().fillColor('#f3f7fa').rect(m, y - 2, width, rowHeight).fill().restore();
      text(line, m + (shaded ? 6 : 0), y, width - (shaded ? 12 : 0), { bold, size, align }); y += rowHeight;
    }
    y += gap;
  }
  function heading(value, style = {}) { if (value) paragraph(value, { bold: true, size: 11, align: 'center', ...style }); }
  function table(columns, rows, title = '', style = {}) {
    const size = style.bodySize || format.fontSize;
    const pad = style.rowPadding ?? format.rowPadding, lineHeight = style.tableLeading || size + 3;
    const titleSize = style.titleSize || 11;
    // Horizontal inset, text offset from the row top and total vertical
    // padding per row; result tables set these from the reference sheet.
    const padX = style.cellPadX ?? pad, padTop = style.cellPadTop ?? pad, rowExtra = style.rowExtra ?? pad * 2;
    const headerSize = style.headerSize || size;
    const headerTop = style.headerPadTop ?? padTop, headerExtra = style.headerExtra ?? rowExtra;
    // A row may carry its own widths (e.g. a label plus text spanning the rest).
    const widthsFor = cells => cells.widths || columns.map(c => c.width);
    const draw = (cells, heights, isHeader, index, offset, count) => {
      const h = count * lineHeight + (isHeader ? headerExtra : rowExtra);
      const widths = widthsFor(cells);
      const banded = format.tableStyle === 'banded';
      if (isHeader && (banded || format.tableStyle === 'outlined')) doc.save().fillColor(banded ? format.accentColor : NOTE_BACKGROUND).rect(m, y, width, h).fill().restore();
      else if (banded && !isHeader && index % 2 === 0) doc.save().fillColor('#f3f4f6').rect(m, y, width, h).fill().restore();
      let x = m;
      cells.forEach((cell, j) => {
        const indent = cell.indent || 0;
        for (let i = 0; i < count; i++) text(heights[j][offset + i] || '', x + padX + indent, y + (isHeader ? headerTop : padTop) + i * lineHeight, widths[j] - padX * 2 - indent, { size: isHeader ? headerSize : size, bold: isHeader || cell.bold, color: isHeader && banded ? '#ffffff' : '#111111', align: cells.widths ? 'left' : columns[j]?.align || 'left' });
        x += widths[j];
      });
      if (format.tableStyle === 'outlined') {
        doc.strokeColor(format.accentColor).lineWidth(0.5).moveTo(m, y).lineTo(m, y + h).moveTo(m + width, y).lineTo(m + width, y + h).stroke();
        if (isHeader) { rule(y); rule(y + h); }
      }
      y += h;
    };
    const headerCells = columns.map(c => ({ text: c.label }));
    const headerLines = columns.map(c => lines(c.label, c.width - padX * 2, true, headerSize));
    const headerHeight = Math.max(...headerLines.map(l => l.length)) * lineHeight + headerExtra;
    // A title is a string or a list of { text, size } lines (department, then panel).
    const titleLines = (Array.isArray(title) ? title : [{ text: title, size: titleSize }]).filter(line => line.text);
    const titleHeight = titleLines.reduce((sum, line) => sum + lines(line.text, width, true, line.size).length * (line.size + 2) + 3, 0);
    const showHeader = style.header !== false;
    const columnHeader = () => draw(headerCells, headerLines, true, 0, 0, Math.max(...headerLines.map(l => l.length)));
    const tableHeader = () => {
      titleLines.forEach(line => heading(line.text, { size: line.size, leading: line.size + 2, gap: 3 }));
      if (showHeader) columnHeader();
      else if (format.tableStyle === 'outlined') rule(y);
    };
    // Continuations of a table on the next page keep the column header.
    const continueTable = () => { columnHeader(); };
    // Reference "keep in same page": a panel or multi-parameter test that
    // fits on one page is moved whole to the next page rather than split.
    if (style.keepTogether) {
      const rowsHeight = rows.reduce((sum, cells) => sum + Math.max(...cells.map((cell, j) => lines(cell.text, widthsFor(cells)[j] - padX * 2 - (cell.indent || 0), cell.bold, size).length)) * lineHeight + rowExtra, 0);
      const whole = (showHeader ? headerHeight : 0) + titleHeight + rowsHeight + (style.tableGap ?? 12);
      // keepWith: the guidance printed under this table. Move the whole
      // section when it fits on a page; otherwise make sure the table and the
      // opening lines of its guidance (keepMin) start on the same page.
      const withNotes = whole + (style.keepWith || 0), page = limit - contentTop;
      if (y + withNotes > limit) {
        if (withNotes <= page) newPage();
        else if (y + whole + (style.keepMin || 0) > limit && whole + (style.keepMin || 0) <= page) newPage();
      }
    }
    space((showHeader ? headerHeight : 0) + titleHeight + lineHeight + rowExtra); tableHeader();
    const rowHeight = cells => Math.max(...cells.map((cell, j) => lines(cell.text, widthsFor(cells)[j] - padX * 2 - (cell.indent || 0), cell.bold, size).length)) * lineHeight + rowExtra;
    rows.forEach((cells, index) => {
      // A multi-parameter test (parent row, sub-headings, parameters) moves
      // whole to the next page instead of splitting, when it fits on a page.
      if (cells.group && rows[index - 1]?.group !== cells.group) {
        let groupHeight = 0;
        for (let j = index; j < rows.length && rows[j].group === cells.group; j++) groupHeight += rowHeight(rows[j]);
        if (y + groupHeight > limit && groupHeight <= limit - contentTop - headerHeight) { newPage(); continueTable(); }
      }
      const heights = cells.map((cell, j) => lines(cell.text, widthsFor(cells)[j] - padX * 2 - (cell.indent || 0), cell.bold, size));
      const total = Math.max(...heights.map(l => l.length)); let offset = 0;
      while (offset < total) {
        let available = Math.floor((limit - y - rowExtra) / lineHeight);
        if (available < 1 || (offset === 0 && total <= 12 && available < total)) { newPage(); continueTable(); available = Math.floor((limit - y - rowExtra) / lineHeight); }
        const count = Math.max(1, Math.min(total - offset, available));
        draw(cells, heights, false, index, offset, count); offset += count;
        if (offset < total) { newPage(); continueTable(); }
      }
    });
    if (format.tableStyle === 'outlined') rule(y);
    y += style.tableGap ?? 12;
  }
  function finishReportSection(style = {}) {
    const needed = endingHeight(style);
    // With a drawn letterhead, the endline may dip slightly into the footer
    // band. Preprinted stationery must not — that band is already on the paper.
    if (needed > 0 && y + needed > limit) {
      if (options.letterhead && y + needed <= pageBottom) limit = pageBottom;
      else newPage();
    }
    if (options.endline && format.endOfReportText) paragraph(format.endOfReportText, { size: style.noteSize || format.fontSize, leading: style.noteLeading, gap: Math.min(style.noteGap ?? 5, 3), align: 'center' });
    if (profile.disclaimer) paragraph(profile.disclaimer, { size: style.disclaimerSize || 8, leading: style.disclaimerLeading, gap: style.noteGap ?? 5, align: 'center' });
    const signatures = options.signatures ? (requestOptions.signaturePngs || context.signaturePngs || []).filter(s => s.png) : [];
    const signatureHeight = style.signatureHeight || 90;
    const imageHeight = style.signatureHeight ? 36 : 46;
    // Repeat only the signatures actually recorded on this report.
    for (let i = 0; i < signatures.length; i += 2) {
      space(signatureHeight);
      if (i + 2 >= signatures.length) y = Math.max(y, limit - signatureHeight);
      const top = y, col = width / 2;
      signatures.slice(i, i + 2).forEach((signature, j) => {
        const x = m + j * col;
        image(signature.png, x, top, col - 12, imageHeight);
        const label = [signature.name, signature.title, 'Authorised Signatory'].filter(Boolean).join('\n');
        lines(label, col - 12, false, 8).slice(0, 3).forEach((line, n) => text(line, x, top + imageHeight + 4 + n * 11, col - 12, { size: 8, align: j ? 'right' : 'left' }));
      });
      y = top + signatureHeight;
    }
  }
  function endingHeight(style) {
    let height = 0;
    if (options.endline && format.endOfReportText) height += lines(format.endOfReportText, width, false, style.noteSize).length * style.noteLeading + style.noteGap;
    if (profile.disclaimer) height += lines(profile.disclaimer, width, false, style.disclaimerSize).length * style.disclaimerLeading + style.noteGap;
    const signatures = options.signatures ? (requestOptions.signaturePngs || context.signaturePngs || []).filter(s => s.png) : [];
    return height + Math.ceil(signatures.length / 2) * style.signatureHeight;
  }
  function noteLines(blocks, style, columns, contentWidth = width) {
    const columnWidth = (contentWidth - (columns - 1) * 14) / columns;
    const tokens = [];
    blocks.forEach((block, blockIndex) => {
      if (block.kind === 'gap') { tokens.push({ text: '', size: style.noteSize, indent: 0, height: style.noteLeading * 0.6, before: 0, after: 0, blockIndex, blockLine: 0, blockLines: 1 }); return; }
      if (block.richRows) {
        const grid = [], occupied = [];
        block.richRows.forEach((row, r) => {
          grid[r] ||= []; let column = 0;
          row.forEach(cell => {
            while (grid[r][column]) column++;
            const placed = { ...cell, column, startRow: r, endRow: Math.min(block.richRows.length - 1, r + cell.rowspan - 1) };
            occupied.push(placed);
            for (let rr = r; rr <= placed.endRow; rr++) {
              grid[rr] ||= [];
              for (let c = column; c < column + cell.colspan; c++) grid[rr][c] = placed;
            }
            column += cell.colspan;
          });
        });
        const columnCount = Math.max(1, ...grid.map(row => row.length));
        const weights = Array(columnCount).fill(1);
        occupied.forEach(cell => cell.colwidth.forEach((value, i) => { if (cell.column + i < columnCount) weights[cell.column + i] = value; }));
        // Columns without explicit widths share the average of known widths.
        const known = weights.filter(value => value > 1); const average = known.reduce((a, b) => a + b, 0) / (known.length || 1) || 1;
        const scaled = weights.map(value => value === 1 ? average : value);
        const sum = scaled.reduce((a, b) => a + b, 0);
        const widths = scaled.map(value => columnWidth * value / sum);
        grid.forEach((row, rowIndex) => {
          const cells = [...new Set(row.filter(Boolean))].map(cell => {
            const cellWidth = widths.slice(cell.column, cell.column + cell.colspan).reduce((a, b) => a + b, 0);
            return { ...cell, x: widths.slice(0, cell.column).reduce((a, b) => a + b, 0), width: cellWidth,
              wrapped: richLines(cell.startRow === rowIndex ? cell.runs : [], Math.max(10, cellWidth - 12), style.noteSize, cell.header) };
          });
          const count = Math.max(1, ...cells.map(cell => cell.wrapped.length));
          for (let i = 0; i < count; i++) tokens.push({
            richCells: cells.map(cell => ({ ...cell, runs: cell.wrapped[i]?.runs || [] })),
            size: style.noteSize, indent: 0, height: style.noteLeading + (!i ? 5 : 0) + (i === count - 1 ? 5 : 0), textInset: !i ? 5 : 0,
            before: !rowIndex && !i ? 6 : 0, after: rowIndex === grid.length - 1 && i === count - 1 ? 8 : 0,
            tableGroup: blockIndex, tableStart: !rowIndex && !i, rowTop: !i, rowBottom: i === count - 1, tableRow: rowIndex,
          });
        });
        return;
      }
      if (block.kind === 'comparison' || block.kind === 'table') {
        const rows = block.kind === 'table' ? block.rows : [
          block.columns.map(column => column.heading),
          ...Array.from({ length: Math.max(...block.columns.map(column => column.items.length)) }, (_, i) => block.columns.map(column => column.items[i] || ''))
        ];
        // The reference sheet prints imported "Parameter" header cells blank.
        const parameterTable = block.kind === 'table' && rows.length && /^parameter$/i.test(String(rows[0][0] || '').trim());
        if (parameterTable) rows[0] = ['', ...rows[0].slice(1)];
        const cellCount = Math.max(...rows.map(row => row.length));
        // Document grids (Widal titres) give the row label a wider first column.
        const numbered = block.grid && cellCount === 3 && /^s\.?\s*no\.?$/i.test(String(rows[0]?.[0] || '').trim());
        const cellWidths = numbered ? [0.12, 0.58, 0.3].map(ratio => columnWidth * ratio)
          : block.grid && cellCount >= 4 ? [0.3, ...Array(cellCount - 1).fill(0.7 / (cellCount - 1))].map(ratio => columnWidth * ratio)
          : cellCount === 3 ? [0.24, 0.38, 0.38].map(ratio => columnWidth * ratio) : Array(cellCount).fill(columnWidth / cellCount);
        rows.forEach((row, rowIndex) => {
          const cellBold = j => parameterTable && rowIndex > 0 && j === 0;
          const cellLines = Array.from({ length: cellCount }, (_, j) => lines(row[j] || '', cellWidths[j] - 10, cellBold(j), style.noteSize));
          const count = Math.max(...cellLines.map(cell => cell.length));
          for (let i = 0; i < count; i++) tokens.push({
            cells: cellLines.map((cell, j) => ({ text: cell[i] || '', bold: cellBold(j) })), cellWidths, size: style.noteSize, indent: 0,
            height: style.noteLeading + (!i ? 3 : 0) + (i === count - 1 ? 3 : 0), textInset: !i ? 3 : 0,
            before: !rowIndex && !i ? 4 : 0,
            after: rowIndex === rows.length - 1 && i === count - 1 ? style.noteGap : 0,
            tableGroup: blockIndex, tableStart: !rowIndex && !i, tableHeader: !rowIndex,
            rowTop: !i, rowBottom: i === count - 1,
            color: '#111827', comparison: true
          });
        });
        return;
      }
      const title = block.kind === 'title', subheading = block.kind === 'heading', detail = block.kind === 'detail';
      const bold = title || subheading;
      const size = title ? style.noteSize + 1.5 : subheading ? style.noteSize + (block.headingLevel === 2 ? 1 : 0) : detail ? 8.5 : style.noteSize;
      const indent = block.kind === 'list' ? 10 : 0;
      const wrapped = block.runs ? richLines(block.runs, columnWidth - indent, size, bold) : lines(block.text, columnWidth - indent, bold, size);
      wrapped.forEach((line, i) => tokens.push({
        ...(block.runs ? { text: line.text, runs: line.runs, align: block.align } : { text: line }), size, bold, indent,
        height: bold ? style.noteHeadingHeight ?? size + 4 : detail ? 12 : style.noteLeading,
        before: i || !blockIndex ? 0 : title ? style.noteTitleBefore ?? 16 : subheading ? style.noteHeadingBefore ?? 9 : 0,
        after: i === wrapped.length - 1 ? bold ? style.noteHeadingAfter ?? 4 : detail ? 4 : style.noteGap : 0,
        keepWithNext: bold,
        blockIndex, blockLine: i, blockLines: wrapped.length,
        title, color: title ? '#111827' : subheading ? '#1f2937' : detail ? '#64748b' : '#1f2937'
      }));
    });
    return { tokens, columnWidth };
  }
  function planNotes(blocks, style, columns, start, bottom, contentX = m, contentWidth = width) {
    const { tokens, columnWidth } = noteLines(blocks, style, columns, contentWidth);
    const placements = [];
    let column = 0, top = start, lastY = start;
    const tableHeightFrom = index => {
      const group = tokens[index]?.tableGroup;
      let height = 0;
      for (let j = index; j < tokens.length && tokens[j].tableGroup === group; j++) height += tokens[j].before + tokens[j].height + tokens[j].after;
      return height;
    };
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      const next = tokens[i + 1];
      const ownHeight = token.tableStart ? tableHeightFrom(i) : token.before + token.height + token.after;
      const needed = ownHeight + (token.keepWithNext && next ? next.tableStart ? tableHeightFrom(i + 1) : next.before + next.height : 0);
      if (needed > bottom - start) return { fits: false };
      if (top + needed > bottom) {
        column++; top = start;
        if (column >= columns) return { fits: false };
      }
      top += token.before;
      placements.push({ ...token, x: contentX + column * (columnWidth + 14), y: top, width: columnWidth - token.indent });
      top += token.height + token.after;
      lastY = Math.max(lastY, top);
    }
    return { fits: true, placements, lastY };
  }
  function sectionStyle() {
    // Match body type for notes so panel guidance packs like Labsmart instead
    // of forcing an oversized 10.5pt band that spills an extra page.
    const noteSize = format.fontSize;
    return {
      // Result table geometry measured on the reference sheet: rows 13.6pt
      // apart with text ~4.5pt below the row top, cell text inset 3.3pt from
      // the border, and a 12pt header row with slightly smaller bold labels.
      bodySize: format.fontSize, rowPadding: Math.min(format.rowPadding, 1.5), tableLeading: format.fontSize + 2,
      cellPadX: 3.3, cellPadTop: 4, rowExtra: Math.max(0, 13.6 - (format.fontSize + 2)),
      headerSize: format.fontSize * 0.875, headerPadTop: 2, headerExtra: Math.max(0, 12 - (format.fontSize + 2)),
      titleSize: 10, tableGap: 6, noteSize, noteLeading: noteSize * 1.22,
      noteGap: 4, disclaimerSize: 8, disclaimerLeading: 10, signatureHeight: 72
    };
  }
  // Height a guidance band will take, and the minimum that must follow its
  // table (band padding plus the first few lines) when it cannot fit whole.
  function notesKeep(blocks, style, reserve = 0) {
    if (!blocks.length) return { keepWith: reserve, keepMin: 0 };
    const padTop = style.notePadTop ?? NOTE_PADDING_Y, padBottom = style.notePadBottom ?? NOTE_PADDING_Y;
    const topGap = style.noteTopGap ?? 10, afterGap = style.noteAfterGap ?? 4;
    const plan = planNotes(blocks, style, 1, padTop, 1e9, m + NOTE_PADDING_X, width - NOTE_PADDING_X * 2);
    const full = topGap + (plan.fits ? plan.lastY : 1e9) + padBottom + afterGap + reserve;
    return { keepWith: full, keepMin: Math.min(full, topGap + padTop + 4 * style.noteLeading + padBottom) };
  }
  function drawNotes(blocks, style, reserve = 0, { plain = false } = {}) {
    if (!blocks.length) return;
    // Document tests print on white with solid grid lines; guidance on a band.
    const border = () => (plain ? doc.strokeColor('#555555').lineWidth(0.5) : doc.strokeColor(NOTE_BORDER).lineWidth(0.55).dash(1.1, { space: 1.4 }));
    const padTop = style.notePadTop ?? NOTE_PADDING_Y, padBottom = style.notePadBottom ?? NOTE_PADDING_Y;
    const topGap = style.noteTopGap ?? 10, afterGap = style.noteAfterGap ?? 4;
    // The reference sheet sets guidance on a light slate band with inset
    // content, so the box reads as annotation rather than another result table.
    const contentX = m + NOTE_PADDING_X, contentWidth = width - NOTE_PADDING_X * 2;
    const drawLine = (line, x, top, lineWidth) => {
      if (line.richCells) {
        line.richCells.forEach(cell => {
          const left = x + cell.x, right = left + cell.width;
          border();
          doc.moveTo(left, top).lineTo(left, top + line.height).moveTo(right, top).lineTo(right, top + line.height);
          if (line.rowTop && cell.startRow === line.tableRow) doc.moveTo(left, top).lineTo(right, top);
          if (line.rowBottom && cell.endRow === line.tableRow) doc.moveTo(left, top + line.height).lineTo(right, top + line.height);
          doc.stroke().undash();
          drawRich(cell.runs, left + 6, top + line.textInset, cell.width - 12, line.size, cell.align);
        });
      } else if (line.comparison) {
        border();
        let borderX = x;
        for (const cellWidth of line.cellWidths) { doc.moveTo(borderX, top).lineTo(borderX, top + line.height); borderX += cellWidth; }
        doc.moveTo(borderX, top).lineTo(borderX, top + line.height);
        if (line.rowTop) doc.moveTo(x, top).lineTo(x + lineWidth, top);
        if (line.rowBottom) doc.moveTo(x, top + line.height).lineTo(x + lineWidth, top + line.height);
        doc.stroke().undash();
        let cellX = x;
        line.cells.forEach((cell, i) => {
          if (cell) text(cell.text, cellX + 5, top + line.textInset, line.cellWidths[i] - 10, { ...line, bold: cell.bold });
          cellX += line.cellWidths[i];
        });
      } else {
        if (line.runs) drawRich(line.runs, x + line.indent, top, lineWidth, line.size, line.align, line.color);
        else text(line.text, x + line.indent, top, lineWidth, line);
      }
    };
    const paint = (top, bottom) => { if (!plain) doc.save().fillColor(NOTE_BACKGROUND).rect(m, top, width, bottom - top).fill().restore(); };
    if (plain && drawDocumentBox()) return;
    function drawDocumentBox() {
      // One bordered box; it moves to the next page whole when it fits there.
      const plan = (top, bottom) => planNotes(blocks, style, 1, top + padTop, bottom, contentX, contentWidth);
      let boxTop = y + topGap, placed = plan(boxTop, limit - reserve - padBottom);
      if (!placed.fits) { newPage(); boxTop = y + topGap; placed = plan(boxTop, limit - reserve - padBottom); }
      if (!placed.fits) return false;
      placed.placements.forEach(line => drawLine(line, line.x, line.y, line.width));
      doc.strokeColor('#333333').lineWidth(0.7).rect(m, boxTop, width, placed.lastY + padBottom - boxTop).stroke();
      y = placed.lastY + padBottom + afterGap;
      return true;
    }
    const boxTop = y + topGap;
    let plan = planNotes(blocks, style, 1, boxTop + padTop, limit - reserve - padBottom, contentX, contentWidth);
    if (plan.fits) {
      paint(boxTop, plan.lastY + padBottom);
      plan.placements.forEach(line => drawLine(line, line.x, line.y, line.width));
      y = plan.lastY + padBottom + afterGap;
      return;
    }
    const measured = planNotes(blocks, style, 1, boxTop + padTop, boxTop + 1e6, contentX, contentWidth);
    const notesHeight = measured.fits ? measured.lastY - boxTop - padTop : Infinity;
    const pageBody = limit - m;
    const remaining = limit - y;
    // Only jump to a fresh page when almost nothing is left under the results.
    // Jumping for every "short" notes box left Labsmart-sized panels with a
    // half-blank page 1 and interpretations alone on page 2.
    if (notesHeight <= pageBody * 0.55 && remaining < pageBody * 0.16) {
      newPage();
      const retryTop = y + topGap;
      plan = planNotes(blocks, style, 1, retryTop + padTop, limit - reserve - padBottom, contentX, contentWidth);
      if (plan.fits) {
        paint(retryTop, plan.lastY + padBottom);
        plan.placements.forEach(line => drawLine(line, line.x, line.y, line.width));
        y = plan.lastY + padBottom + afterGap;
        return;
      }
    }
    const { tokens } = noteLines(blocks, style, 1, contentWidth);
    y += topGap;
    if (y + padTop + (tokens[0]?.height || 0) > limit - Math.max(0, reserve)) newPage();
    paint(y, y + padTop); y += padTop;
    // Always leave room for end-of-report / disclaimer AND the notes box
    // bottom pad so finishReportSection cannot orphan onto a blank page.
    const flowLimit = limit - Math.max(0, reserve) - padBottom - afterGap;
    tokens.forEach((line, i) => {
      const height = line.before + line.height + line.after;
      let keep = 0, last = i;
      // Keep consecutive headings plus the opening two lines of their
      // explanation together. Also keep a paragraph's final two lines.
      while (tokens[last].keepWithNext && tokens[last + 1]) {
        const next = tokens[++last]; keep += next.before + next.height + next.after;
      }
      const next = tokens[last + 1];
      if (next && !tokens[last].keepWithNext && next.blockIndex === tokens[last].blockIndex &&
        (tokens[last].blockLine === 0 || tokens[last].blockLine === tokens[last].blockLines - 2)) keep += next.before + next.height + next.after;
      if (i >= tokens.length - 2) keep = Math.max(keep, tokens.slice(i + 1).reduce((sum, token) => sum + token.before + token.height + token.after, 0));
      if (y + height + keep > flowLimit) newPage();
      paint(y, y + height);
      y += line.before;
      drawLine(line, contentX, y, contentWidth - line.indent);
      y += line.height + line.after;
    });
    paint(y, y + padBottom);
    y += padBottom + afterGap;
  }
  header();
  contentTop = y;
  if (kind === 'bill') {
    const bill = context.bill || {};
    heading(format.billTitle);
    table([{ label: 'S.No.', width: 36 }, { label: 'INVESTIGATIONS', width: width - 146 }, { label: 'AMOUNT (Rs.)', width: 110, align: 'right' }], (context.items || []).map((item, index) => [{ text: index + 1 }, { text: item.name || 'Test' }, { text: Number(item.price || 0).toFixed(2) }]));
    const totals = [['Gross subtotal', money(Number(bill.totalAmount || 0) + Number(bill.discount || 0))], ['Discount', money(bill.discount)], ['Net payable', money(bill.totalAmount)], [`Paid (${bill.paymentMethod || 'Cash'})`, money(bill.paidAmount)], ['Balance due', money(bill.dueAmount)]];
    space(totals.length * 16);
    totals.forEach(([label, value], i) => { text(label, m, y, width - 120, { align: 'right', bold: i === 2 || i === 4 }); text(value, m + width - 110, y, 110, { align: 'right', bold: i === 2 || i === 4 }); y += 16; });
    if (profile.invoiceFooter) paragraph(profile.invoiceFooter, { size: 8, align: 'center' });
  } else {
    const report = context.report || {};
    const reportHeading = () => {
      heading(format.reportTitle);
      const department = context.department || context.bill?.department;
      // "LAB" is implied by the report itself; the reference sheet starts with
      // the discipline heading instead.
      if (options.dept && department && !/^lab(?:oratory)?$/i.test(String(department).trim())) heading(String(department).toUpperCase());
    };
    if (context.findings !== undefined) {
      reportHeading();
      paragraph(context.findings);
      for (const url of context.images || []) {
        const source = resolveUploadAbsolute(url);
        if (!source) continue;
        space(232); image(source, m, y, width, 220); y += 232;
      }
      finishReportSection();
    }
    else {
      const sections = new Map();
      (report.results || []).forEach(result => {
        const parent = context.testMap?.[String(result.test?._id || result.test)] || context.testMap?.[result.testName] || (result.test && typeof result.test === 'object' ? result.test : {});
        const definition = result.parameterCode && parent ? expandTests([parent]).find((test) => test.parameterCode === result.parameterCode) : parent;
        const test = resolveReferenceRange(definition || {}, context.patient || report.patient || {});
        // Billed/panel sections must stay one table. Splitting by each catalog
        // test's department (e.g. some CBC rows HAEMATOLOGY, others blank)
        // reprinted the panel heading dozens of times and inflated page counts.
        // Billed panels/packages group under their own title; a "test:" section
        // key is still a standalone test.
        const panelSection = /^(?:panel|package):/.test(String(parent.reportSectionKey || ''));
        let key = parent.reportSectionKey || (parent._id ? `test:${parent._id}`
          : parent.categoryName ? `category:${parent.categoryName}` : Object.keys(parent).length ? `name:${parent.name || result.testName || 'Tests'}` : 'uncatalogued');
        // Legacy calculated rows without a catalog identity belong with the
        // measurements that produced them, rather than an extra report page.
        if (result.derived && !result.test && sections.size) key = [...sections.keys()].at(-1);
        // A panel prints under its own department when one is recorded.
        const sectionCategory = panelSection && parent.reportSectionCategory?.name ? parent.reportSectionCategory : null;
        const deptName = sectionCategory?.name || parent.category?.name || test.category?.name || parent.categoryName || test.categoryName || '';
        // Departments print in catalog category order (Haematology, Serology,
        // Clinical Pathology, ... Biochemistry), as on the reference reports.
        // Full millisecond precision: imported categories are created within
        // the same second, and Date.parse(String(date)) would drop the ms.
        const deptRank = new Date((sectionCategory || parent.category)?.createdAt || test.category?.createdAt || NaN).getTime();
        if (!sections.has(key)) sections.set(key, {
          key,
          interpretationOverride: (report.interpretations || []).find(item => item.key === key)?.text,
          title: parent.reportSectionName || parent.name || parent.categoryName || result.testName || '',
          panel: panelSection,
          department: deptName,
          rank: Number.isFinite(deptRank) ? deptRank : Infinity,
          seq: sections.size,
          // Panels follow the panel list order; standalone tests the catalog order.
          order: Number(panelSection ? parent.reportSectionRank : parent.displayOrder ?? parent.sourceDefinition?.order),
          description: parent.reportSectionDescription || '', groups: [{ category: '', items: [] }]
        });
        const section = sections.get(key);
        if (!section.department && deptName) { section.department = deptName; section.rank = Number.isFinite(deptRank) ? deptRank : Infinity; }
        const groups = section.groups;
        const resultKey = result.test ? `${result.test?._id || result.test}${result.parameterCode ? `:${result.parameterCode}` : ''}` : `name:${result.testName}`;
        const override = (report.interpretations || []).find(item => item.key === `result:${resultKey}`);
        if (parent.parameters?.length && result.parameterCode !== parent.parameters[0].code &&
          (report.interpretations || []).some(item => item.key.startsWith(`result:${parent._id}:`))) test.interpretation = '';
        groups[0].items.push({ result: { ...(result.toObject ? result.toObject() : result), interpretationOverride: override?.text }, test,
          order: parent.reportSectionOrder ?? Number.MAX_SAFE_INTEGER, seq: groups[0].items.length });
      });
      // Panel rows follow the panel definition; a test's parameters stay together.
      for (const section of sections.values()) {
        if (section.panel) section.groups[0].items.sort((a, b) => a.order - b.order || a.seq - b.seq);
      }
      const flag = options.flags ? Math.max(width * 0.04, format.flagPlacement === 'last' ? format.fontSize * 3 + format.rowPadding * 2 : 20) : 0;
      const columns = [{ label: 'TEST', width: width * 0.4 - flag }, { label: 'VALUE', width: width * 0.2 }, { label: 'UNIT', width: width * 0.15 }, { label: 'REFERENCE', width: width * 0.25 }];
      if (options.flags) columns.splice(format.flagPlacement === 'before-value' ? 1 : 4, 0, { label: format.flagPlacement === 'last' ? 'FLAG' : '', width: flag, align: 'center' });
      if (!sections.size) sections.set('empty', { title: '', groups: [] });
      const style = sectionStyle();
      const cellsFor = (name, bold, r, t, indent = 0) => {
        // The reference sheet leaves missing unit/range cells blank.
        const range = r.referenceRange || t.referenceRange || (t.normalLow != null && t.normalHigh != null ? `${t.normalLow} - ${t.normalHigh}` : '');
        const method = String(t.sourceInterpretation?.method || '').trim();
        const remark = String(r.remark || '').trim();
        const label = String(name).toUpperCase() + (method ? `\nMethod: ${method}` : '') + (remark ? `\nRemark: ${remark}` : '');
        // Calculated values print with two decimals ("4.00", "0.80") like the
        // reference sheet; stored numbers lose trailing zeros.
        const value = r.derived && /^-?\d+(?:\.\d+)?$/.test(String(r.value ?? '').trim()) ? Number(r.value).toFixed(2) : r.value ?? '';
        const cells = [{ text: label, bold, indent }, { text: groupThousands(value), bold }, { text: r.unit || t.unit || '', bold }, { text: groupThousands(range), bold }];
        if (options.flags) cells.splice(format.flagPlacement === 'before-value' ? 1 : 4, 0, { text: r.flag && r.flag !== 'N' ? r.flag : '', bold });
        return cells;
      };
      const parentCells = (name, indent = 0) => {
        const cells = [{ text: String(name).toUpperCase(), indent }, { text: '' }, { text: '' }, { text: '' }];
        if (options.flags) cells.splice(format.flagPlacement === 'before-value' ? 1 : 4, 0, { text: '' });
        return cells;
      };
      const groupRows = group => {
        const rows = []; let parentName = '', subheading = '';
        group.items.forEach(({ result: r, test: t }) => {
          const child = !!(r.parameterCode && t.parentName);
          const name = child ? (r.testName || t.name || '').replace(`${t.parentName}: `, '') : r.testName || t.sourceFieldName || t.name || '';
          const bold = ['H', 'L', 'C'].includes(r.flag);
          if (child) {
            // Parameterised tests print their parent once, then the measured
            // children indented underneath, as on the reference sheet.
            const groupKey = `test:${t._id || t.parentName}`;
            if (parentName !== t.parentName) {
              const previous = rows.at(-1)?.[0]?.text;
              if (String(previous || '').toUpperCase() !== String(t.parentName).toUpperCase()) rows.push(Object.assign(parentCells(t.parentName), { group: groupKey }));
              parentName = t.parentName; subheading = '';
            }
            // Nested tests (Urine / Stool / Semen / Fluid examination) print
            // their sub-headings ("PHYSICAL EXAMINATION") with the parameters
            // indented one more step under them.
            const nextHeading = String(t.subheading || '').trim();
            if (nextHeading && nextHeading !== subheading) rows.push(Object.assign([{ text: nextHeading.toUpperCase(), indent: TEST_INDENT, bold: true }], { group: groupKey, widths: [width] }));
            if (nextHeading) subheading = nextHeading;
            rows.push(Object.assign(cellsFor(name, bold, r, t, subheading ? TEST_INDENT * 2 : TEST_INDENT), { group: groupKey }));
          } else {
            parentName = ''; subheading = '';
            rows.push(cellsFor(name, bold, r, t));
          }
        });
        return rows;
      };
      reportHeading();
      // Department order, then billed panels before standalone tests, then
      // the order results were entered.
      // Within a department the reference prints the result table first and
      // Document tests (Widal, FNAC, Culture ...) after it.
      const documentOnly = section => !section.panel && section.groups.some(group => group.items.length) && section.groups.every(group => group.items.every(item => item.test?.sourceType === 'Document'));
      const defaultOrder = [...sections.values()].sort((a, b) => (a.rank === b.rank ? 0 : a.rank < b.rank ? -1 : 1)
        || (a.rank === Infinity && a.department !== b.department ? a.seq - b.seq : 0)
        || (a.department === b.department ? Number(documentOnly(a)) - Number(documentOnly(b)) : 0)
        || Number(b.panel || false) - Number(a.panel || false)
        || (Number.isFinite(a.order) && Number.isFinite(b.order) ? a.order - b.order : 0) || a.seq - b.seq);
      // Per-report print options chosen on result entry: hidden sections are
      // dropped, and the lab's department / section order wins over defaults.
      const settingsFor = key => (report.sectionSettings || []).find(item => item.key === key) || {};
      const departmentOrder = report.departmentOrder || [];
      const departmentIndex = name => { const i = departmentOrder.indexOf(name); return i < 0 ? Infinity : i; };
      const naturalDepartments = [...new Set(defaultOrder.map(section => section.department))];
      const ordered = defaultOrder
        .filter(section => settingsFor(section.key).printReady !== false)
        .map((section, index) => ({ section, index }))
        .sort((a, b) => {
          const da = departmentIndex(a.section.department), db = departmentIndex(b.section.department);
          if (a.section.department !== b.section.department) return da !== db ? da - db : naturalDepartments.indexOf(a.section.department) - naturalDepartments.indexOf(b.section.department);
          const oa = settingsFor(a.section.key).order, ob = settingsFor(b.section.key).order;
          return (Number.isFinite(oa) && Number.isFinite(ob) && oa !== ob ? oa - ob : 0) || a.index - b.index;
        })
        .map(item => item.section);
      // Standalone guidance sits directly under its own row in a smaller face,
      // as on the reference sheet (measured ~85% of body size, 1.23 leading).
      const inlineSize = INLINE_NOTE_SCALE * style.noteSize;
      const inlineLeading = inlineSize * 1.23;
      // Measured on the reference sheet: one line pitch throughout (headings
      // included), a blank line before each heading, ~13pt above the first
      // line and 6pt below the last, 6.5pt between the row box and the band.
      const inlineStyle = { ...style, noteSize: inlineSize, noteLeading: inlineLeading, noteGap: 0,
        noteHeadingHeight: inlineLeading, noteHeadingAfter: 0, noteHeadingBefore: inlineLeading, noteTitleBefore: inlineLeading,
        notePadTop: 12.5, notePadBottom: 5, noteTopGap: 6.5, noteAfterGap: 6 };
      // Render units: each panel on its own; consecutive standalone tests of a
      // department share one table (with its column header) until a test that
      // has guidance — the guidance prints under it and the next tests start a
      // fresh table, so every group of rows carries a header.
      const units = [];
      for (const section of ordered) {
        const settings = settingsFor(section.key);
        const blocks = options.interpretation && !settings.skipInterpretation ? reportNoteBlocks(section) : [];
        const last = units.at(-1);
        // Document tests (Widal, FNAC, PAP smear ...) print as their own box.
        const items = section.groups.flatMap(group => group.items);
        const documentSection = !section.panel && items.length > 0 && items.every(item => item.test?.sourceType === 'Document');
        if (documentSection) units.push({ document: true, department: section.department, sections: [section], newPage: !!settings.newPage });
        else if (!section.panel && !settings.newPage && last && !last.panel && !last.closed && !last.document && last.department === section.department) last.sections.push(section);
        else units.push({ panel: !!section.panel, department: section.department, sections: [section], newPage: !!settings.newPage });
        const unit = units.at(-1);
        if (unit.document) unit.closed = true;
        unit.blocks = blocks;
        if (settings.keepTogether === false) unit.split = true;
        if (settings.pageBreakAfter) unit.breakAfter = true;
        if (section.panel || blocks.length || settings.pageBreakAfter) unit.closed = true;
      }
      let department;
      units.forEach((unit, index) => {
        const isLast = index === units.length - 1;
        const reserve = isLast ? endingHeight(style) : 0;
        const newDepartment = index === 0 || unit.department !== department;
        if (newDepartment) {
          // Each department starts on its own page with the patient band
          // (unless the lab switched off "Print categories from new page").
          if (index > 0 && report.printCategoriesFromNewPage !== false) newPage();
          department = unit.department;
        }
        if (index > 0 && !(newDepartment && report.printCategoriesFromNewPage !== false) && (unit.newPage || units[index - 1].breakAfter) && y > contentTop + 1) newPage();
        const head = unit.sections[0];
        if (unit.document) {
          if (newDepartment && options.dept && unit.department) heading(unit.department.toUpperCase());
          const docStyle = { ...style, noteGap: 1.5, noteTitleBefore: 0, notePadTop: 6, notePadBottom: 8, noteTopGap: 4, noteAfterGap: 6 };
          head.groups.flatMap(group => group.items).forEach(({ result, test }) => {
            const title = test.name || result.testName || 'Report';
            const body = documentBlocks(result.value);
            const blocks = [{ kind: 'paragraph', text: title, runs: [{ text: title, bold: true }], align: 'center' }, { kind: 'gap' }, ...body];
            drawNotes(blocks, docStyle, isLast && !unit.blocks.length ? reserve : 0, { plain: true });
          });
          drawNotes(unit.blocks, inlineStyle, reserve);
          if (isLast) {
            if (String(report.moreDetails || '').trim()) paragraph(String(report.moreDetails).trim(), { size: style.noteSize, leading: style.noteLeading, gap: 6 });
            finishReportSection(style);
          }
          return;
        }
        const titles = [];
        if (newDepartment && options.dept && unit.department) titles.push({ text: unit.department.toUpperCase(), size: 11 });
        if (unit.panel && head.title) titles.push({ text: head.title.toUpperCase(), size: 9.5 });
        // Notes / Remarks / Advice print as rows under the section, the label
        // in the TEST column and the text across the rest (reference sheet).
        const noteRows = section => {
          const saved = (report.sectionNotes || []).find(item => item.key === section.key);
          if (!saved) return [];
          return [['Notes', saved.notes], ['Remarks', saved.remarks], ['Advice', saved.advice]].filter(([, value]) => String(value || '').trim())
            .map(([label, value]) => Object.assign([{ text: label, bold: true }, { text: String(value).trim() }], { widths: [columns[0].width, width - columns[0].width] }));
        };
        const rows = unit.sections.flatMap(section => [...section.groups.flatMap(groupRows), ...noteRows(section)]);
        const noteStyle = unit.panel ? style : inlineStyle;
        // Never strand a unit: its table and guidance move to the next page
        // together when they would otherwise be cut.
        const keep = unit.split ? {} : { keepTogether: true, ...notesKeep(unit.blocks, noteStyle, reserve) };
        table(columns, rows, titles, { ...style, ...keep, tableGap: unit.blocks.length && !unit.panel ? 0 : style.tableGap });
        drawNotes(unit.blocks, noteStyle, reserve);
        if (isLast) {
          // Report-level "More details" sits above the end-of-report line.
          if (String(report.moreDetails || '').trim()) paragraph(String(report.moreDetails).trim(), { size: style.noteSize, leading: style.noteLeading, gap: 6 });
          finishReportSection(style);
        }
      });
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
    const labelY = doc.page.height - m - (!plainBill && (options.footer || !options.letterhead) ? format.footerHeight + 17 : 15);
    if (context.preview) text('FORMAT PREVIEW - SAMPLE DATA', m, labelY, width, { size: 8, align: 'center' });
    if (options.pageno) text(`Page ${i + 1} of ${range.count}`, m, labelY, width, { size: 8, align: 'right' });
  }
  doc.end(); return done;
}
module.exports = { documentPdf };
