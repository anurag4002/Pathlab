// Which billed tests a report covers. Mirrors backend/src/utils/billItemModality.js
// (reportItems / reportTestNames): a mixed bill gets an 'inhouse' report for its
// catalog lines and an 'outsource' report for its typed/custom lines; a legacy
// or 'all' report covers every lab line. USG / X-ray lines never belong to a
// lab report. Prefer the server's `testNames` when the payload carries it.

const USG_PATTERN = /\bUSG\b|ultrasound|ultrasonogra|sonography/i;
const XRAY_PATTERN = /\bx[\s-]?ray\b|radiograph/i;
const ECG_PATTERN = /\bECG\b|\bEKG\b|electrocardio/i;

export const isImagingItem = (item = {}) => {
  const name = String(item?.name || '');
  if (ECG_PATTERN.test(name)) return false;
  if (USG_PATTERN.test(name) || XRAY_PATTERN.test(name)) return true;
  return ['USG', 'XRAY'].includes(item?.reportDepartment);
};

export const isInhouseItem = (item) => !!item && !isImagingItem(item)
  && !ECG_PATTERN.test(String(item.name || ''))
  && ['Test', 'TestPackage', 'TestPanel'].includes(item.itemType) && !!item.itemId;

export const isOutsourceItem = (item) => {
  if (!item || isImagingItem(item)) return false;
  if (ECG_PATTERN.test(String(item.name || ''))) return true;
  if (item.itemType === 'Custom') return true;
  return !item.itemId && !!String(item.name || '').trim();
};

export const cleanTestName = (name) => String(name || '').replace(/\s*\(bundle\)\s*$/i, '').trim();

/** The bill lines a report (or an entryMode string) covers. */
export const reportItems = (reportOrMode, items) => {
  const mode = (typeof reportOrMode === 'string' ? reportOrMode : reportOrMode?.entryMode) || 'all';
  const list = (Array.isArray(items) ? items : []).filter((item) => item && typeof item === 'object' && !isImagingItem(item));
  if (mode === 'inhouse') return list.filter(isInhouseItem);
  if (mode === 'outsource') return list.filter(isOutsourceItem);
  return list;
};

/**
 * Unique display names of a report's own tests.
 * @param report  report payload (uses report.testNames when present)
 * @param items   bill lines; defaults to report.bill.items
 */
export const reportTestNames = (report, items) => {
  if (Array.isArray(report?.testNames)) return report.testNames.map(cleanTestName).filter(Boolean);
  const lines = items !== undefined ? items : report?.bill?.items;
  return [...new Set(reportItems(report, lines).map((item) => cleanTestName(item.name || item.testName)).filter(Boolean))];
};

/**
 * Tests named on an outsource upload screen: the report's own outsourced
 * lines. A legacy/'all' report uploads the bill's outsourced lines; if the
 * bill has none (whole bill sent out) every lab line is listed.
 */
export const uploadTestNames = (report, items) => {
  const mode = report?.entryMode;
  if (mode === 'outsource' || mode === 'inhouse') return reportTestNames(report, items);
  const lines = items !== undefined ? items : report?.bill?.items;
  const outsourced = reportTestNames({ entryMode: 'outsource' }, lines);
  return outsourced.length ? outsourced : reportTestNames({ entryMode: 'all' }, lines);
};

/**
 * Outsource upload state for a report: the tests a file can be tagged with and
 * which of them already have a file. Uses the server's `outsourceTests` /
 * `fileCoverage` when present; an untagged (older) file covers every test.
 * Returns { tests: string[], coverage: [{ name, covered, fileId, fileName }] }.
 */
export const outsourceUploadInfo = (report, items) => {
  const tests = Array.isArray(report?.outsourceTests) && report.outsourceTests.length
    ? report.outsourceTests
    : uploadTestNames(report, items);
  const server = Array.isArray(report?.fileCoverage) ? report.fileCoverage : [];
  const files = Array.isArray(report?.files) ? report.files : [];
  const legacy = !files.length && !!(report?.fileUrl || report?.hasFile);
  const coverage = tests.map((name) => {
    const row = server.find((r) => String(r?.name || '').toLowerCase() === name.toLowerCase());
    if (row) return row;
    const file = [...files].reverse().find((f) => !f?.tests?.length || f.tests.some((t) => String(t).toLowerCase() === name.toLowerCase()));
    if (file) return { name, covered: true, fileId: file._id, fileName: file.name || file.originalName || '' };
    return { name, covered: legacy, fileId: legacy ? 'legacy' : null, fileName: '' };
  });
  return { tests, coverage };
};

/** Tests ticked by default: the ones still waiting; all of them when none wait (a Replace). */
export const defaultUploadTicks = ({ tests = [], coverage = [] } = {}) => {
  const waiting = coverage.filter((row) => !row.covered).map((row) => row.name);
  return waiting.length ? waiting : [...tests];
};

/** One-line coverage for lists: { text: '1 of 2 uploaded', title: 'HbA1c: Uploaded (a.pdf) / Vitamin D: Waiting for report' } or null. */
export const coverageSummary = (report) => {
  const coverage = Array.isArray(report?.fileCoverage) ? report.fileCoverage : [];
  if (!coverage.length) return null;
  const done = coverage.filter((row) => row.covered).length;
  const title = coverage.map((row) => `${row.name}: ${row.covered ? `Uploaded${row.fileName ? ` (${row.fileName})` : ''}` : 'Waiting for report'}`).join('\n');
  const text = done === coverage.length
    ? (coverage.length > 1 ? 'All uploaded' : 'Uploaded')
    : done === 0 ? 'Waiting for report' : `${done} of ${coverage.length} uploaded`;
  return { text, title, done, total: coverage.length };
};
