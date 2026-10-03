import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, ArrowLeft, CheckCircle2, RefreshCw, Upload } from 'lucide-react';
import {
  PageHeader,
  Button,
  DataTable,
  StatusBadge,
  Input,
  LoadingSpinner,
  ConfirmDialog,
  TatTimeline,
  AdvancedFilterBar,
  Modal,
  FileUploader,
  Select
} from '../../components/common';
import {
  getPendingLabCases,
  getReportForEntry,
  createResultReport,
  saveReportResultsDraft,
  submitReportResults,
  getReports,
  uploadReport
} from '../../services/reportService';
import { getDoctorById } from '../../services/doctorService';
import formatDate from '../../utils/formatDate';
import { buildCalculatedResults } from '../../utils/reportResults';
import formatCurrency from '../../utils/formatCurrency';
import useDebounce from '../../hooks/useDebounce';
import '../../styles/ResultEntry.css';

const isOutsourceBill = (bill) => (
  bill?.caseType === 'OutsourceLabCase'
  || String(bill?.department || '').toUpperCase().includes('OUTSOURCE')
);

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'Pending', label: 'Pending' },
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
    const key = testEntry.testId ?? `name:${testEntry.testName}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(testEntry);
  });
  return out;
};

/* Payload mirrors the backend row builder: non-derived tests only,
   trimmed non-empty values, unit carried from the test master. */
const entryKey = (testEntry) => testEntry?.testId ?? `name:${testEntry?.testName || ''}`;

const buildResultsPayload = (testEntries, values) =>
  (testEntries || [])
    .filter((testEntry) => !testEntry.isDerived)
    .map((testEntry) => {
      const key = entryKey(testEntry);
      return {
        ...(testEntry.testId ? { test: testEntry.testId } : {}),
        testName: testEntry.testName,
        value: String(values[key] ?? '').trim(),
        unit: testEntry.unit || testEntry.existingUnit || ''
      };
    })
    .filter((row) => row.value !== '');

const ResultEntry = () => {
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
  // Server-calculated (formula) results for billed formula tests, keyed by
  // testId — API values only, never computed in the frontend.
  const [calculated, setCalculated] = useState({});

  // Local form state — draft copy; the server stays the source of truth
  const [values, setValues] = useState({});
  const [dirty, setDirty] = useState(false);

  // Action state
  const [busy, setBusy] = useState(null); // null | 'draft' | 'submit'
  const [feedback, setFeedback] = useState(null); // { type: 'error' | 'success', text }
  const [discardOpen, setDiscardOpen] = useState(false);

  const inFlightRef = useRef(false); // synchronous re-entry guard
  const doctorReqRef = useRef(0); // stale referring-doctor response guard
  const calcReqRef = useRef(0); // stale calculated-results response guard

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

  // Optional enrichment (mirrors resolveReferrer): the /entry payload omits
  // `report.results`, so billed formula tests read their server-calculated
  // value from the existing report document endpoint. Never throws, and is
  // only queried when the case actually has formula tests — no extra request
  // for normal cases.
  const loadCalculatedResults = async (reportId, data) => {
    const testEntries = dedupeTestEntries(data?.testEntries);
    if (!testEntries.some((testEntry) => testEntry.isDerived)) return;
    const billId = data?.bill?._id;
    if (!billId) return;
    const reqId = ++calcReqRef.current;
    try {
      const res = await getReports({ billId });
      if (calcReqRef.current !== reqId) return;
      const doc = (res?.data?.reports ?? []).find((r) => r._id === reportId);
      setCalculated(buildCalculatedResults(testEntries, doc?.results));
    } catch {
      // Optional display detail only — rows keep the "calculated on save"
      // placeholder until the next save/submit response provides the value.
      if (calcReqRef.current === reqId) setCalculated({});
    }
  };

  const applyEntry = (data) => {
    const testEntries = dedupeTestEntries(data.testEntries);
    const initial = {};
    testEntries.forEach((testEntry) => {
      const key = entryKey(testEntry);
      initial[key] =
        testEntry.existingValue != null ? String(testEntry.existingValue) : '';
    });
    setEntry({ ...data, testEntries });
    setValues(initial);
    setDirty(false);
    resolveReferrer(data.patient, data.bill);
  };

  const openUploadForCase = (row) => {
    const bill = row?.bill || null;
    const patient = bill?.patient && typeof bill.patient === 'object' ? bill.patient : null;
    if (!bill?._id || !patient?._id) {
      setFeedback({ type: 'error', text: 'This case is missing patient or bill information.' });
      return;
    }
    setUploadTarget({ bill, patient });
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
      payload.append('patient', patientId);
      payload.append('bill', billId);
      payload.append('file', uploadFile);
      const res = await uploadReport(payload);
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
    // Outsource bills use PDF/image upload — not numeric result grids.
    if (isOutsourceBill(row?.bill)) {
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
    setCalculated({});
    calcReqRef.current += 1; // drop any in-flight calculated-results lookup
    setActiveRow(row);
    try {
      let reportId = row?.report?._id;
      if (!reportId) {
        const patientId = row?.bill?.patient?._id;
        const billId = row?.bill?._id;
        if (!patientId || !billId) {
          throw new Error('This case is missing patient or bill information.');
        }
        const created = await createResultReport({ patient: patientId, bill: billId });
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
      await loadCalculatedResults(reportId, res.data);
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

  const handleAction = async (mode) => {
    if (busy || inFlightRef.current || !entry?.report?._id) return;
    const payload = buildResultsPayload(entry.testEntries, values);
    if (payload.length === 0) {
      setFeedback({
        type: 'error',
        text:
          mode === 'draft'
            ? 'Enter a value for at least one test before saving.'
            : 'Enter a value for at least one test before submitting.'
      });
      return;
    }
    inFlightRef.current = true;
    setBusy(mode);
    setFeedback(null);
    try {
      const res =
        mode === 'draft'
          ? await saveReportResultsDraft(entry.report._id, payload)
          : await submitReportResults(entry.report._id, payload);
      setDirty(false);
      // The mutation response is the authoritative report state.
      const updated = res?.data;
      setEntry((prev) =>
        prev
          ? {
              ...prev,
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
      // The mutation response is authoritative for formula results too —
      // refresh the displayed calculated values without another request.
      if (updated?.results) {
        setCalculated(
          buildCalculatedResults(entry.testEntries, updated.results)
        );
      }
      setFeedback({
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
    } catch (err) {
      // Entered values are untouched — the user can correct and retry.
      setFeedback({
        type: 'error',
        text:
          mode === 'draft'
            ? getApiErrorMessage(err, 'Failed to save draft. Please try again.')
            : getApiErrorMessage(err, 'Failed to submit results. Please try again.')
      });
    } finally {
      setBusy(null);
      inFlightRef.current = false;
    }
  };

  const performBack = () => {
    setDiscardOpen(false);
    doctorReqRef.current += 1; // drop any in-flight referrer lookup
    calcReqRef.current += 1; // drop any in-flight calculated-results lookup
    setView('list');
    setEntry(null);
    setActiveRow(null);
    setValues({});
    setCalculated({});
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
  const isReportFinal = (status) =>
    ['Reported', 'Signed', 'Verified', 'Completed'].includes(status);
  const renderCaseRow = (row) => {
    const patient = row?.bill?.patient;
    const demographics = [patient?.age, patient?.gender]
      .filter((value) => value != null && value !== '')
      .join(' / ');
    const final = isReportFinal(row?.report?.status);
    const outsource = isOutsourceBill(row?.bill);
    return (
      <tr key={row?.bill?._id}>
        <td>
          {row?.bill?.billNumber || '—'}
          {outsource ? <div className="re-sub">Outsource</div> : null}
        </td>
        <td>
          <div className="re-patient-name">{patient?.name || '—'}</div>
          {patient?.registrationNumber ? (
            <div className="re-sub">{patient.registrationNumber}</div>
          ) : null}
        </td>
        <td>{demographics || '—'}</td>
        <td>
          <StatusBadge status={row?.report?.status} />
        </td>
        <td>
          {final ? (
            <span className="re-sub">Submitted — no action</span>
          ) : outsource ? (
            <Button size="sm" variant="primary" icon={<Upload size={14} />} onClick={() => openUploadForCase(row)}>
              Upload Report
            </Button>
          ) : (
            <Button size="sm" variant="secondary" onClick={() => openCase(row)}>
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
    // Billed formula test: show the server-calculated value (read-only).
    const calcRow = isDerived ? calculated[testEntry.testId] || calculated[key] : null;
    const subLine = [testEntry.testCode, testEntry.packageName, testEntry.panelName]
      .filter(Boolean)
      .join(' · ');
    return (
      <tr key={key || index}>
        <td>
          <div className="re-test-name">{testEntry.testName || 'Test'}</div>
          {subLine ? <div className="re-sub">{subLine}</div> : null}
        </td>
        <td className="re-range">{formatReferenceRange(testEntry)}</td>
        <td className="re-unit">
          {testEntry.unit || testEntry.existingUnit || calcRow?.unit || '—'}
        </td>
        <td className="re-result-cell">
          <Input
            id={`result-${key}`}
            name={`result-${key}`}
            type="text"
            aria-label={`Result value for ${testEntry.testName || 'test'}`}
            placeholder="Enter value"
            value={
              isDerived
                ? calcRow?.value || values[key] || ''
                : values[key] ?? ''
            }
            onChange={(event) => handleValueChange(key, event.target.value)}
            disabled={isDerived || busy !== null || isReportFinal(entry?.report?.status)}
            helperText={
              isDerived
                ? calcRow
                  ? 'Calculated automatically from entered results.'
                  : 'Calculated automatically on save.'
                : undefined
            }
            autoComplete="off"
          />
        </td>
      </tr>
    );
  };

  const testEntries = entry?.testEntries ?? [];
  const enterableCount = testEntries.filter((testEntry) => !testEntry.isDerived).length;
  const enteredCount = testEntries.filter(
    (testEntry) =>
      !testEntry.isDerived && String(values[entryKey(testEntry)] ?? '').trim() !== ''
  ).length;

  const outsourcePending = cases.filter((c) => isOutsourceBill(c?.bill) && !isReportFinal(c?.report?.status));

  return (
    <div className="result-entry-page">
      <PageHeader
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
      />

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
              headers={['Invoice No', 'Patient', 'Age / Gender', 'Report Status', 'Action']}
              data={cases}
              loading={listLoading}
              emptyTitle={debouncedSearch || statusFilter ? 'No matching cases' : 'No pending cases'}
              emptyMessage={
                debouncedSearch || statusFilter
                  ? 'No lab cases match your current filters.'
                  : 'There are no lab cases waiting for result entry right now.'
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
            {entry ? (
              <div className="re-topbar-meta">
                <span className="re-reg">{entry.report?.registrationNumber || '—'}</span>
                <StatusBadge status={entry.report?.status} />
              </div>
            ) : null}
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
              <div className="re-info-grid">
                <section className="re-card" aria-labelledby="re-patient-heading">
                  <h2 id="re-patient-heading" className="re-card-title">
                    Patient
                  </h2>
                  <dl className="re-fields">
                    <div className="re-field">
                      <dt>Name</dt>
                      <dd>{entry.patient?.name || '—'}</dd>
                    </div>
                    <div className="re-field">
                      <dt>Patient ID</dt>
                      <dd>{entry.patient?.registrationNumber || '—'}</dd>
                    </div>
                    <div className="re-field">
                      <dt>Age</dt>
                      <dd>
                        {entry.patient?.age != null && entry.patient.age !== ''
                          ? entry.patient.age
                          : '—'}
                      </dd>
                    </div>
                    <div className="re-field">
                      <dt>Gender</dt>
                      <dd>{entry.patient?.gender || '—'}</dd>
                    </div>
                    <div className="re-field">
                      <dt>Phone</dt>
                      <dd>{entry.patient?.phone || '—'}</dd>
                    </div>
                  </dl>
                </section>

                <section className="re-card" aria-labelledby="re-case-heading">
                  <h2 id="re-case-heading" className="re-card-title">
                    Case
                  </h2>
                  <dl className="re-fields">
                    <div className="re-field">
                      <dt>Report No</dt>
                      <dd>{entry.report?.registrationNumber || '—'}</dd>
                    </div>
                    <div className="re-field">
                      <dt>Registered</dt>
                      <dd>
                        {entry.report?.tat?.registered
                          ? formatDate(entry.report.tat.registered)
                          : '—'}
                      </dd>
                    </div>
                    <div className="re-field">
                      <dt>Referring Doctor</dt>
                      <dd>{referrerName || '—'}</dd>
                    </div>
                    <div className="re-field">
                      <dt>Invoice No</dt>
                      <dd>{entry.bill?.billNumber || '—'}</dd>
                    </div>
                    <div className="re-field">
                      <dt>Invoice Date</dt>
                      <dd>{entry.bill?.date ? formatDate(entry.bill.date) : '—'}</dd>
                    </div>
                    <div className="re-field">
                      <dt>Amount</dt>
                      <dd>
                        {entry.bill?.totalAmount != null
                          ? formatCurrency(entry.bill.totalAmount)
                          : '—'}
                      </dd>
                    </div>
                    <div className="re-field">
                      <dt>Payment</dt>
                      <dd>
                        {entry.bill?.paymentStatus ? (
                          <StatusBadge status={entry.bill.paymentStatus} />
                        ) : (
                          '—'
                        )}
                      </dd>
                    </div>
                  </dl>
                </section>

                {/* Backend status + tat timeline (display-only). */}
                <TatTimeline report={entry.report} />
              </div>

              <section className="re-card" aria-labelledby="re-results-heading">
                <div className="re-section-head">
                  <h2 id="re-results-heading" className="re-card-title">
                    Test Results
                  </h2>
                  <span className="re-count">
                    {enterableCount > 0
                      ? `${enteredCount} of ${enterableCount} entered`
                      : `${testEntries.length} tests`}
                  </span>
                </div>
                <DataTable
                  headers={['Test', 'Reference Range', 'Unit', 'Result']}
                  data={testEntries}
                  emptyTitle="No tests to enter"
                  emptyMessage="This case has no lab tests to report."
                  renderRow={renderTestRow}
                />
                {isReportFinal(entry?.report?.status) ? (
                  <p className="re-sub" role="status">Results already submitted — no further action. Go back to pick another case.</p>
                ) : (
                <div className="re-actions">
                  <Button
                    variant="secondary"
                    onClick={() => handleAction('draft')}
                    loading={busy === 'draft'}
                    disabled={busy !== null}
                  >
                    Save Draft
                  </Button>
                  <Button
                    variant="primary"
                    onClick={() => handleAction('submit')}
                    loading={busy === 'submit'}
                    disabled={busy !== null}
                  >
                    Submit Result
                  </Button>
                </div>
                )}
              </section>
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
