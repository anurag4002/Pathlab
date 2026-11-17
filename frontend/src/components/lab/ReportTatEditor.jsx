import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { Button } from '../common';
import { updateReportTat } from '../../services/reportService';
import { fromLabDateTime, toLabDateTime } from '../../utils/labDateTime';

const fields = ['registered', 'collected', 'received', 'reported'];

// `ref.flush()` persists pending edits. Case-level save buttons call it before
// saving results so TAT edits are never silently dropped.
const ReportTatEditor = forwardRef(function ReportTatEditor({ report, onSaved, compact = false }, ref) {
  return <ReportTatForm key={report?._id} report={report} onSaved={onSaved} apiRef={ref} compact={compact} />;
});
export default ReportTatEditor;

function ReportTatForm({ report, onSaved, apiRef, compact }) {
  // Collected / Received / Reported start with the Registered date and time
  // when they are still empty (staff change them if they differ). They are
  // saved together with the results, like any other edit here.
  // Only the date is filled in; the time stays blank for staff to type.
  // Collected / Received saved with a blank time stay blank (date only, also
  // on the print) - never the reported time. Reported takes the time of saving.
  const [draft, setDraft] = useState(() => {
    const registered = toLabDateTime(report?.tat?.registered);
    if (!registered) return {};
    const day = registered.slice(0, 10);
    return Object.fromEntries(['collected', 'received', 'reported']
      .filter((key) => !report?.tat?.[key])
      .map((key) => [key, `${day}T`]));
  });
  const savedDateOnly = report?.tat?.dateOnly || [];
  const savedValue = (key) => {
    const value = toLabDateTime(report?.tat?.[key]);
    return value && savedDateOnly.includes(key) ? `${value.slice(0, 10)}T` : value;
  };
  const values = { ...Object.fromEntries(fields.map(key => [key, savedValue(key)])), ...draft };
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const fallbackRef = useRef(null);
  const dirty = fields.some(key => values[key] !== savedValue(key));
  const save = async () => {
    if (busy || !report?._id) return;
    if (!values.registered) throw new Error('Registered date and time is required.');
    setBusy(true); setMessage(null);
    try {
      // Reported with a blank time takes the current time; collected and
      // received keep a blank time (saved as the date alone).
      const nowTime = toLabDateTime(new Date()).slice(11, 16);
      const blankTime = (value) => !!value && /T$/.test(value);
      const dateOnly = ['collected', 'received'].filter((key) => blankTime(values[key]));
      const complete = (key, value) => (blankTime(value) ? `${value}${dateOnly.includes(key) ? '00:00' : nowTime}` : value);
      const payload = { ...Object.fromEntries(fields.map(key => [key, fromLabDateTime(complete(key, values[key]))])), dateOnly };
      const res = await updateReportTat(report._id, payload);
      onSaved?.(res.data);
      setDraft({});
      setMessage({ text: 'Date and time saved.', error: false });
      return res.data;
    } catch (error) {
      setMessage({ text: error.response?.data?.message || error.message || 'Could not save TAT.', error: true });
      throw error;
    } finally { setBusy(false); }
  };
  useImperativeHandle(apiRef || fallbackRef, () => ({
    flush: async () => { if (dirty) return save(); }
  }));
  const setPart = (key, part, next) => {
    const [datePart = '', timePart = ''] = String(values[key] || '').split('T');
    // A blank time stays blank (filled with the time of saving), never 00:00.
    const combined = part === 'date' ? (next ? `${next}T${timePart}` : '') : (datePart ? `${datePart}T${next || ''}` : '');
    setMessage(null); setDraft(prev => ({ ...prev, [key]: combined }));
  };
  if (compact) return <fieldset disabled={busy} className="ls-tat">
    <legend className="sr-only">Report date and time (IST)</legend>
    {fields.map(key => {
      const [datePart = '', timePart = ''] = String(values[key] || '').split('T');
      const label = `${key[0].toUpperCase()}${key.slice(1)} on:`;
      return <div key={key} className="ls-tat-row">
        <label htmlFor={`tat-${report?._id}-${key}-date`}>{label}</label>
        <input id={`tat-${report?._id}-${key}-date`} type="date" className="ls-tat-input" value={datePart} aria-label={`${label} date`} required={key === 'registered'}
          onChange={e => setPart(key, 'date', e.target.value)} onBlur={() => { if (dirty) save().catch(() => {}); }} />
        <input type="time" className="ls-tat-input ls-tat-time" value={timePart.slice(0, 5)} aria-label={`${label} time`} disabled={!datePart}
          onChange={e => setPart(key, 'time', e.target.value)} onBlur={() => { if (dirty) save().catch(() => {}); }} />
      </div>;
    })}
    {message && <p className={`ls-tat-message${message.error ? ' is-error' : ''}`} role={message.error ? 'alert' : 'status'}>{message.text}</p>}
  </fieldset>;
  return <fieldset disabled={busy} style={{ border: '1px solid var(--color-border)', borderRadius: 8, padding: 12, margin: '16px 0' }}>
    <legend>Report date and time (IST)</legend>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
      {fields.map(key => {
        const [datePart = '', timePart = ''] = String(values[key] || '').split('T');
        const label = `${key[0].toUpperCase()}${key.slice(1)} (TAT)`;
        return <div key={key} className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label" htmlFor={`tat-${report?._id}-${key}`}>{label}{key === 'registered' ? ' *' : ''}</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 7rem', gap: 6 }}>
            <input id={`tat-${report?._id}-${key}`} type="date" className="form-control" value={datePart} aria-label={`${label} date`} required={key === 'registered'}
              onChange={e => setPart(key, 'date', e.target.value)} />
            <input type="time" className="form-control" value={timePart.slice(0, 5)} aria-label={`${label} time`} disabled={!datePart}
              onChange={e => setPart(key, 'time', e.target.value)} />
          </div>
        </div>;
      })}
    </div>
    <Button variant="secondary" onClick={() => { save().catch(() => {}); }} disabled={!report?._id || !values.registered || busy} loading={busy}>Save date and time</Button>
    {message && <p role={message.error ? 'alert' : 'status'} style={{ color: message.error ? '#b91c1c' : '#166534' }}>{message.text}</p>}
  </fieldset>;
}
