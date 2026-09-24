import React from 'react';
import { Check } from 'lucide-react';
import StatusBadge from '../StatusBadge/StatusBadge';
import formatDate from '../../../utils/formatDate';
import { formatReportTat, isTatOpen, toValidDate } from '../../../utils/reportTat';
import './TatTimeline.css';

/* Stages mirror the backend Report model only: the `tat` keys
   (registered / collected / received / reported) and the status enum
   (Pending, Registered, Collected, Received, Reported, Signed, Completed).
   Labels are static UI text. A stage is shown as completed ONLY when the
   backend data says so — a recorded tat timestamp, or a status value the
   backend itself uses to denote that stage. Nothing is inferred or
   persisted: this component is display-only. */
const STAGES = [
  {
    label: 'Registered',
    tatKey: 'registered',
    statuses: ['Registered', 'Draft', 'Collected', 'Received', 'Reported', 'Signed', 'Completed']
  },
  { label: 'Collected', tatKey: 'collected', statuses: ['Collected'] },
  { label: 'Received', tatKey: 'received', statuses: ['Received'] },
  { label: 'Reported', tatKey: 'reported', statuses: ['Reported'] },
  { label: 'Signed', tatKey: null, statuses: ['Signed'] },
  { label: 'Completed', tatKey: null, statuses: ['Completed'] }
];

const TatTimeline = ({ report, className = '' }) => {
  if (!report) return null;

  const status = report.status ?? null;
  const tat = report.tat ?? null;
  const ongoing = isTatOpen(report);
  const tatValue = formatReportTat(report);

  return (
    <section
      className={`tat-card ${className}`.trim()}
      aria-label="Case status and turnaround time"
    >
      <div className="tat-head">
        <h2 className="tat-title">Turnaround Time</h2>
        <span className="tat-total">
          {ongoing ? `TAT so far: ${tatValue}` : `TAT: ${tatValue}`}
        </span>
      </div>

      <div className="tat-status">
        <span className="tat-label">Status</span>
        {status ? <StatusBadge status={status} /> : <span>—</span>}
      </div>

      <ol className="tat-stages">
        {STAGES.map((stage) => {
          const at = stage.tatKey ? toValidDate(tat?.[stage.tatKey]) : null;
          const done = Boolean(at) || stage.statuses.includes(status);
          return (
            <li
              key={stage.label}
              className={`tat-stage ${done ? 'tat-stage-done' : 'tat-stage-pending'}`}
              aria-label={`${stage.label}: ${
                done ? (at ? formatDate(at) : 'recorded') : 'not recorded'
              }`}
            >
              <span className="tat-mark" aria-hidden="true">
                {done ? <Check size={12} strokeWidth={3} /> : ''}
              </span>
              <span className="tat-stage-label">{stage.label}</span>
              <span className="tat-stage-time">{at ? formatDate(at) : '—'}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
};

export default TatTimeline;
