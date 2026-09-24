import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Download, FileDown, Printer, RefreshCw } from 'lucide-react';
import {
  PageHeader,
  Button,
  DataTable,
  StatusBadge,
  LoadingSpinner,
  TatTimeline,
  Letterhead
} from '../../components/common';
import { getReports, getReportForEntry } from '../../services/reportService';
import { getDoctorById } from '../../services/doctorService';
import { getUsers } from '../../services/authService';
import { getLabProfile, getSignatures } from '../../services/setupService';
import { downloadReportPdf, fetchBarcodeSvgUrl, fetchReportQr } from '../../services/publicService';
import useAuth from '../../hooks/useAuth';
import assetSrc from '../../utils/assetSrc';
import downloadFile from '../../utils/downloadFile';
import formatDate from '../../utils/formatDate';
import {
  buildCalculatedResults,
  dedupeTestEntries,
  formatReferenceRange
} from '../../utils/reportResults';
import '../../styles/ReportPreview.css';

/* Local API error mapper (same mapping as Result Entry / Result Verification):
   surfaces only the backend's user-facing `message` field (never
   `errors.stack`), with sensible fallbacks per failure type. */
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

/* Flag codes are the backend's own enum (Report model: L/H/C/N); the labels
   below only expand those codes for screen readers — no interpretation. */
const FLAG_LABELS = { N: 'Normal', L: 'Low', H: 'High', C: 'Critical' };

const renderFlag = (flag) => {
  if (!flag) {
    return (
      <span className="rp-flag rp-flag-none" aria-label="No flag">
        —
      </span>
    );
  }
  const modifier = flag === 'N' ? 'rp-flag-normal' : 'rp-flag-abnormal';
  const label = FLAG_LABELS[flag] || flag;
  return (
    <span className={`rp-flag ${modifier}`} aria-label={`Flag: ${label}`}>
      {flag}
    </span>
  );
};

/* Read-only preview of an existing report: everything on this screen comes
   from the existing report APIs (GET /reports/:id/entry for patient/case/
   billed test entries, GET /reports for the report document). No values,
   ranges, flags or statuses are computed or invented here — empty fields
   render as '—', exactly like the other lab screens. */
const ReportPreview = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { hasRole } = useAuth();

  // Server state — /entry payload plus the full report document.
  const [entry, setEntry] = useState(null);
  const [reportDoc, setReportDoc] = useState(null);
  const [referrerName, setReferrerName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  // PDF download state — server-rendered PDF (GET /reports/:id/pdf).
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState(null);

  // Lab profile (letterhead) state — fetched separately so a profile failure
  // never affects loading/error handling of the report itself.
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState(null);
  const [profileReloadKey, setProfileReloadKey] = useState(0);

  // Signature display state — signature masters (image/name/designation) for
  // the signature ids recorded on the report (null = still loading), plus the
  // signatory's user name resolved from the report's raw `signedBy` id.
  const [sigMasters, setSigMasters] = useState(null);
  const [signatoryUserName, setSignatoryUserName] = useState('');
  const [sigImgBrokenSrc, setSigImgBrokenSrc] = useState('');

  // Verification QR — the existing GET /reports/:id/qr payload only
  // (server-rendered `qrDataUrl` encoding the API's own `verifyUrl`).
  // Fetched per report so a previous report's QR is never displayed.
  const [reportQr, setReportQr] = useState(null);

  // Invoice barcode — the existing GET /bills/:id/barcode.svg (server-rendered
  // Code39 of the bill's own billNumber). State keeps the billId it was
  // fetched for so a previous record's barcode never renders on a new one.
  const [billBarcode, setBillBarcode] = useState(null);

  const doctorReqRef = useRef(0); // stale referring-doctor response guard

  useEffect(() => {
    let active = true;

    (async () => {
      setLoading(true);
      setError(null);
      setEntry(null);
      setReportDoc(null);
      setReferrerName('');
      setSignatoryUserName(''); // never carry a previous report's signatory
      const doctorReqId = ++doctorReqRef.current; // drop any in-flight referrer lookup
      try {
        // The backend enforces authentication and the 'reports' permission on
        // this endpoint — preview renders exactly what it returns (or its
        // error), so authorization behavior is unchanged.
        const res = await getReportForEntry(id);
        if (!active) return;
        const data = res?.data;
        if (!data?.report?._id) {
          throw new Error('This report could not be loaded for preview.');
        }

        // /entry omits the report document itself (saved results incl.
        // formula rows, reportDate, uploadedBy, signatures) — fetch it via
        // the existing report list endpoint, the same way Result Entry loads
        // server-calculated results. Missing rows simply render as '—'.
        let doc = null;
        const billId = data.bill?._id;
        const registrationNumber = data.report.registrationNumber;
        if (billId || registrationNumber) {
          const params = billId
            ? { billId, limit: 100 }
            : { registrationNumber, limit: 100 };
          const listRes = await getReports(params);
          if (!active) return;
          doc = (listRes?.data?.reports ?? []).find((r) => r._id === id) || null;
        }

        setEntry(data);
        setReportDoc(doc);

        // Optional enrichment — the referring doctor's display name.
        const docRef = data.patient?.referringDoctor || data.bill?.referringDoctor;
        if (docRef && typeof docRef === 'object') {
          setReferrerName(docRef.name || '');
        } else if (docRef) {
          getDoctorById(docRef)
            .then((r) => {
              if (doctorReqRef.current === doctorReqId) setReferrerName(r?.data?.name || '');
            })
            .catch(() => {
              // Optional display detail only — the field falls back to '—'.
              if (doctorReqRef.current === doctorReqId) setReferrerName('');
            });
        }
      } catch (err) {
        if (!active) return;
        setEntry(null);
        setReportDoc(null);
        setError(getApiErrorMessage(err, 'Failed to load this report for preview.'));
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [id, reloadKey]);

  // Lab profile for the letterhead (GET /setup/lab-profile) — independent of
  // the report load. Only API-provided fields are ever rendered; on failure
  // the report stays fully usable and a banner offers a retry.
  useEffect(() => {
    let active = true;

    (async () => {
      setProfileLoading(true);
      setProfileError(null);
      try {
        const res = await getLabProfile();
        if (!active) return;
        setProfile(res?.data?.profile || res?.data || null);
      } catch (err) {
        if (!active) return;
        setProfile(null);
        setProfileError(
          getApiErrorMessage(err, 'Failed to load the lab letterhead.')
        );
      } finally {
        if (active) setProfileLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [profileReloadKey]);

  // Signature masters (image / signatory name / designation) — existing
  // GET /setup/signatures, only for reports that actually carry signatures.
  // A failed load settles as [] so the sign-off simply omits image/designation
  // (text sign-off data still comes from the report itself).
  useEffect(() => {
    let active = true;
    (async () => {
      setSigMasters((reportDoc?.signatures ?? []).length ? null : []);
      if (!(reportDoc?.signatures ?? []).length) return;
      try {
        const res = await getSignatures();
        if (!active) return;
        setSigMasters(res?.data?.signatures || res?.data || []);
      } catch {
        if (active) setSigMasters([]);
      }
    })();
    return () => {
      active = false;
    };
  }, [reportDoc]);

  // Signatory user name: report signatures store `signedBy` as a raw id (no
  // populate), resolved through the existing GET /users endpoint — which is
  // Admin-only, so other roles never call it (the name simply stays '—',
  // matching the app's missing-field behavior). Same async-fill pattern as
  // the referring-doctor name above; stale values are cleared on report load.
  const canResolveUsers = hasRole(['Admin']);
  useEffect(() => {
    if (!reportDoc || !canResolveUsers) return undefined;
    const sigs = reportDoc.signatures ?? [];
    const last = sigs.length ? sigs[sigs.length - 1] : null;
    const signedBy = last?.signedBy;
    const sid =
      typeof signedBy === 'object' ? signedBy?._id || '' : signedBy || '';
    if (!sid) return undefined;
    let active = true;
    (async () => {
      try {
        const res = await getUsers();
        if (!active) return;
        const users = Array.isArray(res?.data) ? res.data : [];
        const match = users.find((u) => String(u._id) === String(sid));
        setSignatoryUserName(match?.name || '');
      } catch {
        // 403 for non-Admins or lookup failure -> name stays unavailable.
        if (active) setSignatoryUserName('');
      }
    })();
    return () => {
      active = false;
    };
  }, [reportDoc, canResolveUsers]);

  // Verification QR for this report (GET /reports/:id/qr) — same stale-response
  // guard pattern as the report load above. The block renders only when the
  // API returns a valid image data URL; missing/failed/invalid payloads simply
  // leave the QR hidden (no fallback or invented content, nothing is logged).
  useEffect(() => {
    let active = true;
    (async () => {
      setReportQr(null); // never carry a previous report's QR
      try {
        const res = await fetchReportQr(id);
        if (!active) return;
        const data = res?.success ? res?.data : null;
        if (
          data &&
          typeof data.qrDataUrl === 'string' &&
          data.qrDataUrl.startsWith('data:image/')
        ) {
          setReportQr({
            qrDataUrl: data.qrDataUrl,
            verifyUrl: typeof data.verifyUrl === 'string' ? data.verifyUrl : ''
          });
        }
      } catch {
        // Optional metadata — the preview stays fully usable without it.
        if (active) setReportQr(null);
      }
    })();
    return () => {
      active = false;
    };
  }, [id, reloadKey]);

  // Invoice barcode for the current report's bill (existing authenticated
  // GET /bills/:id/barcode.svg — the server encodes the bill's own
  // billNumber; nothing is generated or modified here). Same stale-response
  // guard as the report/QR loads; the render step additionally checks the
  // fetched billId so another record's barcode can never appear. Missing
  // bill or failed load simply leaves the barcode hidden.
  const entryBillId = entry?.bill?._id || '';
  useEffect(() => {
    let active = true;
    let url = '';
    (async () => {
      setBillBarcode(null);
      if (!entryBillId) return;
      try {
        url = await fetchBarcodeSvgUrl(entryBillId);
        if (!active) {
          window.URL.revokeObjectURL(url);
          return;
        }
        setBillBarcode({ billId: entryBillId, url });
      } catch {
        // Optional metadata — the preview stays fully usable without it.
        if (active) setBillBarcode(null);
      }
    })();
    return () => {
      active = false;
      if (url) window.URL.revokeObjectURL(url); // object URLs are per-fetch
    };
  }, [entryBillId]);

  const refresh = () => {
    setLoading(true);
    setError(null);
    setPdfError(null);
    setReloadKey((key) => key + 1);
  };

  // Server PDF download — reuses the same authenticated endpoint the rest of
  // the app uses (/reports/:id/pdf). Duplicate clicks are ignored while a
  // request is in flight; failures surface in a banner without touching the
  // preview itself. The filename uses the report's own registration number
  // when the API provided one (no invented identifiers).
  const handleDownloadPdf = async () => {
    if (pdfLoading) return;
    setPdfLoading(true);
    setPdfError(null);
    try {
      const regNo = entry?.report?.registrationNumber;
      const filename = regNo ? `Report_${regNo}.pdf` : undefined;
      await downloadReportPdf(id, true, filename);
    } catch (err) {
      setPdfError(getApiErrorMessage(err, 'Failed to generate the PDF report.'));
    } finally {
      setPdfLoading(false);
    }
  };

  const renderField = (label, value) => (
    <div className="rp-field" key={label}>
      <dt>{label}</dt>
      <dd>{value || '—'}</dd>
    </div>
  );

  const renderResultRow = (row) => (
    <tr key={row.key}>
      <td>
        <div className="rp-test-name">{row.name}</div>
        {row.sub ? <div className="rp-sub">{row.sub}</div> : null}
      </td>
      <td className="rp-range">{row.referenceRange}</td>
      <td className="rp-unit">{row.unit || '—'}</td>
      <td className="rp-value">{row.value || '—'}</td>
      <td>{renderFlag(row.flag)}</td>
    </tr>
  );

  // Result rows — identical merge to Result Verification (Phase 5): billed
  // test entries from the /entry payload (values, units, flags, reference
  // ranges) plus formula-derived rows that only exist on the report
  // document's `results` array (test: null, derived: true). Formula values
  // are the ones the API already calculated — never recomputed here.
  const billEntries = dedupeTestEntries(entry?.testEntries ?? []);
  const calculatedResults = buildCalculatedResults(billEntries, reportDoc?.results);
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
  const derivedRows = (reportDoc?.results ?? [])
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

  // Sign-off info from the report document's own `signatures` entries.
  const signatures = reportDoc?.signatures ?? [];
  const lastSignature = signatures.length ? signatures[signatures.length - 1] : null;
  // `signedBy` arrives as a raw id (or a populated object when the API
  // provides one) — use the resolved user name for the id case.
  const signedByValue = lastSignature?.signedBy;
  const signedByName =
    signedByValue && typeof signedByValue === 'object'
      ? signedByValue.name || ''
      : signatoryUserName;

  // Signature master (image / signatory name / designation) matched to the
  // recorded signature id — null when the report was signed without one, in
  // which case fields fall back to the signedBy user or '—'. Nothing invented.
  const sigMasterId = lastSignature
    ? typeof lastSignature.signature === 'object'
      ? lastSignature.signature?._id || null
      : lastSignature.signature || null
    : null;
  const sigMaster =
    sigMasterId && Array.isArray(sigMasters)
      ? sigMasters.find((m) => String(m._id) === String(sigMasterId)) || null
      : null;
  const sigImageSrc = assetSrc(sigMaster?.imageUrl);
  const sigImageBroken = !!sigImageSrc && sigImgBrokenSrc === sigImageSrc;
  const signatoryName = sigMaster?.name || signedByName || '';

  const status = entry?.report?.status;
  const registrationNumber = entry?.report?.registrationNumber;

  return (
    <div className="report-preview-page">
      <PageHeader
        className="no-print"
        title="Report Preview"
        subtitle="View a complete laboratory report as recorded by the lab."
        action={
          <Button
            variant="secondary"
            size="sm"
            icon={<RefreshCw size={16} />}
            onClick={refresh}
            disabled={loading}
          >
            Refresh
          </Button>
        }
      />

      <div className="rp-topbar no-print">
        <Button
          variant="secondary"
          size="sm"
          icon={<ArrowLeft size={16} />}
          onClick={() => navigate('/lab/reports')}
          disabled={loading}
        >
          Back to reports
        </Button>
        {entry && !loading && !error ? (
          <div className="rp-topbar-meta">
            <span className="rp-reg">{registrationNumber || '—'}</span>
            <StatusBadge status={status} />
            {reportDoc?.fileUrl ? (
              <Button
                variant="secondary"
                size="sm"
                icon={<Download size={16} />}
                onClick={() =>
                  downloadFile(`/${reportDoc.fileUrl}`, `report_${registrationNumber}.pdf`)
                }
              >
                Download file
              </Button>
            ) : null}
            <Button
              variant="primary"
              size="sm"
              icon={<FileDown size={16} />}
              loading={pdfLoading}
              onClick={handleDownloadPdf}
            >
              Download PDF
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={<Printer size={16} />}
              onClick={() => window.print()}
            >
              Print
            </Button>
          </div>
        ) : null}
      </div>

      {pdfError ? (
        <div className="rp-banner rp-banner-error no-print" role="alert">
          <AlertTriangle size={16} aria-hidden="true" />
          <span>{pdfError}</span>
          <Button variant="secondary" size="sm" onClick={handleDownloadPdf}>
            Retry
          </Button>
        </div>
      ) : null}

      {profileError ? (
        <div className="rp-banner rp-banner-error no-print" role="alert">
          <AlertTriangle size={16} aria-hidden="true" />
          <span>{profileError}</span>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setProfileReloadKey((key) => key + 1)}
          >
            Retry
          </Button>
        </div>
      ) : null}

      {loading ? (
        <div className="rp-state-block">
          <LoadingSpinner label="Loading report..." />
        </div>
      ) : error ? (
        <div className="rp-banner rp-banner-error" role="alert">
          <AlertTriangle size={16} aria-hidden="true" />
          <span>{error}</span>
          <Button variant="secondary" size="sm" onClick={refresh}>
            Retry
          </Button>
        </div>
      ) : entry ? (
        <div className="printable-area">
          {/* Dynamic lab letterhead — API data only (see Letterhead.jsx). */}
          <Letterhead part="header" profile={profile} loading={profileLoading} />

          <header className="rp-report-head">
            <div>
              <h2 className="rp-report-title">Report Preview</h2>
              <div className="rp-report-no">
                Report No: <span>{registrationNumber || '—'}</span>
              </div>
            </div>
            <StatusBadge status={status} />
          </header>

          <div className="rp-info-grid">
            <section className="rp-card" aria-labelledby="rp-patient-heading">
              <h2 id="rp-patient-heading" className="rp-card-title">
                Patient
              </h2>
              <dl className="rp-fields">
                {renderField('Name', entry.patient?.name)}
                {renderField('Patient ID', entry.patient?.registrationNumber)}
                {renderField(
                  'Age',
                  entry.patient?.age != null && entry.patient.age !== ''
                    ? String(entry.patient.age)
                    : ''
                )}
                {renderField('Gender', entry.patient?.gender)}
                {renderField('Phone', entry.patient?.phone)}
                {renderField('Address', entry.patient?.address)}
              </dl>
            </section>

            <section className="rp-card" aria-labelledby="rp-case-heading">
              <h2 id="rp-case-heading" className="rp-card-title">
                Case
              </h2>
              <dl className="rp-fields">
                {renderField(
                  'Registered',
                  entry.report?.tat?.registered ? formatDate(entry.report.tat.registered) : ''
                )}
                {renderField(
                  'Reported',
                  entry.report?.tat?.reported ? formatDate(entry.report.tat.reported) : ''
                )}
                {renderField(
                  'Report Date',
                  reportDoc?.reportDate ? formatDate(reportDoc.reportDate) : ''
                )}
                {renderField('Referring Doctor', referrerName)}
                {renderField('Invoice No', entry.bill?.billNumber)}
                {renderField(
                  'Invoice Date',
                  entry.bill?.date ? formatDate(entry.bill.date) : ''
                )}
                {renderField('Entered By', reportDoc?.uploadedBy?.name)}
                {renderField('Signed By', signedByName)}
                {renderField(
                  'Signed At',
                  lastSignature?.signedAt ? formatDate(lastSignature.signedAt) : ''
                )}
              </dl>

              {/* Invoice barcode — server-rendered Code39 SVG for this
                  report's bill only (scannable; the SVG carries its own
                  human-readable bill number below the bars). Hidden when the
                  bill is missing, the fetch fails, or the image won't load. */}
              {entryBillId && billBarcode?.billId === entryBillId ? (
                <div className="rp-barcode">
                  <img
                    className="rp-barcode-img"
                    src={billBarcode.url}
                    alt={
                      entry.bill?.billNumber
                        ? `Barcode for invoice ${entry.bill.billNumber}`
                        : 'Invoice barcode'
                    }
                    onError={() => setBillBarcode(null)}
                  />
                </div>
              ) : null}
            </section>

            {/* Backend status + tat timeline (display-only). */}
            <TatTimeline report={entry.report} />
          </div>

          <section className="rp-card" aria-labelledby="rp-results-heading">
            <div className="rp-section-head">
              <h2 id="rp-results-heading" className="rp-card-title">
                Test Results
              </h2>
              <span className="rp-count">{resultCountLabel}</span>
            </div>
            <DataTable
              headers={['Test', 'Reference Range', 'Unit', 'Result', 'Flag']}
              data={resultRows}
              emptyTitle="No results recorded"
              emptyMessage="This report has no recorded test values."
              renderRow={renderResultRow}
            />
          </section>

          {/* Sign-off / e-signature — rendered only when the backend has
              recorded signatures. Image/designation come from the signature
              master record, signatory/status/time from the report itself;
              missing pieces render as '—' like every other field. */}
          {signatures.length > 0 ? (
            <section
              className="rp-card rp-signoff"
              aria-labelledby="rp-signoff-heading"
            >
              <div className="rp-section-head">
                <h2 id="rp-signoff-heading" className="rp-card-title">
                  Sign-off
                </h2>
              </div>
              <div className="rp-signoff-body">
                {sigImageSrc && !sigImageBroken ? (
                  <img
                    className="rp-signature-img"
                    src={sigImageSrc}
                    alt={
                      sigMaster?.name ? `Signature of ${sigMaster.name}` : 'Signature'
                    }
                    onError={() => setSigImgBrokenSrc(sigImageSrc)}
                  />
                ) : null}
                <dl className="rp-fields rp-signoff-fields">
                  {renderField('Status', status)}
                  {renderField('Signatory', signatoryName)}
                  {renderField('Designation', sigMaster?.title)}
                  {renderField(
                    'Signed At',
                    lastSignature?.signedAt ? formatDate(lastSignature.signedAt) : ''
                  )}
                </dl>
              </div>
            </section>
          ) : null}

          {/* Verification QR — server-provided data URL for this report only,
              placed in the report footer so it reaches the printed page.
              Hidden when the API omits or fails to load it. */}
          {reportQr ? (
            <div className="rp-verify" aria-label="Report verification QR code">
              <img
                className="rp-verify-qr"
                src={reportQr.qrDataUrl}
                alt="QR code to verify this report"
                onError={() => setReportQr(null)}
              />
              <div className="rp-verify-caption">
                <div className="rp-verify-title">Scan to verify</div>
                <div className="rp-verify-note">
                  {reportQr.verifyUrl ? (
                    <a
                      href={reportQr.verifyUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Verify this report online
                    </a>
                  ) : (
                    <span>Verify this report online using the QR code.</span>
                  )}
                </div>
              </div>
            </div>
          ) : null}

          {/* Dynamic lab letterhead footer — API data only. */}
          <Letterhead part="footer" profile={profile} />
        </div>
      ) : null}
    </div>
  );
};

export default ReportPreview;
