import React, { useEffect, useMemo, useRef, useState } from 'react';
import useStickyState from '../../../utils/useStickyState';
import { Plus, RefreshCw } from 'lucide-react';
import { getTemplates, saveTemplate } from '../../../services/notifyService';
import { PageHeader, Button, Modal, Input } from '../../../components/common';
import ReportTable from '../../../components/business/ReportTable';
import { notify } from '../../../components/common/Toast/toast';
import '../../../components/business/business.css';
import '../../manage/v2/manage.css';

const CHANNELS = [['sms', 'SMS'], ['whatsapp', 'WhatsApp'], ['email', 'Email']];
const channelLabel = (c) => (CHANNELS.find(([v]) => v === c) || [c, c])[1];
// Readable names for the built-in message keys.
const KEY_NAMES = {
  'report-ready': 'Report is ready', 'report-ready-wa': 'Report is ready (WhatsApp)', welcome: 'Welcome',
  'bill-ready': 'Bill is ready', 'bill-created': 'Bill created', otp: 'Login code', 'payment-received': 'Payment received',
};
const nameOf = (key) => KEY_NAMES[key] || String(key || '').replace(/[-_]+/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
const VARS = ['name', 'regNo', 'billNumber', 'total', 'due', 'url', 'lab'];
const SAMPLE = { name: 'Asha Devi', regNo: '000123', billNumber: '000456', total: '450', due: '0', url: 'https://…/r/abc', lab: 'Pure Path Lab', otp: '482913' };
const fill = (body) => String(body || '').replace(/\{\{\s*(\w+)\s*\}\}|\{(\w+)\}/g, (m, a, b) => SAMPLE[a || b] ?? m);

// Message wording (new look): what patients receive by SMS / WhatsApp / email.
export default function TemplatesV2() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useStickyState('search', '');
  const [channel, setChannel] = useStickyState('channel', '');
  // The open edit panel and its unsaved text come back after a reload.
  const [open, setOpen] = useStickyState('panelOpen', false);
  const [isNew, setIsNew] = useStickyState('isNew', false);
  const [form, setForm] = useStickyState('form', { key: '', channel: 'sms', body: '' });
  const [vars, setVars] = useState(VARS);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const bodyRef = useRef(null);

  const load = async () => {
    setLoading(true);
    try { const r = await getTemplates(); if (r.success) setList(r.data?.templates || r.data || []); }
    catch { notify('Could not load messages.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);
  // After a reload the click-to-insert words come from the message being edited.
  useEffect(() => {
    if (!open || isNew || !list.length) return;
    const t = list.find((x) => x.key === form.key);
    if (t?.variables?.length) setVars(t.variables);
  }, [list]); // eslint-disable-line react-hooks/exhaustive-deps

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return list.filter((t) => (!channel || t.channel === channel) && (!q || `${t.key} ${nameOf(t.key)} ${t.body || t.content || ''}`.toLowerCase().includes(q)));
  }, [list, search, channel]);

  const edit = (t) => {
    setIsNew(!t); setError('');
    setForm(t ? { key: t.key, channel: t.channel || 'sms', body: t.body || t.content || '' } : { key: '', channel: 'sms', body: '' });
    setVars(t?.variables?.length ? t.variables : VARS);
    setOpen(true);
  };
  const save = async (e) => {
    e?.preventDefault();
    if (!form.key.trim() || !form.body.trim()) { setError('Give the message a name and write the text.'); return; }
    setSaving(true); setError('');
    try {
      const r = await saveTemplate({ ...form, key: form.key.trim() });
      if (r.success) { setOpen(false); notify('Message saved'); load(); }
    } catch (err) { setError(err.response?.data?.message || 'Could not save. Try again.'); }
    finally { setSaving(false); }
  };
  const insertVar = (v) => {
    const el = bodyRef.current;
    const token = `{{${v}}}`;
    setForm((s) => {
      const at = el ? el.selectionStart : s.body.length;
      return { ...s, body: `${s.body.slice(0, at)}${token}${s.body.slice(at)}` };
    });
    requestAnimationFrame(() => el?.focus());
  };

  return (
    <div className="biz-page">
      <PageHeader
        title="Message wording"
        subtitle="The text patients receive by SMS, WhatsApp or email - for example when a report is ready."
        action={<div className="biz-actions">
          <Button variant="secondary" size="sm" icon={<RefreshCw size={14} />} onClick={load}>Refresh</Button>
          <Button variant="primary" size="sm" icon={<Plus size={14} />} onClick={() => edit(null)}>New message</Button>
        </div>}
      />
      <div className="mg-filter-row">
        <div className="mg-seg" role="group" aria-label="Sent by">
          {[['', 'All'], ...CHANNELS].map(([value, label]) => (
            <button key={label} type="button" className={channel === value ? 'is-on' : ''} aria-pressed={channel === value} onClick={() => setChannel(value)}>{label}</button>
          ))}
        </div>
        <div className="form-group mg-hidden-search"><input type="search" data-page-search="" aria-label="Search messages" placeholder="Search messages" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        <span className="mg-count">{rows.length} message{rows.length === 1 ? '' : 's'}</span>
      </div>

      <ReportTable loading={loading} rows={rows} rowKey={(t) => t._id || t.key} onRowClick={edit}
        empty="No messages yet. Add one to control what patients receive."
        columns={[
          { key: 'name', label: 'Message', render: (t) => <><div className="mg-name">{nameOf(t.key)}</div><div className="mg-sub">{t.key}</div></> },
          { key: 'channel', label: 'Sent by', render: (t) => <span className="mg-pill">{channelLabel(t.channel)}</span> },
          { key: 'text', label: 'What the patient sees', render: (t) => <span className="mg-sub" style={{ color: '#3f3f46' }}>{fill(t.body || t.content).slice(0, 110)}{fill(t.body || t.content).length > 110 ? '...' : ''}</span> },
          { key: 'act', label: '', align: 'right', render: (t) => <span onClick={(e) => e.stopPropagation()}><Button variant="secondary" size="sm" onClick={() => edit(t)}>Edit</Button></span> },
        ]} />

      <Modal isOpen={open} onClose={() => setOpen(false)} variant="drawer" title={isNew ? 'New message' : `Edit: ${nameOf(form.key)}`}
        footer={<>
          <span className="mg-draft-note">Nothing is sent from here.</span>
          <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="primary" onClick={save} loading={saving}>Save</Button>
        </>}>
        <form className="mg-form" onSubmit={save}>
          <div className="mg-form-section">
            <Input label="Name (short code) *" value={form.key} onChange={(e) => setForm((s) => ({ ...s, key: e.target.value }))} placeholder="e.g. report-ready" disabled={!isNew} />
            <div className="form-group">
              <span className="form-label">Sent by</span>
              <div className="mg-seg" role="group" aria-label="Sent by">
                {CHANNELS.map(([value, label]) => (
                  <button key={value} type="button" className={form.channel === value ? 'is-on' : ''} aria-pressed={form.channel === value} onClick={() => setForm((s) => ({ ...s, channel: value }))}>{label}</button>
                ))}
              </div>
            </div>
          </div>
          <div className="mg-form-section">
            <h3>Text</h3>
            <p className="mg-help">Click a word below to insert it; it is filled in for each patient.</p>
            <div className="mg-vars">{vars.map((v) => <button key={v} type="button" onClick={() => insertVar(v)}>{`{{${v}}}`}</button>)}</div>
            <textarea ref={bodyRef} className="form-control" aria-label="Message text" value={form.body} onChange={(e) => setForm((s) => ({ ...s, body: e.target.value }))} placeholder="Dear {{name}}, your report is ready: {{url}} - {{lab}}" />
            <span className="mg-sub">{form.body.length} characters{form.channel === 'sms' && form.body.length > 160 ? ' - longer than one SMS (160)' : ''}</span>
          </div>
          <div className="mg-form-section">
            <h3>Preview</h3>
            <div className="mg-preview">{fill(form.body) || 'Your text will show here.'}</div>
          </div>
          {error && <p className="mg-error" role="alert">{error}</p>}
        </form>
      </Modal>
    </div>
  );
}
