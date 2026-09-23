import React from 'react';
import formatDate from '../../utils/formatDate';
import { getReportStatusLabel } from '../../utils/reportStatus';

// Phase 3 — VerificationTimeline. Renders the real lifecycle from report
// data (TAT dates + signatures). Verified/Rejected steps are shown as gated
// future steps — never as completed — until the backend verify/reject
// endpoints + enum values exist.
const VerificationTimeline = ({ report }) => {
  if (!report) return null;
  const tat = report.tat || {};
  const signedAt = report.signatures?.[0]?.signedAt;
  const steps = [
    { label: 'Registered', at: tat.registered, done: !!tat.registered },
    { label: 'Sample Collected', at: tat.collected, done: !!tat.collected },
    { label: 'Sample Received', at: tat.received, done: !!tat.received },
    { label: 'Reported', at: tat.reported, done: !!tat.reported },
    { label: `Signed${report.signatures?.length > 1 ? ` (${report.signatures.length})` : ''}`, at: signedAt, done: !!signedAt },
    { label: 'Verified', at: null, done: false, gated: true },
    { label: 'Rejected', at: null, done: false, gated: true },
  ];
  return (
    <div style={{ marginTop: 16 }}>
      <h4 style={{ fontSize: '0.85rem', marginBottom: 8 }}>Verification timeline</h4>
      <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 6 }}>
        {steps.map((s) => (
          <li key={s.label} style={{ display: 'flex', gap: 8, alignItems: 'baseline', fontSize: '0.8rem' }}>
            <span
              style={{
                width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
                background: s.done ? '#16a34a' : s.gated ? '#d1d5db' : '#f59e0b',
              }}
              title={s.gated ? 'Backend pending: verify/reject endpoints do not exist' : s.done ? 'Done' : 'Pending'}
            />
            <span style={{ fontWeight: 600 }}>{s.label}</span>
            <span style={{ color: '#6b7280' }}>
              {s.at ? formatDate(s.at) : s.gated ? '(backend pending)' : '(pending)'}
            </span>
          </li>
        ))}
      </ol>
      <p style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: 8 }}>
        Current status: <strong>{getReportStatusLabel(report.status)}</strong> (Verified/Rejected are display-only until backend lands).
      </p>
    </div>
  );
};

export default VerificationTimeline;
