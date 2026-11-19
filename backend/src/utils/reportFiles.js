// Outsource report files and the tests each one covers.
//
// An outside lab may send one PDF covering several outsourced tests, or one
// per test. Each uploaded file is stored on report.files with the billed test
// names it covers (`tests`). A file with no tags (every upload made before
// tagging existed, kept only in report.fileUrl) covers all of the report's
// outsourced tests.
const { reportTestNames, cleanTestName } = require('./billItemModality');

const OPEN_STATUSES = ['Pending', 'Registered', 'Collected', 'Received', 'Draft'];

// Publishing: each file can be shown to the patient (portal, referrer, public
// QR link) on its own, before the other outsourced tests are back. A file
// stored before publishing existed (no `published` field), and the pre-tagging
// fileUrl upload, count as published - nothing that was visible disappears.
const isFilePublished = file => !!file && file.published !== false;
const key = name => cleanTestName(name).toLowerCase();

/**
 * The tests an upload on this report can cover: an outsource report's own
 * outsourced lines. A legacy/'all' report uses the bill's outsourced lines,
 * or every lab line when the whole bill was sent out.
 */
const outsourceTestNames = (report, items = []) => {
  const mode = report?.entryMode || 'all';
  if (mode === 'outsource' || mode === 'inhouse') return reportTestNames(report, items);
  const outsourced = reportTestNames('outsource', items);
  return outsourced.length ? outsourced : reportTestNames('all', items);
};

/** Stored files, with a pre-tagging upload (fileUrl only) as one untagged file. */
const reportFileList = (report) => {
  const files = Array.isArray(report?.files) ? report.files.filter(file => file && file.url) : [];
  if (files.length) return files;
  if (report?.fileUrl) {
    return [{ _id: 'legacy', url: report.fileUrl, originalName: '', mimeType: '', tests: [], uploadedAt: report.reportDate || report.updatedAt || null, legacy: true }];
  }
  return [];
};

const fileCovers = (file, name) => {
  const tags = Array.isArray(file?.tests) ? file.tests : [];
  return !tags.length || tags.some(tag => key(tag) === key(name));
};

/**
 * Per-test coverage: [{ name, covered, fileId, fileName }]. The newest file
 * that covers a test is the one shown for it.
 */
const fileCoverage = (report, names = []) => {
  const files = reportFileList(report);
  return names.map((name) => {
    const file = [...files].reverse().find(f => fileCovers(f, name));
    return {
      name,
      covered: !!file,
      fileId: file ? String(file._id) : null,
      fileName: file ? (file.originalName || String(file.url || '').split('/').pop()) : null,
      published: file ? isFilePublished(file) : false
    };
  });
};

/** A short, client-safe view of the files ({ _id, name, mimeType, tests, uploadedAt }). */
const publicFileList = (report, { publishedOnly = false } = {}) => reportFileList(report)
  .filter(file => !publishedOnly || isFilePublished(file))
  .map(file => ({
    _id: String(file._id),
    name: file.originalName || String(file.url || '').split('/').pop(),
    mimeType: file.mimeType || '',
    tests: Array.isArray(file.tests) ? [...file.tests] : [],
    uploadedAt: file.uploadedAt || null,
    legacy: !!file.legacy,
    published: isFilePublished(file),
    publishedAt: file.publishedAt || null
  }));

/** Parse the `tests` tags sent with an upload (JSON array, comma list or repeated fields). */
const parseTestTags = (raw) => {
  if (raw === undefined || raw === null || raw === '') return null;
  let list = raw;
  if (typeof raw === 'string') {
    const text = raw.trim();
    if (text.startsWith('[')) {
      try { list = JSON.parse(text); } catch { list = [text]; }
    } else {
      list = [text];
    }
  }
  if (!Array.isArray(list)) list = [list];
  return list.map(item => String(item || '').trim()).filter(Boolean);
};

const badRequest = message => Object.assign(new Error(message), { statusCode: 400 });

/**
 * Add an uploaded file to the report, tagged with the tests it covers.
 * - `tags` null/undefined (an older client) → the file covers every test.
 * - Tests the new file covers are taken off older files; an older file left
 *   covering nothing is dropped (that is a Replace).
 * - The report is Completed (as before) once every outsourced test has a
 *   file; until then an open report shows as Draft. Nothing is signed here.
 * Mutates `report` (a mongoose doc); returns { removedUrls, coverage }.
 */
const addReportFile = (report, { url, originalName = '', mimeType = '', tags, userId = null, publish = true }, names = []) => {
  if (!url) throw badRequest('Please upload a file');
  let fileTests = [];
  if (names.length) {
    if (tags === null || tags === undefined) {
      fileTests = [...names];
    } else {
      const wanted = new Set(tags.map(key));
      fileTests = names.filter(name => wanted.has(key(name)));
      if (!fileTests.length) throw badRequest('Tick at least one test this file contains');
    }
  }

  // Bring a pre-tagging upload into the list before re-tagging.
  if ((!report.files || !report.files.length) && report.fileUrl) {
    report.files = [{ url: report.fileUrl, tests: [], uploadedAt: report.reportDate || new Date() }];
  }

  const taken = new Set(fileTests.map(key));
  const removedUrls = [];
  const kept = [];
  for (const file of report.files || []) {
    const current = file.tests && file.tests.length ? [...file.tests] : [...names];
    const remaining = names.length ? current.filter(name => !taken.has(key(name))) : [];
    if (!remaining.length) {
      if (file.url && file.url !== url) removedUrls.push(file.url);
      continue;
    }
    file.tests = remaining;
    kept.push(file);
  }
  const now = new Date();
  kept.push({
    url, originalName, mimeType, tests: fileTests, uploadedAt: now, uploadedBy: userId,
    published: publish !== false,
    publishedAt: publish !== false ? now : null,
    publishedBy: publish !== false ? userId : null
  });
  report.files = kept;
  report.fileUrl = url;
  if (userId) report.uploadedBy = userId;

  const coverage = fileCoverage(report, names);
  const complete = coverage.every(row => row.covered);
  if (complete) {
    report.status = 'Completed';
    report.reportDate = new Date();
    report.tat = report.tat || {};
    if (!report.tat.reported) report.tat.reported = new Date();
  } else if (OPEN_STATUSES.includes(report.status)) {
    report.status = 'Draft';
  }
  if (typeof report.markModified === 'function') report.markModified('files');
  return { removedUrls, coverage, complete };
};

/** Pick one stored file by id (or the newest one). */
const findReportFile = (report, fileId) => {
  const files = reportFileList(report);
  if (!files.length) return null;
  if (fileId === undefined || fileId === null || fileId === '') return files[files.length - 1];
  return files.find(file => String(file._id) === String(fileId)) || null;
};

/** Parse the "Publish to the patient now" flag of an upload (default: publish). */
const parsePublishFlag = (raw) => {
  if (raw === undefined || raw === null || raw === '') return true;
  return !['false', '0', 'no', 'off'].includes(String(raw).trim().toLowerCase());
};

/**
 * Publish / unpublish one stored file. A pre-tagging upload (fileUrl only,
 * id 'legacy') is first brought into report.files. Mutates the doc; returns
 * the file or null when not found.
 */
const setFilePublished = (report, fileId, published, userId = null) => {
  if ((!report.files || !report.files.length) && report.fileUrl) {
    report.files = [{ url: report.fileUrl, tests: [], uploadedAt: report.reportDate || new Date() }];
    if (String(fileId) === 'legacy') fileId = String(report.files[0]._id);
  }
  const file = (report.files || []).find(f => String(f._id) === String(fileId));
  if (!file) return null;
  file.published = !!published;
  file.publishedAt = published ? new Date() : null;
  file.publishedBy = published ? userId : null;
  if (typeof report.markModified === 'function') report.markModified('files');
  return file;
};

const FINAL_STATUSES = ['Signed', 'Verified', 'Completed'];

/**
 * The file a patient / referrer / public link may download.
 * Returns { file } (may be null when the report has no files at all) or
 * { blocked: true } when the asked-for file (or every file) is not published.
 * Unknown file ids give { missing: true }.
 */
const findPatientFile = (report, fileId) => {
  const files = reportFileList(report);
  if (!files.length) return { file: null };
  if (fileId !== undefined && fileId !== null && fileId !== '') {
    const file = files.find(f => String(f._id) === String(fileId));
    if (!file) return { missing: true };
    return isFilePublished(file) ? { file } : { blocked: true };
  }
  const published = files.filter(isFilePublished);
  return published.length ? { file: published[published.length - 1] } : { blocked: true };
};

/**
 * What a patient-facing page may show for an outsource report:
 * { files: published files, readyTests, waitingTests, partial, summary }.
 * summary e.g. "1 of 2 ready — Vitamin D still with the outside lab".
 */
const patientFileView = (report, items = []) => {
  const files = publicFileList(report, { publishedOnly: true });
  const all = reportFileList(report);
  if (!all.length) return { files: [], readyTests: [], waitingTests: [], partial: false, summary: '' };
  const names = outsourceTestNames(report, items);
  const published = all.filter(isFilePublished);
  const readyTests = names.filter(name => published.some(file => fileCovers(file, name)));
  const waitingTests = names.filter(name => !readyTests.includes(name));
  const partial = files.length > 0 && waitingTests.length > 0;
  const summary = names.length && files.length
    ? (waitingTests.length
      ? `${readyTests.length} of ${names.length} ready — ${waitingTests.join(', ')} still with the outside lab`
      : `${names.length > 1 ? 'All tests' : 'Report'} ready`)
    : '';
  return { files, readyTests, waitingTests, partial, summary };
};

/** True when a patient may download something: a final report, or published files. */
const patientCanDownload = (report) => {
  const files = reportFileList(report);
  if (files.length) return files.some(isFilePublished);
  return FINAL_STATUSES.includes(String(report?.status || ''));
};

/**
 * Client view of a report's uploads: { files, outsourceTests, fileCoverage }.
 * Coverage is listed for outsource reports and any report holding a file.
 */
const describeReportFiles = (report, items = []) => {
  const files = publicFileList(report);
  const isOutsource = report?.entryMode === 'outsource' || files.length > 0;
  const outsourceTests = isOutsource ? outsourceTestNames(report, items) : [];
  return {
    files,
    outsourceTests,
    fileCoverage: isOutsource ? fileCoverage(report, outsourceTests) : []
  };
};

module.exports = {
  isFilePublished,
  setFilePublished,
  parsePublishFlag,
  findPatientFile,
  patientFileView,
  patientCanDownload,
  describeReportFiles,
  outsourceTestNames,
  reportFileList,
  publicFileList,
  fileCoverage,
  parseTestTags,
  addReportFile,
  findReportFile
};
