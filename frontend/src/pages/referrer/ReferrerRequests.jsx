import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getReferrerRequests } from '../../services/referrerService';

// What the lab has done with each request, in plain words.
const STATUS = {
  New: ['Sent to lab', 'is-wait'],
  Contacted: ['Lab contacted patient', 'is-wait'],
  Confirmed: ['Booked', 'is-ready'],
  Cancelled: ['Cancelled', 'is-off']
};
const day = (value) => {
  const d = value ? new Date(value) : null;
  return d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
};

// The patients this doctor sent to the lab, newest first.
export default function ReferrerRequests() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    getReferrerRequests()
      .then((r) => setRows(r?.data || []))
      .catch((err) => setError(err.response?.data?.message || 'Could not load your requests.'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <section className="rf-page">
      <div className="rf-title">
        <div>
          <h1>My requests</h1>
          <p>Patients you sent to the lab. Once the lab makes the bill, the patient shows under My patients.</p>
        </div>
        <Link to="/referrer/send" className="btn btn-primary">Send a patient</Link>
      </div>
      {error && <div className="rf-error" role="alert">{error}</div>}
      {loading && <p className="rf-count">Loading…</p>}
      {!loading && !error && rows.length === 0 && <div className="rf-empty">No requests yet.</div>}
      <div className="rf-list">
        {rows.map((r) => {
          const [label, tone] = STATUS[r.status] || [r.status, ''];
          return (
            <article key={r._id} className="rf-card" data-testid="referrer-request">
              <header className="rf-card-head">
                <div>
                  <h3 className="rf-patient">{r.name}</h3>
                  <div className="rf-meta">{[r.phone, r.age != null ? `${r.age} yrs` : '', r.gender].filter(Boolean).join(' · ')}</div>
                </div>
                <div className="rf-card-date">
                  <div>{day(r.createdAt)}</div>
                  <span className={`rf-chip ${tone}`}>{label}</span>
                </div>
              </header>
              <p className="rf-tests"><span className="rf-label">Tests</span>{r.tests.join(', ')}</p>
              {(r.preferredDate || r.note) && (
                <p className="rf-meta">{[r.preferredDate && `Wants on ${day(r.preferredDate)}`, r.note].filter(Boolean).join(' · ')}</p>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
