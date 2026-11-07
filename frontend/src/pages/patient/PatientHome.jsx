import React, { useMemo, useState } from 'react';
import { AlertCircle, CalendarPlus, CheckCircle2, ChevronRight, Clock, Download, Eye, LogOut, RefreshCw, Search, UserRound } from 'lucide-react';
import formatDate from '../../utils/formatDate';
import formatCurrency from '../../utils/formatCurrency';

// Signed-in patient page: who you are, your reports, your bookings - one
// simple column, made for a phone first.
const ageSex = (p) => {
  const unit = { months: 'M', days: 'D' }[p.ageUnit] || 'Y';
  const sex = p.gender ? p.gender[0].toUpperCase() : '';
  return [p.age != null && p.age !== '' ? `${p.age} ${unit}` : '', sex].filter(Boolean).join(' · ');
};
const prettyPhone = (n) => (String(n).length === 10 ? `+91 ${String(n).slice(0, 5)} ${String(n).slice(5)}` : n);
const BOOKING_WORDS = { New: 'Sent - the lab will call you', Contacted: 'The lab has called you', Confirmed: 'Confirmed', Converted: 'Done - bill made', Cancelled: 'Cancelled' };

export default function PatientHome({
  phone, profiles = [], reports = [], loadingReports, inquiries = [], loadingBookings,
  onRefresh, onDownload, downloadingId, onView, onBook, onLogout, notice, error,
}) {
  const [search, setSearch] = useState('');
  // People on this number: from sign-in, or from the reports if the page was reloaded.
  const people = useMemo(() => {
    if (profiles.length) return profiles;
    const names = [...new Set(reports.map((r) => r.patientName).filter(Boolean))];
    return names.map((name) => ({ name }));
  }, [profiles, reports]);
  const first = people[0]?.name ? String(people[0].name).split(' ')[0] : '';
  const ready = reports.filter((r) => r.downloadable !== false);
  const q = search.trim().toLowerCase();
  const shown = q ? reports.filter((r) => `${r.testName} ${r.patientName} ${r.registrationNumber}`.toLowerCase().includes(q)) : reports;
  const openBookings = inquiries.filter((i) => !['Converted', 'Cancelled'].includes(i.status));

  return (
    <div className="ph">
      <section className="ph-me" aria-label="Signed in">
        <div className="ph-me-top">
          <div>
            <p className="ph-hello">{first ? `Hello, ${first}` : 'Hello'}</p>
            <p className="ph-number">Signed in with {prettyPhone(phone)}</p>
          </div>
          <button type="button" className="ph-signout" onClick={onLogout}><LogOut size={16} aria-hidden="true" /> Sign out</button>
        </div>
        {people.length > 0 && (
          <ul className="ph-people" aria-label="People on this number">
            {people.map((p) => (
              <li key={p._id || p.name}>
                <span className="ph-avatar" aria-hidden="true"><UserRound size={18} /></span>
                <span className="ph-person">
                  <b>{[p.title, p.name].filter(Boolean).join(' ')}</b>
                  <small>{[ageSex(p), p.registrationNumber && `Reg ${p.registrationNumber}`].filter(Boolean).join(' · ') || 'Patient'}</small>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {error && <p className="ph-alert is-error" role="alert"><AlertCircle size={17} aria-hidden="true" />{error}</p>}
      {notice && <p className="ph-alert is-ok" role="status"><CheckCircle2 size={17} aria-hidden="true" />{notice}</p>}

      <section className="ph-block" aria-labelledby="ph-reports">
        <div className="ph-head">
          <div>
            <h2 id="ph-reports">Your reports</h2>
            <p>{loadingReports ? 'Loading...' : reports.length ? `${ready.length} of ${reports.length} ready to download` : 'Nothing here yet'}</p>
          </div>
          <button type="button" className="ph-icon-btn" onClick={onRefresh} disabled={loadingReports} aria-label="Check again"><RefreshCw size={18} className={loadingReports ? 'spin' : ''} /></button>
        </div>
        {reports.length > 6 && (
          <label className="ph-search"><Search size={17} aria-hidden="true" /><input type="search" placeholder="Find a report - test or name" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Find a report" /></label>
        )}
        {loadingReports && !reports.length ? (
          <div className="ph-card ph-skel" aria-hidden="true"><span /><span /><span /></div>
        ) : !reports.length ? (
          <div className="ph-empty">
            <p><b>No reports on this number yet.</b></p>
            <p>After your sample is taken at the lab, the report shows up here - first as &ldquo;Being prepared&rdquo;, then ready to download.</p>
          </div>
        ) : (
          <ul className="ph-reports" role="list">
            {shown.map((r) => {
              const isReady = r.downloadable !== false;
              return (
                <li key={r.id} className={`ph-card ph-report ${isReady ? 'is-ready' : 'is-pending'}`}>
                  <div className="ph-report-top">
                    <span className={`ph-status ${isReady ? 'is-ready' : 'is-pending'}`}>
                      {isReady ? <CheckCircle2 size={14} aria-hidden="true" /> : <Clock size={14} aria-hidden="true" />}
                      {isReady ? 'Ready' : 'Being prepared'}
                    </span>
                    <span className="ph-date">{formatDate(r.date).split(',')[0]}</span>
                  </div>
                  <h3>{r.testName}</h3>
                  <p className="ph-report-who">{r.patientName}{r.registrationNumber ? ` · Reg ${r.registrationNumber}` : ''}{r.type && r.type !== 'Lab' ? ` · ${r.type}` : ''}</p>
                  {isReady ? (
                    <div className="ph-actions">
                      <button type="button" className="pps-btn pps-btn-blue" data-testid="report-pdf-download" disabled={downloadingId !== null}
                        aria-label={`Download ${r.testName} PDF for ${r.patientName}`} onClick={() => onDownload(r)}>
                        <Download size={17} aria-hidden="true" />{downloadingId === r.id ? 'Downloading...' : 'Download PDF'}
                      </button>
                      <button type="button" className="pps-btn pps-btn-light" aria-label={`View ${r.testName} for ${r.patientName}`} onClick={() => onView(r)}><Eye size={17} aria-hidden="true" /> Details</button>
                    </div>
                  ) : (
                    <p className="ph-wait">The lab is still working on it. Check again later{r.status && !/processing|pending/i.test(r.status) ? ` (${r.status})` : ''}.</p>
                  )}
                </li>
              );
            })}
            {q && !shown.length && <li className="ph-empty">No report matches &ldquo;{search}&rdquo;.</li>}
          </ul>
        )}
      </section>

      <section className="ph-block" aria-labelledby="ph-book">
        <button type="button" className="ph-book" onClick={onBook}>
          <span className="ph-book-icon" aria-hidden="true"><CalendarPlus size={22} /></span>
          <span><b id="ph-book">Book a test</b><small>For you or anyone in the family. Pay at the lab.</small></span>
          <ChevronRight size={20} aria-hidden="true" />
        </button>
        {(loadingBookings || openBookings.length > 0) && (
          <div className="ph-bookings">
            <h2>Your bookings</h2>
            {loadingBookings && !inquiries.length ? <p className="ph-muted">Loading...</p> : (
              <ul role="list">
                {openBookings.map((b) => (
                  <li key={b._id} className="ph-card ph-booking">
                    <b>{(b.items || []).map((it) => it.name).join(', ') || 'Booking'}</b>
                    <small>For {b.name}{b.preferredDate ? ` · ${formatDate(b.preferredDate).split(',')[0]}` : ''} · about {formatCurrency((b.items || []).reduce((s, it) => s + (Number(it.price) || 0), 0))}</small>
                    <span className="ph-booking-state">{BOOKING_WORDS[b.status] || b.status}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
