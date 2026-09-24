import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, ArrowLeft, CheckCircle2, RefreshCw } from 'lucide-react';
import {
  PageHeader,
  Button,
  DataTable,
  StatusBadge,
  LoadingSpinner,
  ConfirmDialog,
  TatTimeline,
  Select,
  SignaturePreview
} from '../../components/common';
import {
  getReports,
  getReportForEntry,
  signReport
} from '../../services/reportService';
import { getDoctorById } from '../../services/doctorService';
import { getSignatures } from '../../services/setupService';
import { isAdmin } from '../../utils/permissions';
import formatDate from '../../utils/formatDate';
import { formatReportTat } from '../../utils/reportTat';
import { buildCalculatedResults } from '../../utils/reportResults';
import formatCurrency from '../../utils/formatCurrency';
import useDebounce from '../../hooks/useDebounce';
import useAuth from '../../hooks/useAuth';
import '../../styles/ResultVerification.css';

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
  const { user } = useAuth();
  // Frontend affordance only — the backend's requirePermission('reports')
  // remains the authoritative check (hiding a button is not security).
  const canVerify = isAdmin(user);

  // Server state — verification queue (list of reports)
  const [reports, setReports] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
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
  const [signatures, setSignatures] = useState([]);
  const [signaturesLoading, setSignaturesLoading] = useState(true);
  const [signaturesError, setSignaturesError] = useState('');
  const [signatureReloadKey, setSignatureReloadKey] = useState(0);
  const [selectedSignatureId, setSelectedSignatureId] = useState('');

  // Action state
  const [busy, setBusy] = useState(null); // null | 'verify'
  const [feedback, setFeedback] = useState(null); // { type: 'error' | 'success', text }
  const [confirmOpen, setConfirmOpen] = useState(false);

  const inFlightRef = useRef(false); // synchronous re-entry guard
  const doctorReqRef = useRef(0); // stale referring-doctor response guard
  const signatureRequestRef = useRef(null); // reuse the initial request in StrictMode

  // Load the queue (server is the source of truth). The backend exposes no
  // status filter, so this is the report list with server pagination and
  // server-side registration-number search; pending items are identified by
  // the Status column and only `Reported` rows offer a Review action.
  useEffect(() => {
    let active = true;
    (async () => {
      setListLoading(true);
      try {
        const params = { page };
        const query = debouncedSearch.trim();
        if (query) params.registrationNumber = query;
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
  }, [page, debouncedSearch, reloadKey]);

  useEffect(() => {
    let active = true;
    const request = signatureReloadKey === 0 && signatureRequestRef.current
      ? signatureRequestRef.current
      : getSignatures();
    if (signatureReloadKey === 0) signatureRequestRef.current = request;
    request.then((response) => {
      if (!active) return;
      if (!response?.success) {
        setSignaturesError(response?.message || 'The signature service returned an unsuccessful response.');
        setSignatures([]);
        return;
      }
      const list = Array.isArray(response.data)
        ? response.data
        : (Array.isArray(response.data?.signatures) ? response.data.signatures : []);
      setSignatures(list);
      setSelectedSignatureId((current) => (
        list.some((signature) => String(signature._id) === String(current)) ? current : ''
      ));
      setSignaturesError('');
    }).catch((error) => {
      if (active) {
        setSignatures([]);
        setSignaturesError(getApiErrorMessage(error, 'Failed to load signatures.'));
      }
    }).finally(() => {
      if (active) setSignaturesLoading(false);
    });
    return () => {
      active = false;
    };
  }, [signatureReloadKey]);

  const retrySignatures = () => {
    setSignaturesLoading(true);
    setSignaturesError('');
    setSignatureReloadKey((key) => key + 1);
  };

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
    setSelectedSignatureId('');
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

  const requestVerify = () => {
    if (busy || inFlightRef.current) return;
    if (!entry?.report?._id || entry.report.status !== 'Reported') return;
    if (!canVerify) return;
    if (signaturesLoading) {
      setFeedback({ type: 'error', text: 'Signatures are still loading. Please try again.' });
      return;
    }
    if (signaturesError) {
      setFeedback({ type: 'error', text: signaturesError });
      return;
    }
    if (!selectedSignature) {
      setFeedback({ type: 'error', text: 'Select a signature before verifying this result.' });
      return;
    }
    setConfirmOpen(true);
  };

  const performVerify = async () => {
    if (busy || inFlightRef.current || !entry?.report?._id) return;
    if (entry.report.status !== 'Reported' || !canVerify || !selectedSignature) {
      setConfirmOpen(false);
      return;
    }
    inFlightRef.current = true;
    setBusy('verify');
    setFeedback(null);
    try {
      const res = await signReport(entry.report._id, selectedSignature._id);
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
      setFeedback({
        type: 'success',
        text: res?.message || 'Result verified and signed off.'
      });
      // Refetch the queue so the list reflects the server's state.
      setListLoading(true);
      setListError(null);
      setReloadKey((key) => key + 1);
    } catch (err) {
      // Status is left untouched — the server did not accept the change.
      setFeedback({
        type: 'error',
        text: getApiErrorMessage(err, 'Failed to verify this result. Please try again.')
      });
    } finally {
      setConfirmOpen(false);
      setBusy(null);
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
    setConfirmOpen(false);
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

  const handleSearchChange = (event) => {
    setSearch(event.target.value);
    setPage(1);
  };

  const renderQueueRow = (report) => {
    const pending = report.status === 'Reported';
    const reportedAt = report.tat?.reported || report.reportDate;
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
    const calculated = calculatedResults[testEntry.testId] ?? null;
    return {
      key: `test-${testEntry.testId ?? testEntry.testName}`,
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

  const isSearching = debouncedSearch.trim().length > 0;
  const status = entry?.report?.status;
  const selectedSignature = selectedSignatureId
    ? signatures.find((signature) => String(signature._id) === selectedSignatureId)
    : null;

  return (
    <div className="result-verification-page">
      <PageHeader
        title="Result Verification"
        subtitle="Review submitted lab results and verify those pending sign-off."
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
          <DataTable
            headers={[
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
                ? 'No reports match your registration number search.'
                : 'Submitted lab results will appear here for review and sign-off.'
            }
            searchValue={search}
            onSearchChange={handleSearchChange}
            searchPlaceholder="Search by registration number..."
            pagination={
              pagination ? { ...pagination, onPageChange: goToPage } : undefined
            }
            renderRow={renderQueueRow}
          />
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
                          ? entry.patient.age
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
                {status === 'Reported' && (
                  <section className="rv-signature-picker" aria-labelledby="rv-signature-heading">
                    <h3 id="rv-signature-heading" className="rv-card-title">Sign-off signature</h3>
                    {signaturesLoading ? (
                      <LoadingSpinner label="Loading signatures..." />
                    ) : signaturesError ? (
                      <div className="rv-signature-error" role="alert">
                        <span>{signaturesError}</span>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={retrySignatures}
                          disabled={signaturesLoading}
                        >
                          Retry
                        </Button>
                      </div>
                    ) : signatures.length === 0 ? (
                      <p className="rv-note">No signatures are available from the signature API.</p>
                    ) : (
                      <>
                        <Select
                          label="Select a signature"
                          name="verification-signature"
                          value={selectedSignatureId}
                          onChange={(event) => setSelectedSignatureId(event.target.value)}
                          options={signatures.map((signature) => ({
                            value: signature._id,
                            label: `${signature.name || 'Signature'}${signature.title ? ` · ${signature.title}` : ''}${signature.status ? ` · ${signature.status}` : ''}`
                          }))}
                          placeholder="Select a signature"
                          disabled={busy !== null || confirmOpen}
                        />
                        {selectedSignature && (
                          <SignaturePreview
                            url={selectedSignature.imageUrl}
                            label={selectedSignature.name || 'Selected signature'}
                            className="rv-signature-preview"
                          />
                        )}
                      </>
                    )}
                  </section>
                )}
                <div className="rv-actions">
                  {status === 'Reported' ? (
                    canVerify ? (
                      <Button
                        variant="primary"
                        icon={<CheckCircle2 size={16} />}
                        onClick={requestVerify}
                        disabled={busy !== null}
                      >
                        Verify result
                      </Button>
                    ) : (
                      <span className="rv-note">
                        You do not have permission to verify results.
                      </span>
                    )
                  ) : (
                    <span className="rv-note">
                      {status === 'Signed'
                        ? 'This result has already been verified.'
                        : 'This result is not pending verification.'}
                    </span>
                  )}
                </div>
              </section>
            </>
          ) : null}
        </>
      )}

      <ConfirmDialog
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={performVerify}
        title="Verify this laboratory result?"
        message={`You are about to sign off report ${
          entry?.report?.registrationNumber || ''
        } using ${selectedSignature?.name || 'the selected signature'}. This confirms the recorded results are correct and cannot be undone.`}
        confirmText="Verify result"
        cancelText="Cancel"
        confirmVariant="primary"
        loading={busy === 'verify'}
      />
    </div>
  );
};

export default ResultVerification;
