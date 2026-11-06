import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, ChevronDown, ChevronUp, CheckCircle2, FileDown, FileEdit, Pencil, Plus, RefreshCw, Upload } from 'lucide-react';
import {
  PageHeader,
  Button,
  DataTable,
  StatusBadge,
  Input,
  LoadingSpinner,
  ConfirmDialog,
  AdvancedFilterBar,
  Modal,
  FileUploader,
  Select,
  WhatsAppShare
} from '../../components/common';
import {
  getPendingLabCases,
  getReportForEntry,
  createResultReport,
  saveReportResultsDraft,
  submitReportResults,
  uploadReport,
  attachReportFile,
  signReport,
  updateReportPrintSettings
} from '../../services/reportService';
import { getSignatures } from '../../services/setupService';
import { downloadReportPdf } from '../../services/publicService';
import { isAdmin } from '../../utils/permissions';
import useAuth from '../../hooks/useAuth';
import { getDoctorById } from '../../services/doctorService';
import { buildCalculatedResults } from '../../utils/reportResults';
import { compileReportFormulas, calculateLocalResults } from '../../utils/localReportCalculations';
import formatCurrency from '../../utils/formatCurrency';
import useDebounce from '../../hooks/useDebounce';
import RangeFlagBadge from '../../components/lab/RangeFlagBadge';
import DifferentialTotalRow from '../../components/lab/DifferentialTotalRow';
import { differentialTotalsByRow } from '../../utils/differentialCount';
import '../../styles/ResultEntry.css';
import ReportTatEditor from '../../components/lab/ReportTatEditor';
import ReportPrintActions from '../../components/lab/ReportPrintActions';
import DocumentResultEditor from '../../components/lab/DocumentResultEditor';
import BarcodeSvg from '../../components/lab/BarcodeSvg';
import InlineTestInterpretation from '../../components/lab/InlineTestInterpretation';
import { hasInterpretation } from '../../utils/interpretationContent';

const isOutsourceBill = (bill) => (
  bill?.caseType === 'OutsourceLabCase'
  || String(bill?.department || '').toUpperCase().includes('OUTSOURCE')
);

const isOutsourceWork = (report, bill) => {
  const mode = report?.entryMode;
  if (mode === 'outsource') return true;
  if (mode === 'inhouse') return false;
  return isOutsourceBill(bill);
};

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'Pending', label: 'Pending (no shell yet)' },
  { value: 'Registered', label: 'Registered' },
  { value: 'Draft', label: 'Draft' }
];

/* Local API error mapper: surfaces only the backend's user-facing `message`
   field (never `errors.stack`), with sensible fallbacks per failure type. */
const getApiErrorMessage = (err, fallback) => {
  if (err?.response) {
    const data = err.response.data;
    if (data && typeof data.message === 'string' && data.message.trim()) {
      return data.message;
    }
    const status = err.response.status;
    if (status === 401) return 'Your session has expired. Please log in again.';
    if (status === 403) return 'You do not have permission to perform this action.';
    if (status === 404) return 'The requested record was not found.';
    if (status === 409) return 'The record was changed elsewhere. Please refresh and try again.';
    if (status === 422) return 'The submitted data is invalid.';
    if (status >= 500) return 'Server error. Please try again.';
    return fallback;
  }
  if (err?.code === 'ECONNABORTED') return 'The request timed out. Please try again.';
  if (err?.request) return 'Network error. Please check your connection and try again.';
  return err?.message || fallback;
};

/* Reference range display — backend-provided strings/numbers only, never computed here. */
const formatReferenceRange = (testEntry) => {
  if (testEntry.referenceRange) return testEntry.referenceRange;
  const parts = [];
  if (testEntry.maleReferenceRange) parts.push(`Male: ${testEntry.maleReferenceRange}`);
  if (testEntry.femaleReferenceRange) parts.push(`Female: ${testEntry.femaleReferenceRange}`);
  if (parts.length) return parts.join(' / ');
  // Fall back to the numeric normal bounds the API also provides (Phase 2).
  const { normalLow, normalHigh } = testEntry;
  if (normalLow != null && normalHigh != null) return `${normalLow} - ${normalHigh}`;
  if (normalLow != null) return `>= ${normalLow}`;
  if (normalHigh != null) return `<= ${normalHigh}`;
  return '—';
};

/* The same test can arrive twice (billed directly + inside a package). */
const dedupeTestEntries = (list) => {
  const seen = new Set();
  const out = [];
  (list || []).forEach((testEntry) => {
    const key = testEntry.resultKey || testEntry.testId || `name:${testEntry.testName}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(testEntry);
  });
  return out;
};

/* Payload mirrors the backend row builder: non-derived tests only,
   trimmed non-empty values, unit carried from the test master. */
const entryKey = (testEntry) => testEntry?.resultKey || testEntry?.testId || `name:${testEntry?.testName || ''}`;

const buildResultsPayload = (testEntries, values, remarks = {}) =>
  (testEntries || [])
    .filter((testEntry) => !testEntry.isDerived)
    .map((testEntry) => {
      const key = entryKey(testEntry);
      return {
        ...(testEntry.testId ? { test: testEntry.testId } : {}),
        ...(testEntry.parameterCode ? { parameterCode: testEntry.parameterCode } : {}),
        testName: testEntry.testName,
        value: String(values[key] ?? '').trim(),
        unit: testEntry.testId ? testEntry.unit || '' : testEntry.unit || testEntry.existingUnit || '',
        ...(String(remarks[key] || '').trim() ? { remark: String(remarks[key]).trim() } : {})
      };
    })
    .filter((row) => row.value !== '');

const isReportFinal = (status) => ['Reported', 'Signed', 'Verified', 'Completed'].includes(status);

// Groups entry rows the way the printed report reads: department (lab order,
// then category order), its panels (panel order), then its single tests.
function groupEntriesForReport(testEntries, sectionSetting, deptOrder) {
  const settingOrder = (key) => sectionSetting(key).order;
  const departments = [];
  for (const test of testEntries) {
    const deptName = test.sectionDepartment || test.categoryName || 'Tests';
    let dept = departments.find((d) => d.name === deptName);
    if (!dept) { dept = { name: deptName, rank: test.sectionDepartmentRank ?? Infinity, groups: [], first: departments.length }; departments.push(dept); }
    const panel = /^(panel|package):/.test(test.sectionKey || '');
    const groupKey = panel ? test.sectionKey : 'single';
    let group = dept.groups.find((g) => g.key === groupKey);
    if (!group) { group = { key: groupKey, name: panel ? test.panelName || test.packageName : '', panel, rank: test.sectionRank ?? Infinity, first: dept.groups.length, tests: [] }; dept.groups.push(group); }
    group.tests.push(test);
  }
  const deptIndex = (name) => { const i = deptOrder.indexOf(name); return i < 0 ? Infinity : i; };
  departments.sort((a, b) => (deptIndex(a.name) - deptIndex(b.name)) || (a.rank - b.rank) || (a.first - b.first));
  departments.forEach((dept) => {
    dept.groups.sort((a, b) => Number(!a.panel) - Number(!b.panel)
      || ((Number.isFinite(settingOrder(a.key)) && Number.isFinite(settingOrder(b.key))) ? settingOrder(a.key) - settingOrder(b.key) : 0)
      || (a.rank - b.rank) || (a.first - b.first));
    const single = dept.groups.find((g) => !g.panel);
    if (single) single.tests.sort((a, b) => (a.sectionRank ?? Infinity) - (b.sectionRank ?? Infinity));
  });
  return departments;
}

const SIGNATURE_KEY = 'pathlab.resultEntry.signatureId';
const readStoredSignature = () => { try { return localStorage.getItem(SIGNATURE_KEY) || ''; } catch { return ''; } };

const ResultEntry = () => {
  const { user } = useAuth();
  // ?report=<id> or ?bill=<id>&patient=<id> opens that case directly
  // (from Bills, Today's Reports or a shared link).
  const [searchParams, setSearchParams] = useSearchParams();
  const linkedCaseRef = useRef('');
  // Frontend affordance only — the backend still checks permissions.
  const canSign = isAdmin(user);
  // Sign straight from entry: signatures load once and the last one used
  // is preselected, so routine sign-off is a single click.
  const [signatures, setSignatures] = useState([]);
  const [signaturesError, setSignaturesError] = useState('');
  const [signatureId, setSignatureId] = useState(readStoredSignature);
  useEffect(() => {
    if (!canSign) return undefined;
    let active = true;
    getSignatures().then((response) => {
      if (!active) return;
      const list = Array.isArray(response?.data) ? response.data : (Array.isArray(response?.data?.signatures) ? response.data.signatures : []);
      setSignatures(list);
      setSignatureId((current) => (list.some((item) => String(item._id) === String(current)) ? current : list[0]?._id || ''));
      setSignaturesError(response?.success === false ? response.message || 'Could not load signatures.' : '');
    }).catch((error) => { if (active) setSignaturesError(getApiErrorMessage(error, 'Could not load signatures.')); });
    return () => { active = false; };
  }, [canSign]);
  const chooseSignature = (value) => {
    setSignatureId(value);
    try { localStorage.setItem(SIGNATURE_KEY, value); } catch { /* per-browser convenience only */ }
  };
  const selectedSignature = signatures.find((item) => String(item._id) === String(signatureId)) || null;
  // Server state — pending case list
  const [cases, setCases] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const debouncedSearch = useDebounce(search, 400);
  const [reloadKey, setReloadKey] = useState(0);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState(null);

  // Server state — opened case
  const [view, setView] = useState('list'); // 'list' | 'entry'
  const [activeRow, setActiveRow] = useState(null);
  const [entry, setEntry] = useState(null);
  const [entryLoading, setEntryLoading] = useState(false);

  // Outsource PDF/image upload (same API as Today's Reports)
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadTarget, setUploadTarget] = useState(null); // { patient, bill }
  const [uploadPickBillId, setUploadPickBillId] = useState('');
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadError, setUploadError] = useState(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [entryError, setEntryError] = useState(null);
  const [referrerName, setReferrerName] = useState('');
  const [customResultKeys, setCustomResultKeys] = useState({});

  // Local form state — draft copy; the server stays the source of truth
  const [values, setValues] = useState({});
  const [dirty, setDirty] = useState(false);
  const [savedAt, setSavedAt] = useState(0);

  // Action state
  const [busy, setBusy] = useState(null); // null | 'draft' | 'submit'
  const [feedback, setFeedback] = useState(null); // { type: 'error' | 'success', text }
  const [openInterpretations, setOpenInterpretations] = useState({});
  const navigate = useNavigate();
  const [remarks, setRemarks] = useState({});
  const [openRemarks, setOpenRemarks] = useState({});
  const [openNotes, setOpenNotes] = useState({});
  const [signMenuOpen, setSignMenuOpen] = useState(false);
  // Print options per section (reference LIS checkboxes), saved on the report
  // immediately so the PDF reflects them.
  // Saved edits for the open report; otherwise the report's stored settings.
  const [printOverride, setPrintOverride] = useState(null);
  const [printSaving, setPrintSaving] = useState(false);
  const printSettings = !entry?.report?._id ? null
    : printOverride?.reportId === entry.report._id ? printOverride : {
      reportId: entry.report._id,
      sectionSettings: entry.report.sectionSettings || [],
      departmentOrder: entry.report.departmentOrder || [],
      printCategoriesFromNewPage: entry.report.printCategoriesFromNewPage !== false,
      sectionNotes: entry.report.sectionNotes || [],
      moreDetails: entry.report.moreDetails || ''
    };
  const savePrintSettings = async (next) => {
    const reportId = entry?.report?._id;
    if (!reportId) return;
    const previous = printOverride;
    setPrintOverride({ ...next, reportId });
    setPrintSaving(true);
    try {
      await updateReportPrintSettings(reportId, next);
    } catch (err) {
      setPrintOverride(previous);
      setFeedback({ type: 'error', text: getApiErrorMessage(err, 'Could not save print settings. Please try again.') });
    } finally { setPrintSaving(false); }
  };
  const sectionSetting = (key) => ({ printReady: true, keepTogether: true, newPage: false, pageBreakAfter: false, skipInterpretation: false, order: null,
    ...((printSettings?.sectionSettings || []).find((item) => item.key === key) || {}) });
  const toggleSection = (key, field) => {
    const current = printSettings?.sectionSettings || [];
    const updated = { ...sectionSetting(key), key, [field]: !sectionSetting(key)[field] };
    savePrintSettings({ ...printSettings, sectionSettings: [...current.filter((item) => item.key !== key), updated] });
  };
  const moveSection = (keys, key, delta) => {
    const index = keys.indexOf(key), target = index + delta;
    if (index < 0 || target < 0 || target >= keys.length) return;
    const nextKeys = [...keys]; [nextKeys[index], nextKeys[target]] = [nextKeys[target], nextKeys[index]];
    const current = printSettings?.sectionSettings || [];
    const others = current.filter((item) => !nextKeys.includes(item.key));
    savePrintSettings({ ...printSettings, sectionSettings: [...others, ...nextKeys.map((k, order) => ({ ...sectionSetting(k), key: k, order }))] });
  };
  const sectionNote = (key) => (printSettings?.sectionNotes || []).find((item) => item.key === key) || { key, notes: '', remarks: '', advice: '' };
  // Notes / Remarks / Advice are edited locally and saved when the box loses focus.
  const [noteDrafts, setNoteDrafts] = useState({});
  const noteValue = (key, field) => noteDrafts[`${key}|${field}`] ?? sectionNote(key)[field] ?? '';
  const saveNote = (key, field) => {
    const draftKey = `${key}|${field}`;
    if (!(draftKey in noteDrafts)) return;
    const updated = { ...sectionNote(key), [field]: noteDrafts[draftKey] };
    const others = (printSettings?.sectionNotes || []).filter((item) => item.key !== key);
    setNoteDrafts((prev) => { const next = { ...prev }; delete next[draftKey]; return next; });
    savePrintSettings({ ...printSettings, sectionNotes: [...others, updated] });
  };
  const [moreDetailsDraft, setMoreDetailsDraft] = useState(null);
  const moveDepartment = (names, name, delta) => {
    const index = names.indexOf(name), target = index + delta;
    if (index < 0 || target < 0 || target >= names.length) return;
    const next = [...names]; [next[index], next[target]] = [next[target], next[index]];
    savePrintSettings({ ...printSettings, departmentOrder: next });
  };
  const [discardOpen, setDiscardOpen] = useState(false);

  const inFlightRef = useRef(false); // synchronous re-entry guard
  const tatRef = useRef(null);
  const doctorReqRef = useRef(0); // stale referring-doctor response guard

  // Load pending cases (server is the source of truth).
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const params = { page };
        const query = debouncedSearch.trim();
        if (query) params.search = query;
        if (statusFilter) params.status = statusFilter;
        const res = await getPendingLabCases(params);
        if (!active) return;
        const data = res?.data ?? {};
        const targetPage = Math.max(1, Math.min(page, data.pagination?.pages || 1));
        if (targetPage !== page) {
          // The page we asked for no longer exists (e.g. its last case was
          // submitted) — keep the spinner and let the effect rerun.
          setPage(targetPage);
          return;
        }
        setCases(data.cases ?? []);
        setPagination(data.pagination ?? null);
        setListError(null);
        setListLoading(false);
      } catch (err) {
        if (!active) return;
        setCases([]);
        setPagination(null);
        setListError(getApiErrorMessage(err, 'Failed to load pending cases.'));
        setListLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [page, reloadKey, debouncedSearch, statusFilter]);

  // Resolve the referring doctor's display name (optional enrichment).
  const resolveReferrer = (patient, bill) => {
    const reqId = ++doctorReqRef.current;
    const docRef = patient?.referringDoctor || bill?.referringDoctor;
    if (!docRef) {
      setReferrerName('');
      return;
    }
    if (typeof docRef === 'object') {
      setReferrerName(docRef.name || '');
      return;
    }
    setReferrerName('');
    getDoctorById(docRef)
      .then((res) => {
        if (doctorReqRef.current === reqId) setReferrerName(res?.data?.name || '');
      })
      .catch(() => {
        // Optional display detail only — the field falls back to '—'.
        if (doctorReqRef.current === reqId) setReferrerName('');
      });
  };

  const compiledFormulas = useMemo(() => compileReportFormulas(entry?.testEntries), [entry?.testEntries]);
  const localResults = useMemo(() => calculateLocalResults(
    entry?.testEntries, compiledFormulas, values, entry?.patient
  ), [entry?.testEntries, compiledFormulas, values, entry?.patient]);
  // Submitted reports keep the saved results; editable reports calculate locally.
  const calculated = isReportFinal(entry?.report?.status)
    ? buildCalculatedResults(entry?.testEntries, entry?.results)
    : localResults.calculated;
  const calculationErrors = localResults.errors;

  const applyEntry = (data) => {
    const testEntries = dedupeTestEntries(data.testEntries);
    const initial = {};
    testEntries.forEach((testEntry) => {
      const key = entryKey(testEntry);
      // Document tests (Widal, FNAC, PAP smear ...) start from the lab's
      // template so staff only fill in the findings.
      const template = !isReportFinal(data.report?.status) && testEntry.sourceType === 'Document' ? testEntry.documentTemplate || '' : '';
      initial[key] =
        testEntry.existingValue != null && String(testEntry.existingValue) !== '' ? String(testEntry.existingValue) : template;
    });
    setEntry({ ...data, testEntries });
    setValues(initial);
    setRemarks(Object.fromEntries(testEntries.filter((t) => t.existingRemark).map((t) => [entryKey(t), t.existingRemark])));
    setOpenRemarks({});
    setOpenNotes({});
    setCustomResultKeys({});
    setDirty(false);
    resolveReferrer(data.patient, data.bill);
  };

  const openUploadForCase = async (row) => {
    const bill = row?.bill || null;
    const patient = bill?.patient && typeof bill.patient === 'object' ? bill.patient : null;
    if (!bill?._id || !patient?._id) {
      setFeedback({ type: 'error', text: 'This case is missing patient or bill information.' });
      return;
    }
    let reportId = row?.report?._id || null;
    // Ensure an outsource shell exists before upload (mixed / legacy bills).
    if (!reportId || row?.report?.entryMode === 'inhouse' || row?.report?.entryMode === 'all') {
      try {
        const created = await createResultReport({
          patient: patient._id,
          bill: bill._id,
          entryMode: 'outsource'
        });
        reportId = created?.data?._id || reportId;
      } catch {
        /* fall back to patient+bill upload */
      }
    }
    setUploadTarget({ bill, patient, reportId });
    setUploadPickBillId(String(bill._id));
    setUploadFile(null);
    setUploadError(null);
    setUploadOpen(true);
  };

  const openUploadPicker = () => {
    setUploadTarget(null);
    setUploadPickBillId('');
    setUploadFile(null);
    setUploadError(null);
    setUploadOpen(true);
  };

  const handleUploadSubmit = async () => {
    let patientId = uploadTarget?.patient?._id;
    let billId = uploadTarget?.bill?._id;
    if (!billId && uploadPickBillId) {
      const row = cases.find((c) => String(c?.bill?._id) === String(uploadPickBillId));
      patientId = row?.bill?.patient?._id;
      billId = row?.bill?._id;
    }
    if (!patientId || !billId) {
      setUploadError('Select an outsource invoice to upload against.');
      return;
    }
    if (!uploadFile) {
      setUploadError('Please select a PDF or image report file.');
      return;
    }
    setUploadLoading(true);
    setUploadError(null);
    try {
      const payload = new FormData();
      payload.append('file', uploadFile);
      let res;
      if (uploadTarget?.reportId) {
        res = await attachReportFile(uploadTarget.reportId, payload);
      } else {
        payload.append('patient', patientId);
        payload.append('bill', billId);
        res = await uploadReport(payload);
      }
      if (res?.success) {
        setUploadOpen(false);
        setUploadFile(null);
        setUploadTarget(null);
        setFeedback({
          type: 'success',
          text: res.message || 'Outsource report uploaded successfully.'
        });
        refreshList();
        if (view === 'entry') performBack();
      } else {
        setUploadError(res?.message || 'Upload failed.');
      }
    } catch (err) {
      setUploadError(getApiErrorMessage(err, 'Failed to upload report file.'));
    } finally {
      setUploadLoading(false);
    }
  };

  const openCase = async (row) => {
    if (inFlightRef.current) return;
    // Outsource shells use PDF/image upload — not numeric result grids.
    if (isOutsourceWork(row?.report, row?.bill)) {
      openUploadForCase(row);
      return;
    }
    inFlightRef.current = true;
    setView('entry');
    setEntryLoading(true);
    setEntry(null);
    setEntryError(null);
    setFeedback(null);
    setValues({});
    setDirty(false);
    setReferrerName('');
    setActiveRow(row);
    try {
      let reportId = row?.report?._id;
      if (!reportId) {
        const patientId = row?.bill?.patient?._id;
        const billId = row?.bill?._id;
        if (!patientId || !billId) {
          throw new Error('This case is missing patient or bill information.');
        }
        const entryMode = row?.report?.entryMode === 'outsource' ? 'outsource' : 'inhouse';
        const created = await createResultReport({ patient: patientId, bill: billId, entryMode });
        reportId = created?.data?._id;
        if (!reportId) {
          throw new Error('Could not register this case for result entry.');
        }
        // Remember the new report id so a retry never creates a second shell.
        setActiveRow({
          ...row,
          report: {
            ...(row.report || {}),
            _id: reportId,
            status: created.data.status,
            registrationNumber: created.data.registrationNumber
          }
        });
      }
      const res = await getReportForEntry(reportId);
      applyEntry(res.data);
    } catch (err) {
      setEntryError(getApiErrorMessage(err, 'Failed to open this case.'));
    } finally {
      setEntryLoading(false);
      inFlightRef.current = false;
    }
  };

  const handleValueChange = (testId, next) => {
    setValues((prev) => ({ ...prev, [testId]: next }));
    setDirty(true);
  };

  // Sign the report, submitting the current values first when needed.
  const handleSign = async () => {
    if (busy || inFlightRef.current || !entry?.report?._id || !canSign) return;
    if (!selectedSignature) { setFeedback({ type: 'error', text: 'Choose a signature before signing.' }); return; }
    const alreadySubmitted = isReportFinal(entry.report.status);
    if (!alreadySubmitted && !(await handleAction('submit', { quiet: true }))) return;
    inFlightRef.current = true;
    setBusy('sign');
    try {
      const res = await signReport(entry.report._id, selectedSignature._id);
      setEntry((prev) => (prev ? { ...prev, report: { ...prev.report, status: res?.data?.status ?? 'Signed' } } : prev));
      setFeedback({ type: 'success', text: `Results ${alreadySubmitted ? '' : 'submitted and '}signed by ${selectedSignature.name || 'the selected signatory'}.` });
    } catch (err) {
      setFeedback({ type: 'error', text: getApiErrorMessage(err, 'Results are saved, but signing failed. Please try again.') });
    } finally {
      setBusy(null);
      inFlightRef.current = false;
    }
  };

  const handleAction = async (mode, { quiet = false } = {}) => {
    if (busy || inFlightRef.current || !entry?.report?._id) return false;
    const payload = buildResultsPayload(entry.testEntries, values, remarks);
    if (payload.length === 0) {
      setFeedback({
        type: 'error',
        text:
          mode === 'draft'
            ? 'Enter a value for at least one test before saving.'
            : 'Enter a value for at least one test before submitting.'
      });
      return false;
    }
    inFlightRef.current = true;
    // Fields are disabled while saving, which drops the cursor; put it back
    // afterwards so Ctrl+S never interrupts typing.
    const focusedId = document.activeElement?.id;
    setBusy(mode);
    setFeedback(null);
    try {
      // Persist pending TAT edits before saving results, so editing the
      // date fields and clicking Save Draft / Submit never loses them.
      await tatRef.current?.flush();
      const res =
        mode === 'draft'
          ? await saveReportResultsDraft(entry.report._id, payload)
          : await submitReportResults(entry.report._id, payload);
      setDirty(false);
      setSavedAt(Date.now());
      // The mutation response is the authoritative report state.
      const updated = res?.data;
      setEntry((prev) =>
        prev
          ? {
              ...prev,
              results: updated?.results ?? prev.results,
              report: {
                ...prev.report,
                status: updated?.status ?? prev.report.status,
                registrationNumber:
                  updated?.registrationNumber ?? prev.report.registrationNumber,
                tat: updated?.tat ?? prev.report.tat
              }
            }
          : prev
      );
      if (!quiet) setFeedback({
        type: 'success',
        text:
          res?.message ||
          (mode === 'draft' ? 'Results saved as draft.' : 'Results submitted.')
      });
      // A submitted case leaves the pending list — refetch in the background
      // so Back shows it gone without a manual refresh.
      if (mode !== 'draft') {
        setListLoading(true);
        setListError(null);
        setReloadKey((key) => key + 1);
      }
      return true;
    } catch (err) {
      // Entered values are untouched — the user can correct and retry.
      setFeedback({
        type: 'error',
        text:
          mode === 'draft'
            ? getApiErrorMessage(err, 'Failed to save draft. Please try again.')
            : getApiErrorMessage(err, 'Failed to submit results. Please try again.')
      });
      return false;
    } finally {
      setBusy(null);
      inFlightRef.current = false;
      if (focusedId) requestAnimationFrame(() => { const field = document.getElementById(focusedId); if (field && !field.disabled) field.focus({ preventScroll: true }); });
    }
  };

  // Keyboard: Ctrl/Cmd+S saves, Ctrl/Cmd+Enter marks Final. The handler
  // reads the latest callbacks through a ref so it is registered once.
  const shortcutRef = useRef(null);
  shortcutRef.current = { handleAction, entry, busy };
  useEffect(() => {
    const onKey = (event) => {
      const { handleAction: act, entry: current, busy: working } = shortcutRef.current;
      if (!current?.report?._id || working || isReportFinal(current.report.status) || !(event.ctrlKey || event.metaKey)) return;
      const key = event.key.toLowerCase();
      if (key === 's') { event.preventDefault(); act('draft'); }
      else if (key === 'enter') { event.preventDefault(); act('submit'); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  // Closing the tab with unsaved values asks first.
  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (event) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  // A short "Saved" confirmation next to the buttons.
  useEffect(() => {
    if (!savedAt) return undefined;
    const timer = setTimeout(() => setSavedAt(0), 2500);
    return () => clearTimeout(timer);
  }, [savedAt]);
  // Value cells: Enter / Down go to the next value, Up to the previous, and
  // focusing a value selects it so typing replaces it.
  const valueFields = (root) => [...root.querySelectorAll('tr.ls-row input.form-control:not([disabled]), tr.ls-row select:not([disabled])')];
  const onSheetKeyDown = (event) => {
    const field = event.target;
    if (!field.closest?.('tr.ls-row') || event.altKey || event.ctrlKey || event.metaKey) return;
    const isSelect = field.tagName === 'SELECT';
    const step = event.key === 'Enter' ? (event.shiftKey ? -1 : 1)
      : !isSelect && event.key === 'ArrowDown' ? 1 : !isSelect && event.key === 'ArrowUp' ? -1 : 0;
    if (!step) return;
    const fields = valueFields(event.currentTarget);
    const next = fields[fields.indexOf(field) + step];
    if (!next) return;
    event.preventDefault();
    next.focus();
    next.scrollIntoView?.({ block: 'nearest' });
  };
  const onSheetFocus = (event) => {
    const field = event.target;
    if (field.tagName === 'INPUT' && field.closest?.('tr.ls-row') && typeof field.select === 'function') field.select();
  };

  useEffect(() => {
    const reportId = searchParams.get('report');
    const billId = searchParams.get('bill');
    const patientId = searchParams.get('patient');
    const link = reportId ? `report:${reportId}` : billId && patientId ? `bill:${billId}` : '';
    if (!link || linkedCaseRef.current === link) return;
    linkedCaseRef.current = link;
    openCase(reportId ? { report: { _id: reportId } } : { bill: { _id: billId, patient: { _id: patientId } }, report: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const performBack = () => {
    setDiscardOpen(false);
    if (searchParams.get('report') || searchParams.get('bill')) setSearchParams({}, { replace: true });
    doctorReqRef.current += 1; // drop any in-flight referrer lookup
    setView('list');
    setEntry(null);
    setActiveRow(null);
    setValues({});
    setDirty(false);
    setFeedback(null);
    setEntryError(null);
    setReferrerName('');
    // Refetch — the case may have left the pending list after submission.
    setListLoading(true);
    setListError(null);
    setReloadKey((key) => key + 1);
  };

  const requestBack = () => {
    if (dirty) {
      setDiscardOpen(true);
      return;
    }
    performBack();
  };

  const goToPage = (nextPage) => {
    if (nextPage === page) return;
    setListLoading(true);
    setListError(null);
    setPage(nextPage);
  };

  const refreshList = () => {
    setListLoading(true);
    setListError(null);
    setReloadKey((key) => key + 1);
  };

  // Terminal report states — results are already in, so the row offers no
  // data-entry action (prevents "Enter/Submit persisting after submission").

  const itemsLabelForRow = (row) => {
    let items = row?.bill?.items;
    if (!Array.isArray(items) || !items.length) return '—';
    const mode = row?.report?.entryMode;
    if (mode === 'inhouse') {
      items = items.filter((i) => ['Test', 'TestPackage', 'TestPanel'].includes(i?.itemType) && i?.itemId);
    } else if (mode === 'outsource') {
      items = items.filter((i) => i?.itemType === 'Custom' || (!i?.itemId && i?.name));
    }
    if (!items.length) {
      return mode === 'outsource' ? 'Outsource report' : mode === 'inhouse' ? 'In-house tests' : '—';
    }
    const names = items.map((i) => i?.name || 'Item').filter(Boolean);
    const label = names.join(', ');
    return label.length > 48 ? `${label.slice(0, 48)}…` : label;
  };

  const renderCaseRow = (row) => {
    const patient = row?.bill?.patient;
    const demographics = [patient?.age, patient?.gender]
      .filter((value) => value != null && value !== '')
      .join(' / ');
    const final = isReportFinal(row?.report?.status);
    const mode = row?.report?.entryMode;
    const items = Array.isArray(row?.bill?.items) ? row.bill.items : [];
    const hasInhouse = items.some((i) => ['Test', 'TestPackage', 'TestPanel'].includes(i?.itemType) && i?.itemId);
    const hasOutsource = items.some((i) => i?.itemType === 'Custom' || (!i?.itemId && i?.name));
    // Legacy single "all" row on a mixed bill — offer both actions.
    const showBoth = (!mode || mode === 'all') && hasInhouse && hasOutsource && !final;
    const outsource = !showBoth && isOutsourceWork(row?.report, row?.bill);
    const modeLabel = mode === 'outsource'
      ? 'Outsource'
      : mode === 'inhouse'
        ? 'In-house'
        : showBoth
          ? 'Mixed'
          : (outsource ? 'Outsource' : 'In-house');
    const rowKey = row?.report?._id
      ? `${row?.bill?._id}-${row.report._id}`
      : `${row?.bill?._id}-${modeLabel}`;
    return (
      <tr key={rowKey}>
        <td style={{ whiteSpace: 'nowrap' }}>{row?.bill?.billNumber || '—'}</td>
        <td>
          <span className="re-sub" style={{ fontWeight: 700, color: (outsource || showBoth) ? 'var(--color-primary)' : undefined }}>
            {modeLabel}
          </span>
        </td>
        <td>
          <div className="re-patient-name">{patient?.name || '—'}</div>
          {patient?.registrationNumber ? (
            <div className="re-sub">{patient.registrationNumber}</div>
          ) : null}
        </td>
        <td>{demographics || '—'}</td>
        <td style={{ maxWidth: 200 }}>{itemsLabelForRow(row)}</td>
        <td>
          <StatusBadge status={row?.report?.status} />
        </td>
        <td>
          {final && !outsource ? (
            <Button size="sm" variant="secondary" icon={<FileEdit size={16} />} onClick={() => openCase(row)}>
              View results
            </Button>
          ) : final ? (
            <span className="re-sub">Submitted — no action</span>
          ) : showBoth ? (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <Button
                size="sm"
                variant="secondary"
                icon={<FileEdit size={16} />}
                onClick={() => openCase({
                  ...row,
                  report: { ...(row.report || {}), _id: undefined, entryMode: 'inhouse' }
                })}
              >
                Enter Results
              </Button>
              <Button
                size="sm"
                variant="primary"
                icon={<Upload size={16} />}
                onClick={() => openUploadForCase({
                  ...row,
                  // Force a dedicated outsource shell (do not attach to legacy "all" report)
                  report: { entryMode: 'outsource' }
                })}
              >
                Upload Report
              </Button>
            </div>
          ) : outsource ? (
            <Button size="sm" variant="primary" icon={<Upload size={16} />} onClick={() => openUploadForCase(row)}>
              Upload Report
            </Button>
          ) : (
            <Button size="sm" variant="secondary" icon={<FileEdit size={16} />} onClick={() => openCase(row)}>
              {row?.report?.status === 'Draft' ? 'Edit Draft' : 'Enter Results'}
            </Button>
          )}
        </td>
      </tr>
    );
  };

  const renderTestRow = (testEntry, index) => {
    const isDerived = Boolean(testEntry.isDerived);
    const key = entryKey(testEntry);
    // Show the locally calculated value immediately (read-only).
    const calcRow = isDerived ? calculated[key] : null;
    const displayValue = isDerived ? calcRow?.value ?? '' : values[key] ?? '';
    return (
      <React.Fragment key={key || index}>
      <tr className={`ls-row${testEntry.parentName && testEntry.parameterCode ? ' ls-row-child' : ''}`}>
        <td className="ls-test">
          <div className="re-test-name">
            {canSign && testEntry.testId && (
              <Link to={`/lab/tests?edit=${testEntry.testId}`} target="_blank" rel="noopener noreferrer" className="ls-edit-test" title="Edit this test in the Test Database (opens a new tab)" aria-label={`Edit test ${testEntry.testName || ''}`}>
                <Pencil size={13} />
              </Link>
            )}{(testEntry.parentName && testEntry.parameterCode ? String(testEntry.testName || '').replace(`${testEntry.parentName}: `, '') : testEntry.testName) || 'Test'}
            {isDerived && <span className="re-fx" title={testEntry.formula || 'Automatically calculated'} aria-label="Calculated test">fx</span>}
          </div>
          {(hasInterpretation(testEntry.interpretation) || hasInterpretation(testEntry.catalogInterpretation)) && (
            <button type="button" className="ls-pill" aria-expanded={!!openInterpretations[key]}
              onClick={() => setOpenInterpretations(prev => ({ ...prev, [key]: !prev[key] }))}>
              {openInterpretations[key] ? 'Hide interpretation' : 'Interpretation'}
            </button>
          )}
        </td>
        <td className="ls-flag"><RangeFlagBadge variant="letter" value={String(displayValue).replace(/,/g, '')} test={testEntry} /></td>
        <td className={`re-result-cell${isDerived ? ' ls-derived' : ''}`}>
          {!isDerived && testEntry.resultOptions?.length > 0 && <Select
            name={`result-option-${key}`} aria-label={`Result option for ${testEntry.testName || 'test'}`}
            value={customResultKeys[key] || (displayValue && !testEntry.resultOptions.includes(displayValue)) ? '__other__' : displayValue}
            options={[...testEntry.resultOptions.map((option) => ({ value: option, label: option })), { value: '__other__', label: 'Other / enter value' }]}
            placeholder="Select result (optional)"
            disabled={busy !== null || isReportFinal(entry?.report?.status)}
            onChange={(event) => {
              const next = event.target.value;
              setCustomResultKeys((prev) => ({ ...prev, [key]: next === '__other__' }));
              handleValueChange(key, next === '__other__' ? '' : next);
            }} />}
          {!isDerived && testEntry.sourceType === 'Document' ? <span className="re-document-hint">Findings below</span> :
          (isDerived || !testEntry.resultOptions?.length || customResultKeys[key] || (displayValue && !testEntry.resultOptions.includes(displayValue))) && <Input
            id={`result-${key}`}
            name={`result-${key}`}
            type="text"
            aria-label={`Result value for ${testEntry.testName || 'test'}`}
            placeholder={isDerived ? 'Calculated value' : 'Enter value'}
            value={displayValue}
            onChange={(event) => handleValueChange(key, event.target.value)}
            disabled={isDerived || testEntry.legacyScalar || busy !== null || isReportFinal(entry?.report?.status)}
            helperText={
              isDerived
                ? calcRow
                  ? undefined
                  : calculationErrors[key] || undefined
                : testEntry.legacyScalar ? 'Previous entry retained. Use the separate parameter fields for new results.' : undefined
            }
            autoComplete="off"
          />}
        </td>
        <td className="re-unit">
          {!isDerived && (
            <button type="button" className={`ls-remark-btn${remarks[key] ? ' has-remark' : ''}`} title={remarks[key] ? 'Edit remark' : 'Add remark'} aria-label={`${remarks[key] ? 'Edit' : 'Add'} remark for ${testEntry.testName || 'test'}`}
              aria-expanded={!!openRemarks[key]} onClick={() => setOpenRemarks((prev) => ({ ...prev, [key]: !prev[key] }))}>
              <Plus size={13} />
            </button>
          )}
          {(testEntry.testId ? testEntry.unit : testEntry.unit || testEntry.existingUnit || calcRow?.unit) || ''}
        </td>
        <td className="re-range">{formatReferenceRange(testEntry)}</td>
      </tr>
      {(openRemarks[key] || remarks[key]) && !isDerived && (
        <tr className="ls-remark-row"><td colSpan={5}>
          <label className="ls-remark-label" htmlFor={`remark-${key}`}>Remark</label>
          <input id={`remark-${key}`} className="ls-remark-input" type="text" maxLength={500} placeholder="Printed under the test name"
            value={remarks[key] || ''} disabled={busy !== null || isReportFinal(entry?.report?.status)}
            onChange={(event) => { const next = event.target.value; setRemarks((prev) => ({ ...prev, [key]: next })); setDirty(true); }} />
        </td></tr>
      )}
      {!isDerived && testEntry.sourceType === 'Document' && (
        <tr className="ls-document-row"><td colSpan={5}>
          <DocumentResultEditor id={`result-${key}`} label={`Result value for ${testEntry.testName || 'test'}`}
            value={displayValue} onChange={(next) => handleValueChange(key, next)}
            disabled={busy !== null || isReportFinal(entry?.report?.status)} />
        </td></tr>
      )}
      <DifferentialTotalRow total={differentialTotals.get(key)} withFlagColumn />
      {openInterpretations[key] && (hasInterpretation(testEntry.interpretation) || hasInterpretation(testEntry.catalogInterpretation)) && <tr className="re-interp-row"><td colSpan={5}>
        <InlineTestInterpretation reportId={entry.report._id} testEntry={testEntry} readOnly={['Signed', 'Verified', 'Completed'].includes(entry.report.status)} />
      </td></tr>}
      </React.Fragment>
    );
  };

  const testEntries = entry?.testEntries ?? [];
  // Next pending case from the list, so staff can work through cases
  // without going back after each sign-off.
  const nextCase = cases.find((row) => !isReportFinal(row?.report?.status) && !isOutsourceWork(row?.report, row?.bill)
    && String(row?.bill?._id) !== String(entry?.bill?._id || activeRow?.bill?._id));
  const differentialTotals = differentialTotalsByRow(testEntries, values, calculated);
  const enterableCount = testEntries.filter((testEntry) => !testEntry.isDerived).length;
  const enteredCount = testEntries.filter(
    (testEntry) =>
      !testEntry.isDerived && String(values[entryKey(testEntry)] ?? '').trim() !== ''
  ).length;

  const outsourcePending = cases.filter(
    (c) => isOutsourceWork(c?.report, c?.bill) && !isReportFinal(c?.report?.status)
  );

  return (
    <div className="result-entry-page">
      {view === 'list' && <PageHeader
        title="Result Entry"
        subtitle="Enter in-lab results or upload outsource PDF/image reports for pending cases."
        action={
          view === 'list' ? (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <Button
                variant="primary"
                size="sm"
                icon={<Upload size={16} />}
                onClick={openUploadPicker}
              >
                Upload Report
              </Button>
              <Button
                variant="secondary"
                size="sm"
                icon={<RefreshCw size={16} />}
                onClick={refreshList}
                disabled={listLoading}
              >
                Refresh
              </Button>
            </div>
          ) : null
        }
      />}

      {view === 'list' ? (
        listError ? (
          <div className="re-banner re-banner-error" role="alert">
            <AlertTriangle size={16} aria-hidden="true" />
            <span>{listError}</span>
            <Button variant="secondary" size="sm" onClick={refreshList}>
              Retry
            </Button>
          </div>
        ) : (
          <>
            {feedback ? (
              <div
                className={`re-banner ${
                  feedback.type === 'error' ? 're-banner-error' : 're-banner-success'
                }`}
                role={feedback.type === 'error' ? 'alert' : 'status'}
              >
                {feedback.type === 'error' ? (
                  <AlertTriangle size={16} aria-hidden="true" />
                ) : (
                  <CheckCircle2 size={16} aria-hidden="true" />
                )}
                <span>{feedback.text}</span>
              </div>
            ) : null}
            <AdvancedFilterBar
              values={{ search, status: statusFilter }}
              onChange={(key, value) => {
                if (key === 'search') setSearch(value);
                if (key === 'status') setStatusFilter(value);
                setPage(1);
                setListLoading(true);
              }}
              onSearch={() => {
                setPage(1);
                setListLoading(true);
                setReloadKey((k) => k + 1);
              }}
              onClear={() => {
                setSearch('');
                setStatusFilter('');
                setPage(1);
                setListLoading(true);
                setReloadKey((k) => k + 1);
              }}
              fields={[
                {
                  key: 'search',
                  label: 'Search',
                  type: 'text',
                  placeholder: 'Invoice, patient name, ID, or phone…',
                  size: 'lg'
                },
                {
                  key: 'status',
                  label: 'Status',
                  type: 'select',
                  options: STATUS_OPTIONS,
                  placeholder: 'All statuses'
                }
              ]}
            />
            {/* Status only: the pending-cases API returns report.status but no
                tat/registeredAt, so Registered/TAT columns are omitted here. */}
            <DataTable
              headers={['Invoice No', 'Type', 'Patient', 'Age / Gender', 'Items', 'Report Status', 'Action']}
              data={cases}
              loading={listLoading}
              emptyTitle={debouncedSearch || statusFilter ? 'No matching cases' : 'No pending cases'}
              emptyMessage={
                debouncedSearch || statusFilter
                  ? 'No lab cases match your current filters.'
                  : 'There are no lab cases waiting for result entry right now. New bills appear here as Registered (In-house / Outsource) right after invoicing.'
              }
              pagination={
                pagination ? { ...pagination, onPageChange: goToPage } : undefined
              }
              renderRow={renderCaseRow}
            />
          </>
        )
      ) : (
        <>
          <div className="re-topbar">
            <Button
              variant="secondary"
              size="sm"
              icon={<ArrowLeft size={16} />}
              onClick={requestBack}
              disabled={busy !== null}
            >
              Back to cases
            </Button>
          </div>

          {feedback ? (
            <div
              className={`re-banner ${
                feedback.type === 'error' ? 're-banner-error' : 're-banner-success'
              }`}
              role={feedback.type === 'error' ? 'alert' : 'status'}
            >
              {feedback.type === 'error' ? (
                <AlertTriangle size={16} aria-hidden="true" />
              ) : (
                <CheckCircle2 size={16} aria-hidden="true" />
              )}
              <span>{feedback.text}</span>
            </div>
          ) : null}

          {entryLoading ? (
            <div className="re-state-block">
              <LoadingSpinner label="Loading case..." />
            </div>
          ) : entryError ? (
            <div className="re-banner re-banner-error" role="alert">
              <AlertTriangle size={16} aria-hidden="true" />
              <span>{entryError}</span>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => activeRow && openCase(activeRow)}
              >
                Retry
              </Button>
            </div>
          ) : entry ? (
            <>
              <div className="ls-report-head">
                <div>
                  <h1 className="ls-title">Lab report</h1>
                  <div className="ls-chips">
                    <span className="ls-chip ls-chip-reg">Reg no. {entry.report?.registrationNumber || '—'}{entry.bill?.billNumber ? ` | Bill ${entry.bill.billNumber}` : ''}</span>
                    {entry.patient?.gender && <span className="ls-chip ls-chip-sex">{String(entry.patient.gender).toUpperCase()}</span>}
                  </div>
                  <div className="ls-status">Status: <StatusBadge status={entry.report?.status} /></div>
                </div>
                <span className="re-count">
                  {enterableCount > 0 ? `${enteredCount} of ${enterableCount} entered` : `${testEntries.length} tests`}
                  {printSaving ? ' · saving print options…' : ''}
                </span>
              </div>

              <section className="ls-sheet" aria-label="Lab report entry" onKeyDown={onSheetKeyDown} onFocus={onSheetFocus}>
                <div className="ls-patient-box">
                  <dl className="ls-patient">
                    <dt>Patient Name:</dt><dd>{[entry.patient?.title, entry.patient?.name].filter(Boolean).join(' ') || '—'}</dd>
                    <dt>Age / Sex:</dt><dd>{entry.patient?.age != null && entry.patient.age !== '' ? `${entry.patient.age} ${({ years: 'YRS', months: 'MONTHS', days: 'DAYS' })[entry.patient.ageUnit || 'years'] || entry.patient.ageUnit}` : '—'}{entry.patient?.gender ? ` / ${String(entry.patient.gender).charAt(0).toUpperCase()}` : ''}</dd>
                    <dt>Referred By:</dt><dd>{referrerName || 'Self'}</dd>
                    <dt>Reg. no.</dt><dd>{entry.report?.registrationNumber || '—'}</dd>
                    {entry.bill?.totalAmount != null && <><dt>Bill:</dt><dd>{formatCurrency(entry.bill.totalAmount)} {entry.bill?.paymentStatus ? <StatusBadge status={entry.bill.paymentStatus} /> : null}</dd></>}
                  </dl>
                  <div className="ls-dates">
                    <ReportTatEditor compact ref={tatRef} report={entry.report} onSaved={report => setEntry(prev => ({ ...prev, report: { ...prev.report, ...report } }))} />
                  </div>
                  {entry.bill?._id && (
                    <div className="ls-barcode">
                      <BarcodeSvg billId={entry.bill._id} billNumber={entry.bill.billNumber} height={40} />
                    </div>
                  )}
                </div>

                <label className="ls-check ls-check-top">
                  <input type="checkbox" checked={printSettings?.printCategoriesFromNewPage !== false} disabled={printSaving}
                    onChange={() => savePrintSettings({ ...printSettings, printCategoriesFromNewPage: printSettings?.printCategoriesFromNewPage === false })} />
                  Print categories from new page (PDF only)
                </label>
                {testEntries.length ? (() => {
                  // Same grouping and order as the printed report: department,
                  // then panels (by panel order), then that department's tests.
                  const departments = groupEntriesForReport(testEntries.map((test) => ({ ...test })), sectionSetting, [...(printSettings?.departmentOrder || [])]);
                  const deptNames = departments.map((d) => d.name);
                  const reorder = (label, onUp, onDown, upDisabled, downDisabled) => (
                    <span className="ls-reorder" role="group" aria-label={`Reorder ${label}`}>
                      Reorder
                      <button type="button" onClick={onUp} disabled={upDisabled || printSaving} aria-label={`Move ${label} up`}><ChevronUp size={14} /></button>
                      <button type="button" onClick={onDown} disabled={downDisabled || printSaving} aria-label={`Move ${label} down`}><ChevronDown size={14} /></button>
                    </span>
                  );
                  const check = (key, field, label, invert = false) => (
                    <label className="ls-check">
                      <input type="checkbox" checked={invert ? !sectionSetting(key)[field] : !!sectionSetting(key)[field]} disabled={printSaving} onChange={() => toggleSection(key, field)} />
                      {label}
                    </label>
                  );
                  return departments.map((dept, deptIdx) => {
                    const panelKeys = dept.groups.filter((g) => g.panel).map((g) => g.key);
                    return (
                    <div key={dept.name} className="ls-dept">
                      <div className="ls-title-row">
                        <h2 className="ls-dept-title">{dept.name.toUpperCase()}</h2>
                        {departments.length > 1 && reorder(dept.name, () => moveDepartment(deptNames, dept.name, -1), () => moveDepartment(deptNames, dept.name, 1), deptIdx === 0, deptIdx === departments.length - 1)}
                      </div>
                      {dept.groups.map((group) => (
                        <div key={group.key} className={`ls-group${group.panel && !sectionSetting(group.key).printReady ? ' is-hidden-from-print' : ''}`}>
                          {group.panel && (
                            <>
                              <div className="ls-title-row ls-title-row-panel">
                                <h3 className="ls-panel-title">{String(group.name || '').toUpperCase()}</h3>
                                {panelKeys.length > 1 && reorder(group.name, () => moveSection(panelKeys, group.key, -1), () => moveSection(panelKeys, group.key, 1), panelKeys[0] === group.key, panelKeys.at(-1) === group.key)}
                              </div>
                              <div className="ls-print-options">
                                {check(group.key, 'printReady', 'Print ready')}
                                {check(group.key, 'keepTogether', 'Keep in same page')}
                                {check(group.key, 'newPage', 'Print from new page')}
                                {check(group.key, 'pageBreakAfter', 'Page break after (PDF only)')}
                                {check(group.key, 'skipInterpretation', 'Skip interpretation')}
                              </div>
                            </>
                          )}
                          <table className="ls-table">
                            <thead>
                              <tr><th>TEST</th><th className="ls-flag" aria-label="Flag" /><th>VALUE</th><th>UNIT</th><th>REFERENCE</th></tr>
                            </thead>
                            <tbody>{group.tests.map((test, index) => (
                              <React.Fragment key={entryKey(test) || index}>
                                {!group.panel && (!index || group.tests[index - 1].sectionKey !== test.sectionKey) && (
                                  <tr className="ls-test-options"><td colSpan={5}>
                                    <div className="ls-print-options ls-print-options-test">
                                      {check(test.sectionKey, 'printReady', 'Print ready')}
                                      {check(test.sectionKey, 'pageBreakAfter', 'Page break after (PDF only)')}
                                      {check(test.sectionKey, 'skipInterpretation', 'Skip interpretation')}
                                    </div>
                                  </td></tr>
                                )}
                                {test.subheading && (!index || group.tests[index - 1].subheading !== test.subheading || group.tests[index - 1].parentName !== test.parentName) && (
                                  <tr className="ls-subheading-row"><td colSpan={5}>{test.subheading}</td></tr>
                                )}
                                {renderTestRow(test, index)}
                              </React.Fragment>
                            ))}</tbody>
                          </table>
                          {(() => {
                            const keys = group.panel ? [group.key] : [...new Set(group.tests.map((t) => t.sectionKey))];
                            return keys.map((sectionKey) => {
                              const label = group.panel ? group.name : group.tests.find((t) => t.sectionKey === sectionKey)?.testName;
                              const fields = [['notes', 'notes'], ['remarks', 'remarks'], ['advice', 'advices']];
                              return (
                                <div key={sectionKey} className="ls-nra">
                                  {!group.panel && keys.length > 1 && <span className="ls-nra-for">{label}</span>}
                                  {fields.map(([field, word]) => {
                                    const value = noteValue(sectionKey, field);
                                    const open = openNotes[`${sectionKey}|${field}`] || String(value).trim();
                                    return open ? (
                                      <label key={field} className="ls-nra-field">
                                        <span>{field === 'advice' ? 'Advice' : field[0].toUpperCase() + field.slice(1)}</span>
                                        <textarea rows={2} maxLength={2000} value={value} disabled={printSaving}
                                          onChange={(event) => setNoteDrafts((prev) => ({ ...prev, [`${sectionKey}|${field}`]: event.target.value }))}
                                          onBlur={() => saveNote(sectionKey, field)} />
                                      </label>
                                    ) : (
                                      <button key={field} type="button" className="ls-nra-add" onClick={() => setOpenNotes((prev) => ({ ...prev, [`${sectionKey}|${field}`]: true }))}>
                                        <Plus size={13} /> Add {word}{!group.panel && keys.length > 1 ? '' : ''}
                                      </button>
                                    );
                                  })}
                                </div>
                              );
                            });
                          })()}
                        </div>
                      ))}
                    </div>
                    );
                  });
                })() : <p className="re-sub">This case has no lab tests to report.</p>}
                <label className="ls-more-details">
                  <span>More details</span>
                  <textarea rows={3} maxLength={4000} value={moreDetailsDraft ?? printSettings?.moreDetails ?? ''} disabled={printSaving}
                    onChange={(event) => setMoreDetailsDraft(event.target.value)}
                    onBlur={() => { if (moreDetailsDraft !== null) { savePrintSettings({ ...printSettings, moreDetails: moreDetailsDraft }); setMoreDetailsDraft(null); } }} />
                </label>
              </section>
                <div className="re-actions re-actions-bar">
                  {!isReportFinal(entry?.report?.status) && (
                    <div className="re-save-state" aria-live="polite">
                      {dirty ? <span className="re-save-dirty">● Unsaved changes</span>
                        : savedAt ? <span className="re-save-done">✓ Saved</span> : null}
                      <span className="re-shortcuts">Enter ↵ next · Ctrl+S save · Ctrl+Enter final</span>
                    </div>
                  )}
                  <div className="re-action-buttons">
                    {entry?.bill?._id && (
                      <span className="ls-case-menu">
                        <Button variant="secondary" aria-haspopup="menu" aria-expanded={signMenuOpen} onClick={() => setSignMenuOpen((open) => !open)} title="Bill and case actions">
                          Case <ChevronDown size={14} />
                        </Button>
                        {signMenuOpen && (
                          <span className="ls-case-menu-list" role="menu" onMouseLeave={() => setSignMenuOpen(false)}>
                            <button type="button" role="menuitem" onClick={() => { setSignMenuOpen(false); navigate(`/cases/bills?search=${encodeURIComponent(entry.bill.billNumber || '')}&details=${entry.bill._id}`); }}>View bill</button>
                            {canSign && <button type="button" role="menuitem" onClick={() => { setSignMenuOpen(false); navigate(`/cases/bills/edit/${entry.bill._id}`); }}>Modify case</button>}
                          </span>
                        )}
                      </span>
                    )}
                    {canSign && entry?.report?.status !== 'Signed' && (
                      <span className="ls-signoff">
                        <Button variant="primary" icon={<CheckCircle2 size={16} />} onClick={handleSign} loading={busy === 'sign'} disabled={busy !== null || !selectedSignature}
                          title={selectedSignature ? `Sign as ${selectedSignature.name || 'selected signature'}` : 'Add a signature in Setup to sign off'}>
                          Sign off
                        </Button>
                        {signatures.length > 1 && (
                          <select className="ls-signoff-select" aria-label="Sign as" value={signatureId} disabled={busy !== null} onChange={(event) => chooseSignature(event.target.value)}>
                            {signatures.map((item) => <option key={item._id} value={item._id}>{item.name || 'Signature'}{item.title ? ` · ${item.title}` : ''}</option>)}
                          </select>
                        )}
                      </span>
                    )}
                    {!isReportFinal(entry?.report?.status) && (
                      <>
                        <Button variant="secondary" icon={<CheckCircle2 size={16} />} onClick={() => handleAction('submit')} loading={busy === 'submit'} disabled={busy !== null}>
                          Final
                        </Button>
                        <Button variant="secondary" onClick={() => handleAction('draft')} loading={busy === 'draft'} disabled={busy !== null}>
                          Save only
                        </Button>
                      </>
                    )}
                    {isReportFinal(entry?.report?.status) && (
                      <>
                        <ReportPrintActions reportId={entry.report._id} disabled={busy !== null} size="md" />
                        <Button variant="secondary" icon={<FileDown size={16} />} onClick={() => downloadReportPdf(entry.report._id)} disabled={busy !== null}>
                          PDF
                        </Button>
                        <WhatsAppShare kind="report" id={entry.report._id} phone={entry.patient?.phone} name={[entry.patient?.title, entry.patient?.name].filter(Boolean).join(' ')} size="md" label="Send on WhatsApp" />
                        {nextCase && (
                          <Button variant="secondary" onClick={() => openCase(nextCase)} disabled={busy !== null}>
                            Next case: {nextCase.bill?.patient?.name || nextCase.bill?.billNumber || 'pending'}
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                  <p className="re-sub ls-bar-note" role="status">
                    {signaturesError && canSign ? signaturesError
                      : entry?.report?.status === 'Signed' ? 'Report signed and ready to print.'
                        : isReportFinal(entry?.report?.status) ? (canSign ? 'Results final. Sign off or print the report.' : 'Results final. An admin can sign off this report.')
                          : canSign && !signatures.length ? 'Add a signature in Setup to sign off from here.' : ''}
                  </p>
                </div>
            </>
          ) : null}
        </>
      )}

      <ConfirmDialog
        isOpen={discardOpen}
        onClose={() => setDiscardOpen(false)}
        onConfirm={performBack}
        title="Discard unsaved changes?"
        message="You have unsaved result values for this case. Leaving now will discard them."
        confirmText="Discard changes"
        cancelText="Keep editing"
        confirmVariant="danger"
      />

      <Modal
        isOpen={uploadOpen}
        onClose={() => !uploadLoading && setUploadOpen(false)}
        title="Upload Outsource Report"
        footer={
          <>
            <Button variant="secondary" onClick={() => setUploadOpen(false)} disabled={uploadLoading}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleUploadSubmit} loading={uploadLoading} icon={<Upload size={16} />}>
              Upload File
            </Button>
          </>
        }
      >
        <div className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
          {uploadError ? <div className="form-error">{uploadError}</div> : null}
          {uploadTarget ? (
            <dl className="re-fields">
              <div className="re-field">
                <dt>Patient</dt>
                <dd>{uploadTarget.patient?.name || '—'}</dd>
              </div>
              <div className="re-field">
                <dt>Invoice</dt>
                <dd>
                  {uploadTarget.bill?.billNumber || '—'}
                  {uploadTarget.bill?.items?.length
                    ? ` · ${uploadTarget.bill.items.map((i) => i.name).filter(Boolean).join(', ')}`
                    : ''}
                </dd>
              </div>
            </dl>
          ) : (
            <Select
              label="Outsource invoice"
              value={uploadPickBillId}
              onChange={(e) => setUploadPickBillId(e.target.value)}
              required
              placeholder={outsourcePending.length ? 'Select pending outsource bill' : 'No pending outsource bills'}
              options={outsourcePending.map((c) => ({
                value: String(c.bill._id),
                label: `${c.bill.billNumber} · ${c.bill.patient?.name || 'Patient'}${
                  c.bill.items?.length
                    ? ` · ${c.bill.items.map((i) => i.name).filter(Boolean).slice(0, 2).join(', ')}`
                    : ''
                }`
              }))}
              disabled={!outsourcePending.length}
            />
          )}
          <p className="re-sub" style={{ margin: 0 }}>
            Upload the external lab PDF or scan/image. No numeric result entry is required for outsource.
          </p>
          <FileUploader
            onChange={(file) => { setUploadFile(file); setUploadError(null); }}
            value={uploadFile}
            label="Select PDF Report or Scan / Image file"
            accept=".pdf,.jpg,.jpeg,.png"
          />
        </div>
      </Modal>
    </div>
  );
};

export default ResultEntry;
