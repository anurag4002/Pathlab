import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { Button, Input } from '../common';
import { updateReportTat } from '../../services/reportService';
import { fromLabDateTime, toLabDateTime } from '../../utils/labDateTime';

const fields = ['registered', 'collected', 'received', 'reported'];

// `ref.flush()` persists pending edits. Case-level save buttons call it before
// saving results so TAT edits are never silently dropped.
const ReportTatEditor = forwardRef(function ReportTatEditor({ report, onSaved }, ref) {
  return <ReportTatForm key={report?._id} report={report} onSaved={onSaved} apiRef={ref} />;
});
export default ReportTatEditor;

function ReportTatForm({ report, onSaved, apiRef }) {
  const [draft, setDraft] = useState({});
  const values = { ...Object.fromEntries(fields.map(key => [key, toLabDateTime(report?.tat?.[key])])), ...draft };
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const fallbackRef = useRef(null);
  const dirty = fields.some(key => values[key] !== toLabDateTime(report?.tat?.[key]));
  const save = async () => {
    if (busy || !report?._id) return;
    if (!values.registered) throw new Error('Registered date and time is required.');
    setBusy(true); setMessage(null);
    try {
      const payload = Object.fromEntries(fields.map(key => [key, fromLabDateTime(values[key])]));
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
  return <fieldset disabled={busy} style={{ border: '1px solid var(--color-border)', borderRadius: 8, padding: 12, margin: '16px 0' }}>
    <legend>Report date and time (IST)</legend>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
      {fields.map(key => <Input key={key} id={`tat-${report?._id}-${key}`} type="datetime-local" label={`${key[0].toUpperCase()}${key.slice(1)} (TAT)`}
        value={values[key] || ''} onChange={e => { setMessage(null); setDraft(prev => ({ ...prev, [key]: e.target.value })); }} required={key === 'registered'} />)}
    </div>
    <Button variant="secondary" onClick={() => { save().catch(() => {}); }} disabled={!report?._id || !values.registered || busy} loading={busy}>Save date and time</Button>
    {message && <p role={message.error ? 'alert' : 'status'} style={{ color: message.error ? '#b91c1c' : '#166534' }}>{message.text}</p>}
  </fieldset>;
}
