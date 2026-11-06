import './labV2.css';
import React, { useEffect, useRef, useState } from 'react';
import useStickyState from '../../utils/useStickyState';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, CheckCircle2, RefreshCw } from 'lucide-react';
import {
  PageHeader,
  Button,
  DataTable,
  StatusBadge,
  LoadingSpinner,
  TatTimeline,
  AdvancedFilterBar,
  DURATION_OPTIONS
} from '../../components/common';
import {
  getReports,
  getReportForEntry
} from '../../services/reportService';
import { getDoctorById } from '../../services/doctorService';
import { isAdmin } from '../../utils/permissions';
import formatDate from '../../utils/formatDate';
import { formatReportTat } from '../../utils/reportTat';
import { buildCalculatedResults } from '../../utils/reportResults';
import formatCurrency from '../../utils/formatCurrency';
import useDebounce from '../../hooks/useDebounce';
import useAuth from '../../hooks/useAuth';
import '../../styles/ResultVerification.css';
import IdentityCell from '../../components/common/IdentityCell/IdentityCell';
import { useUiVersion } from '../../utils/uiVersion';

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

/* Flag codes are the backend's own enum (Report model: L/H/C/N); the labels
   below only expand those codes for screen readers — no interpretation. */
const FLAG_LABELS = { N: 'Normal', L: 'Low', H: 'High', C: 'Critical' };

const renderFlag = (flag) => {
  if (!flag) {
    return (
      <span className="rv-flag rv-flag-none" aria-label="No flag">
        —
      </span>
    );
  }
  const modifier = flag === 'N' ? 'rv-flag-normal' : 'rv-flag-abnormal';
  const label = FLAG_LABELS[flag] || flag;
  return (
    <span className={`rv-flag ${modifier}`} aria-label={`Flag: ${label}`}>
      {flag}
    </span>
  );
};

const ResultVerification = () => {
  const isV2 = useUiVersion() === 'v2';
  const { user } = useAuth();
  const navigate = useNavigate();
  // Frontend affordance only — the backend's requirePermission('reports')
  // remains the authoritative check (hiding a button is not security).
  const canVerify = isAdmin(user);

  // Server state — verification queue (list of reports)
  const [reports, setReports] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useStickyState('page', 1);
  const [search, setSearch] = useStickyState('search', '');
  const [statusFilter, setStatusFilter] = useStickyState('status', 'Reported');
  const [duration, setDuration] = useStickyState('duration', '');
  const [from, setFrom] = useStickyState('from', '');
  const [to, setTo] = useStickyState('to', '');
  const debouncedSearch = useDebounce(search, 500);
  const [reloadKey, setReloadKey] = useState(0);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState(null);

  // Server state — opened result for review
  const [view, setView] = useState('list'); // 'list' | 'review'
  const [activeRow, setActiveRow] = useState(null);
  const [entry, setEntry] = useState(null);
  const [entryLoading, setEntryLoading] = useState(false);
  const [entryError, setEntryError] = useState(null);
  const [referrerName, setReferrerName] = useState('');

  // Action state
  const [busy, setBusy] = useState(null); // null | 'verify'
  const [feedback, setFeedback] = useState(null); // { type: 'error' | 'success', text }

  const inFlightRef = useRef(false); // synchronous re-entry guard
  const doctorReqRef = useRef(0); // stale referring-doctor response guard

  // Load the queue (server is the source of truth) with advanced filters.
  // Only `Reported` rows offer a Review action.
  useEffect(() => {
    let active = true;
    (async () => {
      setListLoading(true);
      try {
        const params = { page };
        const query = debouncedSearch.trim();
        if (query) params.search = query;
        if (statusFilter) params.status = statusFilter;
        if (duration) params.duration = duration;
        if (from) params.from = from;
        if (to) params.to = to;
        const res = await getReports(params);
        if (!active) return;
        const data = res?.data ?? {};
        const targetPage = Math.max(1, Math.min(page, data.pagination?.pages || 1));
        if (targetPage !== page) {
          // The page we asked for no longer exists — keep the spinner and
          // let the effect rerun against the page that does.
          setPage(targetPage);
          return;
        }
        setReports(data.reports ?? []);
        setPagination(data.pagination ?? null);
        setListError(null);
        setListLoading(false);
      } catch (err) {
        if (!active) return;
        setReports([]);
        setPagination(null);
        setListError(getApiErrorMessage(err, 'Failed to load the verification queue.'));
        setListLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [page, debouncedSearch, statusFilter, duration, from, to, reloadKey]);

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

  const openReview = async (row) => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setView('review');
    setEntryLoading(true);
    setEntry(null);
    setEntryError(null);
    setFeedback(null);
    setReferrerName('');
    setActiveRow(row);
    try {
      const res = await getReportForEntry(row._id);
      const data = res?.data;
      if (!data?.report?._id) {
        throw new Error('This result could not be loaded for review.');
      }
      setEntry(data);
      resolveReferrer(data.patient, data.bill);
    } catch (err) {
      setEntryError(getApiErrorMessage(err, 'Failed to load this result for review.'));
    } finally {
      setEntryLoading(false);
      inFlightRef.current = false;
    }
  };

  const performBack = () => {
    doctorReqRef.current += 1; // drop any in-flight referrer lookup
    setView('list');
    setEntry(null);
    setActiveRow(null);
    setReferrerName('');
    setFeedback(null);
    setEntryError(null);
    setBusy(null);
    // Refetch — this row's status may have changed while the review was open.
    setListLoading(true);
    setListError(null);
    setReloadKey((key) => key + 1);
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

  const handleFilterChange = (key, value) => {
    if (key === 'search') setSearch(value);
    else if (key === 'status') setStatusFilter(value);
    else if (key === 'duration') { setDuration(value); setFrom(''); setTo(''); }
    else if (key === 'from') { setFrom(value); setDuration(''); }
    else if (key === 'to') { setTo(value); setDuration(''); }
    setPage(1);
    setListLoading(true);
  };

  const renderQueueRow = (report) => {
    const pending = report.status === 'Reported';
    const reportedAt = report.tat?.reported || report.reportDate;
    if (isV2) {
      // Clinical screen: age · sex beside the name; the row opens the review.
      const patient = report.patient || {};
      return (
        <tr key={report._id} className={pending ? 'rv-row-clickable' : undefined} onClick={pending ? (event) => { if (!event.target.closest('button, a')) openReview(report); } : undefined}>
          <td>
            <IdentityCell
              name={[patient.title, patient.name].filter(Boolean).join(' ') || 'Walk-in patient'}
              clinical={{ age: patient.age, ageUnit: patient.ageUnit, gender: patient.gender }}
              meta={[`Reg ${report.registrationNumber || '—'}`, report.bill?.billNumber && `Bill ${report.bill.billNumber}`]}
            />
          </td>
          <td className="rv-muted" style={{ whiteSpace: 'nowrap' }}>{reportedAt ? formatDate(reportedAt) : <span className="cell-empty">Not reported</span>}</td>
          <td style={{ whiteSpace: 'nowrap' }}>{pending ? `Waiting ${formatReportTat(report)}` : formatReportTat(report)}</td>
          <td><StatusBadge status={report.status} /></td>
          <td>
            <div className="row-actions-v2">
              {pending ? <Button size="sm" variant="primary" onClick={() => openReview(report)}>Review</Button> : <span className="cell-empty">Done</span>}
            </div>
          </td>
        </tr>
      );
    }
    return (
      <tr key={report._id}>
        <td className="rv-reg">{report.registrationNumber || '—'}</td>
        <td>
          <div className="rv-patient-name">{report.patient?.name || '—'}</div>
          {report.patient?.registrationNumber ? (
            <div className="rv-sub">{report.patient.registrationNumber}</div>
          ) : null}
        </td>
        <td>{report.bill?.billNumber || '—'}</td>
        <td className="rv-muted">{reportedAt ? formatDate(reportedAt) : '—'}</td>
        <td>
          <StatusBadge status={report.status} />
        </td>
        {/* Registered → reported (or registered → now while open) — display-only. */}
        <td className="rv-muted">{formatReportTat(report)}</td>
        <td>
          {pending ? (
            <Button size="sm" variant="secondary" onClick={() => openReview(report)}>
              Review
            </Button>
          ) : (
            <span className="rv-muted" aria-label="No action available">
              —
            </span>
          )}
        </td>
      </tr>
    );
  };

  const renderResultRow = (row) => (
    <tr key={row.key}>
      <td>
        <div className="rv-test-name">{row.name}</div>
        {row.sub ? <div className="rv-sub">{row.sub}</div> : null}
      </td>
      <td className="rv-range">{row.referenceRange}</td>
      <td className="rv-unit">{row.unit || '—'}</td>
      <td className="rv-value">{row.value || '—'}</td>
      <td>{renderFlag(row.flag)}</td>
    </tr>
  );

  // Result rows: billed tests from the fresh /entry payload (values, units,
  // flags and Phase 2 reference ranges), plus formula-derived rows that only
  // exist on the report's `results` array (test: null, derived: true).
  const billEntries = dedupeTestEntries(entry?.testEntries ?? []);
  // Billed formula tests carry no existingValue (their server-calculated row
  // is stored with test: null) — pull value/unit/flag from that API row.
  const calculatedResults = buildCalculatedResults(billEntries, activeRow?.results);
  const billRows = billEntries.map((testEntry) => {
    const calculated = calculatedResults[testEntry.resultKey || testEntry.testId] ?? null;
    return {
      key: `test-${testEntry.resultKey || testEntry.testId || testEntry.testName}`,
      name: testEntry.testName || '—',
      sub: [
        testEntry.testCode,
        testEntry.packageName,
        testEntry.panelName,
        testEntry.isDerived ? 'Derived' : ''
      ]
        .filter(Boolean)
        .join(' · '),
      referenceRange: formatReferenceRange(testEntry),
      unit: testEntry.unit || testEntry.existingUnit || calculated?.unit || '',
      value: testEntry.existingValue || calculated?.value || '',
      flag: testEntry.existingFlag || calculated?.flag || ''
    };
  });
  const billNames = new Set(billRows.map((row) => row.name));
  const derivedRows = (activeRow?.results ?? [])
    .filter((result) => result.derived === true && !billNames.has(result.testName))
    .map((result) => ({
      key: `derived-${result.testName}`,
      name: result.testName || '—',
      sub: 'Derived',
      referenceRange: '—',
      unit: result.unit || '',
      value: result.value ?? '',
      flag: result.flag || ''
    }));
  const resultRows = [...billRows, ...derivedRows];
  const resultCountLabel = `${resultRows.length} ${
    resultRows.length === 1 ? 'test' : 'tests'
  }`;

  const isSearching = Boolean(
    debouncedSearch.trim() || statusFilter || duration || from || to
  );
  const status = entry?.report?.status;

  return (
    <div className="result-verification-page">
      <PageHeader
        title="Result Verification"
        subtitle={isV2 ? 'Results waiting for a doctor to check and sign. Open one to review it.' : 'Review submitted lab results and verify those pending sign-off.'}
        action={
          view === 'list' ? (
            <Button
              variant="secondary"
              size="sm"
              icon={<RefreshCw size={16} />}
              onClick={refreshList}
              disabled={listLoading}
            >
              Refresh
            </Button>
          ) : null
        }
      />

      {view === 'list' ? (
        listError ? (
          <div className="rv-banner rv-banner-error" role="alert">
            <AlertTriangle size={16} aria-hidden="true" />
            <span>{listError}</span>
            <Button variant="secondary" size="sm" onClick={refreshList}>
              Retry
            </Button>
          </div>
        ) : (
          <>
            <AdvancedFilterBar
              values={{ search, status: statusFilter, duration, from, to }}
              onChange={handleFilterChange}
              onSearch={() => {
                setPage(1);
                setListLoading(true);
                setReloadKey((k) => k + 1);
              }}
              onClear={() => {
                setSearch('');
                setStatusFilter('Reported');
                setDuration('');
                setFrom('');
                setTo('');
                setPage(1);
                setListLoading(true);
                setReloadKey((k) => k + 1);
              }}
              fields={[
                {
                  key: 'search',
                  label: 'Search',
                  type: 'text',
                  placeholder: 'Reg. no, patient name, UHID…',
                  size: 'lg'
                },
                {
                  key: 'status',
                  label: 'Status',
                  type: 'select',
                  options: [
                    { value: '', label: 'All statuses' },
                    { value: 'Reported', label: 'Reported' },
                    { value: 'Verified', label: 'Verified' },
                    { value: 'Signed', label: 'Signed' },
                    { value: 'Completed', label: 'Completed' },
                    { value: 'Draft', label: 'Draft' },
                    { value: 'Registered', label: 'Registered' }
                  ],
                  placeholder: 'All statuses'
                },
                {
                  key: 'duration',
                  label: 'Duration',
                  type: 'select',
                  options: DURATION_OPTIONS,
                  placeholder: 'All time'
                },
                { key: 'from', label: 'From', type: 'date' },
                { key: 'to', label: 'To', type: 'date' }
              ]}
            />
            <DataTable
              headers={isV2 ? ['Patient', 'Reported', 'Turnaround', 'Status', ''] : [
                'Registration No',
                'Patient',
                'Invoice',
                'Reported On',
                'Status',
                'TAT',
                'Action'
              ]}
              data={reports}
              loading={listLoading}
              emptyTitle={
                isSearching ? 'No matching results' : 'No results pending verification.'
              }
              emptyMessage={
                isSearching
                  ? 'No reports match your current filters.'
                  : 'Submitted lab results will appear here for review and sign-off.'
              }
              pagination={
                pagination ? { ...pagination, onPageChange: goToPage } : undefined
              }
              renderRow={renderQueueRow}
            />
          </>
        )
      ) : (
        <>
          <div className="rv-topbar">
            <Button
              variant="secondary"
              size="sm"
              icon={<ArrowLeft size={16} />}
              onClick={performBack}
              disabled={busy !== null}
            >
              Back to queue
            </Button>
            {entry ? (
              <div className="rv-topbar-meta">
                <span className="rv-reg">{entry.report?.registrationNumber || '—'}</span>
                <StatusBadge status={status} />
              </div>
            ) : null}
          </div>

          {feedback ? (
            <div
              className={`rv-banner ${
                feedback.type === 'error' ? 'rv-banner-error' : 'rv-banner-success'
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
            <div className="rv-state-block">
              <LoadingSpinner label="Loading result..." />
            </div>
          ) : entryError ? (
            <div className="rv-banner rv-banner-error" role="alert">
              <AlertTriangle size={16} aria-hidden="true" />
              <span>{entryError}</span>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => activeRow && openReview(activeRow)}
              >
                Retry
              </Button>
            </div>
          ) : entry ? (
            <>
              <div className="rv-info-grid">
                <section className="rv-card" aria-labelledby="rv-patient-heading">
                  <h2 id="rv-patient-heading" className="rv-card-title">
                    Patient
                  </h2>
                  <dl className="rv-fields">
                    <div className="rv-field">
                      <dt>Name</dt>
                      <dd>{entry.patient?.name || '—'}</dd>
                    </div>
                    <div className="rv-field">
                      <dt>Patient ID</dt>
                      <dd>{entry.patient?.registrationNumber || '—'}</dd>
                    </div>
                    <div className="rv-field">
                      <dt>Age</dt>
                      <dd>
                        {entry.patient?.age != null && entry.patient.age !== ''
                          ? `${entry.patient.age} ${entry.patient.ageUnit || 'years'}`
                          : '—'}
                      </dd>
                    </div>
                    <div className="rv-field">
                      <dt>Gender</dt>
                      <dd>{entry.patient?.gender || '—'}</dd>
                    </div>
                    <div className="rv-field">
                      <dt>Phone</dt>
                      <dd>{entry.patient?.phone || '—'}</dd>
                    </div>
                  </dl>
                </section>

                <section className="rv-card" aria-labelledby="rv-case-heading">
                  <h2 id="rv-case-heading" className="rv-card-title">
                    Case
                  </h2>
                  <dl className="rv-fields">
                    <div className="rv-field">
                      <dt>Report No</dt>
                      <dd>{entry.report?.registrationNumber || '—'}</dd>
                    </div>
                    <div className="rv-field">
                      <dt>Registered</dt>
                      <dd>
                        {entry.report?.tat?.registered
                          ? formatDate(entry.report.tat.registered)
                          : '—'}
                      </dd>
                    </div>
                    <div className="rv-field">
                      <dt>Reported</dt>
                      <dd>
                        {entry.report?.tat?.reported
                          ? formatDate(entry.report.tat.reported)
                          : '—'}
                      </dd>
                    </div>
                    <div className="rv-field">
                      <dt>Referring Doctor</dt>
                      <dd>{referrerName || '—'}</dd>
                    </div>
                    <div className="rv-field">
                      <dt>Invoice No</dt>
                      <dd>{entry.bill?.billNumber || '—'}</dd>
                    </div>
                    <div className="rv-field">
                      <dt>Invoice Date</dt>
                      <dd>{entry.bill?.date ? formatDate(entry.bill.date) : '—'}</dd>
                    </div>
                    <div className="rv-field">
                      <dt>Amount</dt>
                      <dd>
                        {entry.bill?.totalAmount != null
                          ? formatCurrency(entry.bill.totalAmount)
                          : '—'}
                      </dd>
                    </div>
                    <div className="rv-field">
                      <dt>Payment</dt>
                      <dd>
                        {entry.bill?.paymentStatus ? (
                          <StatusBadge status={entry.bill.paymentStatus} />
                        ) : (
                          '—'
                        )}
                      </dd>
                    </div>
                    <div className="rv-field">
                      <dt>Entered By</dt>
                      <dd>{activeRow?.uploadedBy?.name || '—'}</dd>
                    </div>
                  </dl>
                </section>

                {/* Backend status + tat timeline (display-only). */}
                <TatTimeline report={entry.report} />
              </div>

              <section className="rv-card" aria-labelledby="rv-results-heading">
                <div className="rv-section-head">
                  <h2 id="rv-results-heading" className="rv-card-title">
                    Test Results
                  </h2>
                  <span className="rv-count">{resultCountLabel}</span>
                </div>
                <DataTable
                  headers={['Test', 'Reference Range', 'Unit', 'Result', 'Flag']}
                  data={resultRows}
                  emptyTitle="No results recorded"
                  emptyMessage="This result has no recorded test values."
                  renderRow={renderResultRow}
                />
                <div className="rv-actions">
                  {status === 'Reported' ? (
                    canVerify ? (
                      // One place to sign: Result Entry shows the full report,
                      // the signature choice and Print right after sign-off.
                      <Button variant="primary" icon={<CheckCircle2 size={16} />} onClick={() => navigate(`/lab/result-entry?report=${entry.report._id}`)}>
                        Sign off in Result Entry
                      </Button>
                    ) : (
                      <span className="rv-note">
                        You do not have permission to sign off results.
                      </span>
                    )
                  ) : (
                    <span className="rv-note">
                      {status === 'Signed'
                        ? 'This result has already been signed off.'
                        : 'This result is not pending sign-off.'}
                    </span>
                  )}
                </div>
              </section>
            </>
          ) : null}
        </>
      )}

    </div>
  );
};

export default ResultVerification;
