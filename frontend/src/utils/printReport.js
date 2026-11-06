// One clean print for every business report (both looks).
// The report is laid out in its own hidden frame, so nothing from the app
// (buttons, filter chips, charts, bill footers) can leak onto the paper, and
// every row prints - not just the page of the table shown on screen.
//
// printReport({
//   title: 'Case-wise report',
//   period: '1 Nov 2026 - 6 Nov 2026',
//   filters: ['Lab cases', 'Excluding cancelled'],         // optional
//   summary: [{ label: 'Received', value: '₹5,450.00' }],   // optional
//   sections: [{ title, columns: [{ label, align: 'right' }], rows: [[...]], totals: [...] }],
//   note: 'Days with no business are left out.',            // optional
// })
import { getLabProfile } from '../services/setupService';

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

let profileCache = null;
async function labProfile() {
  if (profileCache) return profileCache;
  try {
    const res = await getLabProfile();
    profileCache = res?.data || res || {};
  } catch {
    profileCache = {};
  }
  return profileCache;
}

function printedBy() {
  try { return JSON.parse(localStorage.getItem('ppl_user') || '{}').name || ''; } catch { return ''; }
}

const STYLE = `
  @page { size: A4; margin: 12mm 10mm 14mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font: 10pt/1.4 "Inter", "Segoe UI", Arial, sans-serif; color: #18181b; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .head { display: flex; justify-content: space-between; align-items: flex-end; gap: 12px; padding-bottom: 8px; border-bottom: 2px solid #18181b; }
  .lab { font-size: 14pt; font-weight: 700; }
  .lab-line { color: #52525b; font-size: 8.5pt; }
  .meta { text-align: right; color: #52525b; font-size: 8.5pt; }
  h1 { margin: 12px 0 2px; font-size: 13pt; }
  .period { color: #3f3f46; }
  .filters { margin-top: 2px; color: #71717a; font-size: 8.5pt; }
  .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: 0; margin: 10px 0 4px; border: 1px solid #d4d4d8; border-radius: 6px; overflow: hidden; }
  .summary div { padding: 6px 9px; border-right: 1px solid #e4e4e7; }
  .summary div:last-child { border-right: 0; }
  .summary span { display: block; color: #71717a; font-size: 8pt; }
  .summary b { font-size: 11pt; font-variant-numeric: tabular-nums; }
  h2 { margin: 14px 0 4px; font-size: 10.5pt; }
  table { width: 100%; border-collapse: collapse; table-layout: auto; }
  thead { display: table-header-group; }
  tr { page-break-inside: avoid; }
  th { text-align: left; font-size: 8pt; font-weight: 600; color: #52525b; text-transform: none; border-bottom: 1px solid #a1a1aa; padding: 4px 5px; white-space: nowrap; }
  td { padding: 4px 5px; border-bottom: 1px solid #ececee; vertical-align: top; word-break: break-word; }
  .r { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
  tfoot td { border-top: 1.5px solid #18181b; border-bottom: 0; font-weight: 700; }
  .empty { padding: 10px 0; color: #71717a; }
  .note { margin-top: 8px; color: #71717a; font-size: 8.5pt; }
  .foot { margin-top: 14px; color: #a1a1aa; font-size: 7.5pt; text-align: center; }
`;

function buildHtml(report, profile) {
  const contact = [profile.address, profile.phone, profile.email].filter(Boolean).join(' · ');
  const now = new Date().toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  const by = printedBy();
  const summary = (report.summary || []).filter(Boolean);
  const sections = (report.sections || []).filter(Boolean);
  const table = (section) => {
    const cols = section.columns || [];
    const cls = (i) => (cols[i]?.align === 'right' ? ' class="r"' : '');
    const head = `<thead><tr>${cols.map((c, i) => `<th${cls(i)}>${esc(c.label)}</th>`).join('')}</tr></thead>`;
    const body = (section.rows || []).length
      ? `<tbody>${section.rows.map((row) => `<tr>${row.map((cell, i) => `<td${cls(i)}>${esc(cell)}</td>`).join('')}</tr>`).join('')}</tbody>`
      : `<tbody><tr><td colspan="${cols.length || 1}" class="empty">${esc(section.empty || 'Nothing in this period.')}</td></tr></tbody>`;
    const foot = section.totals ? `<tfoot><tr>${section.totals.map((cell, i) => `<td${cls(i)}>${esc(cell)}</td>`).join('')}</tr></tfoot>` : '';
    return `${section.title ? `<h2>${esc(section.title)}</h2>` : ''}<table>${head}${body}${foot}</table>`;
  };
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(report.title)}</title><style>${STYLE}</style></head><body>
    <div class="head">
      <div><div class="lab">${esc(profile.labName || 'Pure Path Lab')}</div>${contact ? `<div class="lab-line">${esc(contact)}</div>` : ''}</div>
      <div class="meta">Printed ${esc(now)}${by ? `<br>by ${esc(by)}` : ''}</div>
    </div>
    <h1>${esc(report.title)}</h1>
    ${report.period ? `<div class="period">${esc(report.period)}</div>` : ''}
    ${(report.filters || []).filter(Boolean).length ? `<div class="filters">${esc(report.filters.filter(Boolean).join(' · '))}</div>` : ''}
    ${summary.length ? `<div class="summary">${summary.map((s) => `<div><span>${esc(s.label)}</span><b>${esc(s.value)}</b></div>`).join('')}</div>` : ''}
    ${sections.map(table).join('')}
    ${report.note ? `<div class="note">${esc(report.note)}</div>` : ''}
    <div class="foot">${esc(report.title)} · ${esc(profile.labName || 'Pure Path Lab')}</div>
  </body></html>`;
}

/** Builds the report in a hidden frame and opens the print dialog. */
export default async function printReport(report) {
  const profile = await labProfile();
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.title = 'Print';
  Object.assign(frame.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0', visibility: 'hidden' });
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  doc.open(); doc.write(buildHtml(report, profile)); doc.close();
  const win = frame.contentWindow;
  const cleanup = () => setTimeout(() => frame.remove(), 500);
  win.addEventListener('afterprint', cleanup);
  // Let fonts and layout settle, then print.
  await new Promise((resolve) => setTimeout(resolve, 150));
  if (window.__pplPrintCapture) { window.__pplPrintCapture(doc.documentElement.outerHTML); cleanup(); return; }
  win.focus();
  win.print();
  setTimeout(cleanup, 60000);
}

/** Fetch every page of a paginated list (the server caps page size). */
export async function fetchAllPages(fetchPage, { pageSize = 100, maxPages = 50 } = {}) {
  const all = [];
  for (let page = 1; page <= maxPages; page += 1) {
    const { items, pages } = await fetchPage(page, pageSize);
    all.push(...(items || []));
    if (!pages || page >= pages) break;
  }
  return all;
}

export { buildHtml as buildReportHtml };
