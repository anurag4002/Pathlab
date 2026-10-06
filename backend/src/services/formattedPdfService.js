const path = require('path');
const { resolveFormat } = require('./documentTemplateService');
const { encode } = require('./code39Service');
const { resolveReferenceRange } = require('./referenceRangeService');
const { expandTests } = require('./testDefinitions');
const { reportNoteBlocks } = require('./interpretationLayout');
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
  // Preserve Greek letters and other clinical symbols absent from PDF's
  // standard fonts. Bundle the Unicode font so production needs no download.
  doc.registerFont('ClinicalUnicode', path.join(assets, 'fonts/NotoSans-Regular.ttf'));
  doc.registerFont('ClinicalUnicodeBold', path.join(assets, 'fonts/NotoSans-Bold.ttf'));
  doc.registerFont('ClinicalMath', path.join(assets, 'fonts/NotoSansMath-Regular.ttf'));
  const textFont = (value, bold) => /[↑↓≤≥]/.test(String(value)) ? 'ClinicalMath'
    : /[^\x00-\xff\u2013\u2014\u2018\u2019\u201c\u201d\u2022\u2026]/.test(String(value))
      ? bold ? 'ClinicalUnicodeBold' : 'ClinicalUnicode' : font(bold);
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
    doc.font(textFont(value, bold)).fontSize(size).fillColor(color).text(String(value ?? ''), x, top, { width: w, align, lineBreak: false });
  }
  function lines(value, w, bold = false, size = format.fontSize) {
    const measure = value => doc.font(textFont(value, bold)).fontSize(size).widthOfString(value);
    const output = [];
    for (const paragraph of String(value ?? '').split('\n')) {
      let line = '';
      for (const word of paragraph.split(/\s+/)) {
        // Split a single oversized token too (IDs and unbroken imported text).
        let rest = word;
        while (measure(rest) > w) {
          if (line) { output.push(line); line = ''; }
          let end = 1;
          while (end < rest.length && measure(rest.slice(0, end + 1)) <= w) end++;
          output.push(rest.slice(0, end)); rest = rest.slice(end);
        }
        if (line && measure(`${line} ${rest}`) > w) { output.push(line); line = rest; }
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
    const draw = (cells, heights, isHeader, index, offset, count) => {
      const h = count * lineHeight + pad * 2;
      const banded = format.tableStyle === 'banded';
      if ((isHeader && banded) || (!isHeader && banded && index % 2 === 0)) doc.save().fillColor(isHeader ? format.accentColor : '#f3f4f6').rect(m, y, width, h).fill().restore();
      let x = m;
      cells.forEach((cell, j) => {
        for (let i = 0; i < count; i++) text(heights[j][offset + i] || '', x + pad, y + pad + i * lineHeight, columns[j].width - pad * 2, { size, bold: isHeader || cell.bold, color: isHeader && banded ? '#ffffff' : '#111111', align: columns[j].align || 'left' });
        x += columns[j].width;
      });
      if (format.tableStyle === 'outlined') {
        doc.strokeColor(format.accentColor).lineWidth(0.5).moveTo(m, y).lineTo(m, y + h).moveTo(m + width, y).lineTo(m + width, y + h).stroke();
        if (isHeader) { rule(y); rule(y + h); }
      }
      y += h;
    };
    const headerCells = columns.map(c => ({ text: c.label }));
    const headerLines = columns.map(c => lines(c.label, c.width - pad * 2, true, size));
    const headerHeight = Math.max(...headerLines.map(l => l.length)) * lineHeight + pad * 2;
    const titleHeight = title ? lines(title, width, true, titleSize).length * (titleSize + 2) + 3 : 0;
    const tableHeader = () => { heading(title, { size: titleSize, leading: titleSize + 2, gap: 3 }); draw(headerCells, headerLines, true, 0, 0, Math.max(...headerLines.map(l => l.length))); };
    space(headerHeight + titleHeight + lineHeight + pad * 2); tableHeader();
    rows.forEach((cells, index) => {
      const heights = cells.map((cell, j) => lines(cell.text, columns[j].width - pad * 2, cell.bold, size));
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
    y += style.tableGap ?? 12;
  }
  function finishReportSection(style = {}) {
    if (options.endline && format.endOfReportText) paragraph(format.endOfReportText, { size: style.noteSize || format.fontSize, leading: style.noteLeading, gap: style.noteGap ?? 5, align: 'center' });
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
  function tableHeight(columns, rows, title, style) {
    const rowHeight = cells => Math.max(...cells.map((cell, i) => lines(cell.text, columns[i].width - style.rowPadding * 2, cell.bold, style.bodySize).length)) * style.tableLeading + style.rowPadding * 2;
    const titleHeight = title ? lines(title, width, true, style.titleSize).length * (style.titleSize + 2) + 3 : 0;
    return titleHeight + rowHeight(columns.map(column => ({ text: column.label, bold: true }))) + rows.reduce((height, row) => height + rowHeight(row), 0) + style.tableGap;
  }
  function noteLines(blocks, style, columns) {
    const columnWidth = (width - (columns - 1) * 14) / columns;
    const tokens = [];
    blocks.forEach((block, blockIndex) => {
      if (block.kind === 'comparison' || block.kind === 'table') {
        const rows = block.kind === 'table' ? block.rows : [
          block.columns.map(column => column.heading),
          ...Array.from({ length: Math.max(...block.columns.map(column => column.items.length)) }, (_, i) => block.columns.map(column => column.items[i] || ''))
        ];
        const cellCount = Math.max(...rows.map(row => row.length));
        const cellWidths = cellCount === 3 ? [0.24, 0.38, 0.38].map(ratio => columnWidth * ratio) : Array(cellCount).fill(columnWidth / cellCount);
        rows.forEach((row, rowIndex) => {
          const cellBold = j => !rowIndex || (cellCount >= 3 && j === 0);
          const cellLines = Array.from({ length: cellCount }, (_, j) => lines(row[j] || '', cellWidths[j] - 10, cellBold(j), style.noteSize));
          const count = Math.max(...cellLines.map(cell => cell.length));
          for (let i = 0; i < count; i++) tokens.push({
            cells: cellLines.map((cell, j) => ({ text: cell[i] || '', bold: cellBold(j) })), cellWidths, size: style.noteSize, indent: 0,
            height: style.noteLeading + (!i ? 3 : 0) + (i === count - 1 ? 3 : 0), textInset: !i ? 3 : 0,
            before: !rowIndex && !i ? 4 : 0,
            after: rowIndex === rows.length - 1 && i === count - 1 ? style.noteGap : 0,
            tableGroup: blockIndex, tableStart: !rowIndex && !i, tableHeader: !rowIndex,
            rowTop: !i, rowBottom: i === count - 1,
            color: '#111111', comparison: true
          });
        });
        return;
      }
      const bold = block.kind === 'title' || block.kind === 'heading';
      const size = style.noteSize + (block.kind === 'title' ? 0.6 : block.kind === 'heading' ? 0.2 : 0);
      const indent = block.kind === 'list' ? 8 : 0;
      const wrapped = lines(block.text, columnWidth - indent, bold, size);
      wrapped.forEach((line, i) => tokens.push({
        text: line, size, bold, indent,
        height: bold ? size + 1.5 : style.noteLeading,
        before: i || !blockIndex ? 0 : bold ? 3 : 1,
        after: i === wrapped.length - 1 && !bold ? style.noteGap : 0,
        keepWithNext: bold,
        title: block.kind === 'title', color: block.kind === 'detail' ? '#475569' : '#111111'
      }));
    });
    return { tokens, columnWidth };
  }
  function planNotes(blocks, style, columns, start, bottom) {
    const { tokens, columnWidth } = noteLines(blocks, style, columns);
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
      placements.push({ ...token, x: m + column * (columnWidth + 14), y: top, width: columnWidth - token.indent });
      top += token.height + token.after;
      lastY = Math.max(lastY, top);
    }
    return { fits: true, placements, lastY };
  }
  function chooseSectionLayout(tables, columns, blocks) {
    const sizes = [...new Set([format.fontSize, 9, 8.5, 8, 7.5].filter(size => size <= format.fontSize))];
    const styles = sizes.map((size, index) => ({
      bodySize: size, rowPadding: Math.min(format.rowPadding, index ? 1 : 2), tableLeading: size + 1.5,
      titleSize: 10, tableGap: 6, noteSize: Math.min(8.5, size), noteLeading: Math.min(8.5, size) * 1.18,
      noteGap: 1.5, disclaimerSize: 7, disclaimerLeading: 8.5, signatureHeight: 72
    }));
    // Prefer one column like the reference; use two compact note columns only
    // when the complete wording cannot fit beneath the results in one column.
    for (const noteColumns of [1, 2]) for (const style of styles) {
      const resultHeight = tables.reduce((height, item) => height + tableHeight(columns, item.rows, item.title, style), 0);
      const noteStart = y + resultHeight + (blocks.length ? 5 : 0);
      const noteBottom = limit - endingHeight(style) - 2;
      if (noteStart > noteBottom) continue;
      const notes = planNotes(blocks, style, noteColumns, noteStart, noteBottom);
      if (notes.fits) return { style, notes };
    }
    // Results may need multiple pages. Fit guidance on the final result page
    // after the table is drawn, never on a new interpretation-only page.
    return { style: styles[0], notes: null };
  }
  function drawNotes(blocks, layout, sectionTitle) {
    if (!layout.notes) {
      fitNotes: for (const columns of [1, 2]) for (const size of [...new Set([Math.min(8.5, format.fontSize), 8, 7.5])]) {
        const style = { ...layout.style, noteSize: size, noteLeading: size * 1.18 };
        const notes = planNotes(blocks, style, columns, y + (blocks.length ? 5 : 0), limit - endingHeight(style) - 2);
        if (notes.fits) { layout.style = style; layout.notes = notes; break fitNotes; }
      }
      if (!layout.notes) {
        doc.end();
        const error = new Error(`The interpretation for ${sectionTitle || 'this report'} is too long to fit on the results page. Shorten the saved panel/test interpretation or download with interpretations turned off. Interpretations cannot add report pages.`);
        error.statusCode = 422;
        throw error;
      }
    }
    const drawLine = (line, x, top, lineWidth) => {
      if (line.comparison) {
        if (line.tableHeader) doc.save().fillColor('#eef2f6').rect(x, top, lineWidth, line.height).fill().restore();
        doc.strokeColor('#cbd5e1').lineWidth(0.4);
        let borderX = x;
        for (const cellWidth of line.cellWidths) { doc.moveTo(borderX, top).lineTo(borderX, top + line.height); borderX += cellWidth; }
        doc.moveTo(borderX, top).lineTo(borderX, top + line.height);
        if (line.rowTop) doc.moveTo(x, top).lineTo(x + lineWidth, top);
        if (line.rowBottom) doc.moveTo(x, top + line.height).lineTo(x + lineWidth, top + line.height);
        doc.stroke();
        let cellX = x;
        line.cells.forEach((cell, i) => {
          if (cell) text(cell.text, cellX + 5, top + line.textInset, line.cellWidths[i] - 10, { ...line, bold: cell.bold });
          cellX += line.cellWidths[i];
        });
      } else {
        if (line.title) doc.strokeColor('#cbd5e1').lineWidth(0.4).moveTo(x, top - 2).lineTo(x + lineWidth, top - 2).stroke();
        text(line.text, x + line.indent, top, lineWidth, line);
      }
    };
    layout.notes.placements.forEach(line => drawLine(line, line.x, line.y, line.width));
    y = layout.notes.lastY;
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
    const reportHeading = () => {
      heading(format.reportTitle);
      if (options.dept) heading(context.department || context.bill?.department?.toUpperCase());
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
        const parent = context.testMap?.[String(result.test?._id || result.test)] || context.testMap?.[result.testName] || (typeof result.test === 'object' ? result.test : {});
        const definition = result.parameterCode && parent ? expandTests([parent]).find((test) => test.parameterCode === result.parameterCode) : parent;
        const test = resolveReferenceRange(definition || {}, context.patient || report.patient || {});
        const category = options.dept ? test.category?.name || test.categoryName || '' : '';
        let key = parent.reportSectionKey || (parent._id ? `test:${parent._id}`
          : parent.categoryName ? `category:${parent.categoryName}` : `name:${parent.name || result.testName || 'Tests'}`);
        // Legacy calculated rows without a catalog identity belong with the
        // measurements that produced them, rather than an extra report page.
        if (result.derived && !result.test && sections.size) key = [...sections.keys()].at(-1);
        if (!sections.has(key)) sections.set(key, {
          title: parent.reportSectionName || parent.name || parent.categoryName || result.testName || '',
          description: parent.reportSectionDescription || '', groups: []
        });
        const groups = sections.get(key).groups;
        if (!groups.length || groups[groups.length - 1].category !== category) groups.push({ category, items: [] });
        groups[groups.length - 1].items.push({ result, test });
      });
      const flag = options.flags ? Math.max(width * 0.04, format.flagPlacement === 'last' ? format.fontSize * 3 + format.rowPadding * 2 : 20) : 0;
      const columns = [{ label: 'TEST', width: width * 0.4 - flag }, { label: 'VALUE', width: width * 0.2 }, { label: 'UNIT', width: width * 0.15 }, { label: 'REFERENCE', width: width * 0.25 }];
      if (options.flags) columns.splice(format.flagPlacement === 'before-value' ? 1 : 4, 0, { label: format.flagPlacement === 'last' ? 'FLAG' : '', width: flag, align: 'center' });
      if (!sections.size) sections.set('empty', { title: '', groups: [] });
      [...sections.values()].forEach((section, index) => {
        if (index) newPage();
        reportHeading();
        const tables = section.groups.map(group => ({ rows: group.items.map(({ result: r, test: t }) => {
          const bold = ['H', 'L', 'C'].includes(r.flag);
          const range = r.referenceRange || t.referenceRange || (t.normalLow != null && t.normalHigh != null ? `${t.normalLow} - ${t.normalHigh}` : '-');
          const name = r.parameterCode && t.parentName ? (r.testName || t.name || '').replace(`${t.parentName}: `, '') : r.testName || t.sourceFieldName || t.name || '';
          const cells = [{ text: `${name}${r.derived ? ' *' : ''}`, bold }, { text: r.value ?? '', bold }, { text: r.unit || t.unit || '-', bold }, { text: range, bold }];
          if (options.flags) cells.splice(format.flagPlacement === 'before-value' ? 1 : 4, 0, { text: r.flag && r.flag !== 'N' ? r.flag : '', bold });
          return cells;
        }), title: [...new Set([group.category, section.title].filter(Boolean))].join('\n').toUpperCase() }));
        const blocks = options.interpretation ? reportNoteBlocks(section) : [];
        const layout = chooseSectionLayout(tables, columns, blocks);
        tables.forEach(item => table(columns, item.rows, item.title, layout.style));
        drawNotes(blocks, layout, section.title);
        finishReportSection(layout.style);
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
    const labelY = doc.page.height - m - (options.footer ? format.footerHeight + 17 : 15);
    if (context.preview) text('FORMAT PREVIEW - SAMPLE DATA', m, labelY, width, { size: 8, align: 'center' });
    if (options.pageno) text(`Page ${i + 1} of ${range.count}`, m, labelY, width, { size: 8, align: 'right' });
  }
  doc.end(); return done;
}
module.exports = { documentPdf };
