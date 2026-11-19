import React, { useCallback, useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { Download, Eye, FileText, Search, RefreshCw } from 'lucide-react';
import { Button, WhatsAppShare } from '../../components/common';
import { notify } from '../../components/common/Toast/toast';
import useDebounce from '../../hooks/useDebounce';
import formatCurrency from '../../utils/formatCurrency';
import {
  getReferrerCases, shareReferrerBill, shareReferrerReport, downloadReferrerBill, downloadReferrerReport
} from '../../services/referrerService';
import ReportViewer from './ReportViewer';
import { patientName } from '../../utils/patientName';
import TestNames from '../../components/common/TestNames';

const day = (value) => {
  const d = value ? new Date(value) : null;
  return d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
};
const fullName = (p) => patientName(p) || 'Patient';
const ageSex = (p) => {
  if (!p) return '';
  const unit = p.ageUnit && p.ageUnit !== 'years' ? ` ${p.ageUnit}` : ' yrs';
  return [p.age != null && p.age !== '' ? `${p.age}${unit}` : '', p.gender || ''].filter(Boolean).join(' · ');
};

function DownloadButton({ label, run }) {
  const [busy, setBusy] = useState(false);
  const click = async () => {
    setBusy(true);
    try { await run(); }
    catch (err) { notify(err.response?.data?.message || err.message || 'Could not download. Please try again.'); }
    finally { setBusy(false); }
  };
  return <Button variant="secondary" size="sm" icon={<Download size={14} />} loading={busy} onClick={click}>{label}</Button>;
}

function ReportLine({ row, report, labName, onView }) {
  return (
    <li className="rf-report">
      <span className="rf-report-name" title={report.tests?.length ? report.tests.join(', ') : undefined}>
        <FileText size={15} aria-hidden="true" />{report.label}
        {/* Only this report's own tests (mixed bills: in-house vs outside lab). */}
        {row.reports?.filter((r) => r.kind === 'lab').length > 1 && report.tests?.length > 0 && (
          <small style={{ marginLeft: 6, opacity: 0.8 }}><TestNames names={report.tests} visible={2} /></small>
        )}
      </span>
      {report.ready ? (
        <>
          <span className="rf-chip is-ready">{report.partial ? 'Partly ready' : 'Ready'}</span>
          {/* Outside-lab report: the published tests are open, the rest still out. */}
          {report.partial && report.readySummary && <small className="rf-meta" style={{ flexBasis: '100%' }}>{report.readySummary}</small>}
          <span className="rf-report-actions">
            <Button variant="primary" size="sm" icon={<Eye size={14} />} onClick={() => onView({ row, report })}>View report</Button>
            <DownloadButton label="Report PDF" run={() => downloadReferrerReport(row, report)} />
            {report.kind === 'lab' && (
              <WhatsAppShare kind="report" id={report._id} phone={row.patient?.phone} name={fullName(row.patient)} label="Send"
                labName={labName} getLink={shareReferrerReport} />
            )}
          </span>
        </>
      ) : (
        <span className="rf-chip is-wait" title="Results are shown once the lab signs the report.">Processing</span>
      )}
    </li>
  );
}

function CaseCard({ row, labName, onView }) {
  return (
    <article className="rf-card" data-testid="referrer-case">
      <header className="rf-card-head">
        <div>
          <h3 className="rf-patient">{fullName(row.patient)}</h3>
          <div className="rf-meta">{[ageSex(row.patient), row.patient?.registrationNumber && `Reg ${row.patient.registrationNumber}`].filter(Boolean).join(' · ')}</div>
        </div>
        <div className="rf-card-date">
          <div>{day(row.date)}</div>
          <div className="rf-meta">Bill {row.billNumber}</div>
        </div>
      </header>
      {row.tests.length > 0 && <p className="rf-tests"><span className="rf-label">Tests</span>{row.tests.join(', ')}</p>}
      <dl className="rf-money">
        <div><dt>Bill</dt><dd>{formatCurrency(row.totalAmount)}</dd></div>
        <div><dt>Paid</dt><dd>{formatCurrency(row.paidAmount)}</dd></div>
        <div className={row.dueAmount > 0 ? 'is-due' : ''}><dt>Due</dt><dd>{formatCurrency(row.dueAmount)}</dd></div>
      </dl>
      {row.reports.length > 0 ? (
        <ul className="rf-reports">{row.reports.map((r) => <ReportLine key={`${r.kind}-${r._id}`} row={row} report={r} labName={labName} onView={onView} />)}</ul>
      ) : (
        <p className="rf-meta">No report for this visit yet.</p>
      )}
      <footer className="rf-card-foot">
        <DownloadButton label="Bill PDF" run={() => downloadReferrerBill(row)} />
        <WhatsAppShare kind="bill" id={row._id} phone={row.patient?.phone} name={fullName(row.patient)} billNumber={row.billNumber}
          label="Send bill" labName={labName} getLink={shareReferrerBill} />
      </footer>
    </article>
  );
}

// My patients: every visit where "Referred by" is this doctor, newest first.
// Read-only: bills and signed reports can be downloaded or sent, nothing
// can be changed. A report shows only "Processing" until it is signed.
export default function ReferrerCases() {
  const { profile } = useOutletContext() || {};
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const query = useDebounce(search.trim(), 350);
  const [rows, setRows] = useState([]);
  const [otherScans, setOtherScans] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [viewing, setViewing] = useState(null);

  const load = useCallback(async (nextPage = 1) => {
    setLoading(true); setError('');
    try {
      const res = await getReferrerCases({ search: query || undefined, from: from || undefined, to: to || undefined, page: nextPage, limit: 20 });
      if (res?.success) {
        const data = res.data || {};
        setRows((prev) => (nextPage === 1 ? data.cases || [] : [...prev, ...(data.cases || [])]));
        if (nextPage === 1) setOtherScans(data.otherScans || []);
        setPage(nextPage);
        setPages(data.pagination?.pages || 1);
        setTotal(data.pagination?.total || 0);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load your patients. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [query, from, to]);
  useEffect(() => { load(1); }, [load]);

  const labName = profile?.labName || '';
  const filtered = !!(query || from || to);

  return (
    <section className="rf-page">
      <div className="rf-title">
        <div>
          <h1>My patients</h1>
          <p>Patients you referred to the lab. Reports open here once the lab signs them.</p>
        </div>
        <Link to="/referrer/send" className="btn btn-primary">Send a patient</Link>
      </div>

      <div className="rf-filters" role="search">
        <label className="rf-search">
          <Search size={16} aria-hidden="true" />
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Patient name, mobile, bill no or test" aria-label="Search your patients" />
        </label>
        <label className="rf-date"><span>From</span><input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} /></label>
        <label className="rf-date"><span>To</span><input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} /></label>
        {filtered && <Button variant="ghost" size="sm" onClick={() => { setSearch(''); setFrom(''); setTo(''); }}>Clear</Button>}
        <Button variant="ghost" size="sm" icon={<RefreshCw size={14} />} onClick={() => load(1)} aria-label="Refresh">Refresh</Button>
      </div>

      {error && <div className="rf-error" role="alert">{error}</div>}
      {!error && <p className="rf-count" aria-live="polite">{loading && page === 1 ? 'Loading…' : `${total} visit${total === 1 ? '' : 's'}${filtered ? ' found' : ''}`}</p>}

      <div className="rf-list">
        {rows.map((row) => <CaseCard key={row._id} row={row} labName={labName} onView={setViewing} />)}
      </div>
      {!loading && !error && rows.length === 0 && (
        <div className="rf-empty">
          {filtered ? 'No patient matches. Try another name or date.' : 'No patients yet. When the lab bills a patient you referred, they appear here.'}
        </div>
      )}
      {page < pages && (
        <div className="rf-more"><Button variant="secondary" loading={loading} onClick={() => load(page + 1)}>Show more</Button></div>
      )}

      {otherScans.length > 0 && (
        <>
          <h2 className="rf-subtitle">Other scans</h2>
          <div className="rf-list">
            {otherScans.map((scan) => (
              <article key={`${scan.kind}-${scan._id}`} className="rf-card">
                <header className="rf-card-head">
                  <div>
                    <h3 className="rf-patient">{fullName(scan.patient)}</h3>
                    <div className="rf-meta">{[ageSex(scan.patient), scan.what].filter(Boolean).join(' · ')}</div>
                  </div>
                  <div className="rf-card-date">{day(scan.date)}</div>
                </header>
                <ul className="rf-reports"><ReportLine row={{ patient: scan.patient }} report={scan} labName={labName} onView={setViewing} /></ul>
              </article>
            ))}
          </div>
        </>
      )}
      <ReportViewer target={viewing} onClose={() => setViewing(null)} />
    </section>
  );
}
