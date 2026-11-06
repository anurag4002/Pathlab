import React, { useEffect, useMemo, useRef, useState } from 'react';
import useStickyState from '../../../utils/useStickyState';
import { Plus, RefreshCw } from 'lucide-react';
import { getTickets, createTicket, setTicketStatus } from '../../../services/supportService';
import { PageHeader, Button, Modal, Input, RowMenu } from '../../../components/common';
import ReportTable from '../../../components/business/ReportTable';
import useAuth from '../../../hooks/useAuth';
import { notify } from '../../../components/common/Toast/toast';
import { dateTimeLabel } from '../../../utils/reportFormat';
import useDraft from '../../manage/v2/useDraft';
import '../../../components/business/business.css';
import '../../manage/v2/manage.css';

const STATUS = {
  Open: { label: 'Open', tone: 'is-warn' },
  InProgress: { label: 'Being worked on', tone: 'is-info' },
  Resolved: { label: 'Fixed', tone: 'is-good' },
  Closed: { label: 'Closed', tone: '' },
};
const EMPTY = { subject: '', message: '' };

// Help requests (new look): raise a problem, see where it stands.
export default function TicketsV2() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'Admin';
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useStickyState('search', '');
  const [show, setShow] = useStickyState('tab', 'open');
  const [open, setOpen] = useStickyState('askOpen', false);
  const [viewing, setViewingState] = useState(null);
  // The request being read is reopened after a reload.
  const [viewId, setViewId] = useStickyState('viewing', null);
  const setViewing = (t) => { setViewingState(t); setViewId(t?._id || null); };
  const restored = useRef(false);
  const [form, setForm, clearForm] = useDraft('ticket', EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    try { const r = await getTickets(); if (r.success) setList(r.data?.tickets || r.data || []); }
    catch { notify('Could not load help requests.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (restored.current || !viewId || !list.length) return;
    restored.current = true;
    const t = list.find((x) => x._id === viewId);
    if (t) setViewingState(t); else setViewId(null);
  }, [list, viewId]); // eslint-disable-line react-hooks/exhaustive-deps

  const isOpen = (t) => t.status === 'Open' || t.status === 'InProgress';
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return list
      .filter((t) => (show === 'open' ? isOpen(t) : show === 'done' ? !isOpen(t) : true))
      .filter((t) => !q || `${t.subject} ${t.message}`.toLowerCase().includes(q))
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  }, [list, search, show]);
  const counts = { open: list.filter(isOpen).length, done: list.filter((t) => !isOpen(t)).length, all: list.length };

  const submit = async (e) => {
    e?.preventDefault();
    if (!form.subject.trim() || !form.message.trim()) { setError('Write a short subject and what went wrong.'); return; }
    setSaving(true); setError('');
    try {
      const r = await createTicket({ subject: form.subject.trim(), message: form.message.trim() });
      if (r.success) { clearForm(); setOpen(false); notify('Help request sent'); load(); }
    } catch (err) { setError(err.response?.data?.message || 'Could not send. Try again.'); }
    finally { setSaving(false); }
  };
  const setStatus = async (t, status) => {
    try { await setTicketStatus(t._id, { status }); notify(`Marked as ${STATUS[status].label.toLowerCase()}`); setViewing(null); load(); }
    catch { notify('Could not update. Try again.'); }
  };

  return (
    <div className="biz-page">
      <PageHeader
        title="Help requests"
        subtitle="Tell us when something is not working. You can see here what is being fixed."
        action={<div className="biz-actions">
          <Button variant="secondary" size="sm" icon={<RefreshCw size={14} />} onClick={load}>Refresh</Button>
          <Button variant="primary" size="sm" icon={<Plus size={14} />} onClick={() => { setError(''); setOpen(true); }}>Ask for help</Button>
        </div>}
      />

      <div className="mg-filter-row">
        <div className="mg-seg" role="group" aria-label="Show">
          {[['open', 'Open'], ['done', 'Fixed or closed'], ['all', 'All']].map(([key, label]) => (
            <button key={key} type="button" className={show === key ? 'is-on' : ''} aria-pressed={show === key} onClick={() => setShow(key)}>{label}<span>{counts[key]}</span></button>
          ))}
        </div>
        <div className="form-group mg-hidden-search"><input type="search" data-page-search="" aria-label="Search help requests" placeholder="Search help requests" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
      </div>

      <ReportTable loading={loading} rows={rows} rowKey={(t) => t._id}
        empty={show === 'open' ? 'Nothing open - everything you raised has been dealt with.' : 'No help requests yet.'}
        onRowClick={setViewing}
        columns={[
          { key: 'subject', label: 'Problem', render: (t) => <><div className="mg-name">{t.subject}</div><div className="mg-sub">{String(t.message || '').slice(0, 90)}{String(t.message || '').length > 90 ? '...' : ''}</div></> },
          { key: 'when', label: 'Raised', render: (t) => <span className="muted">{dateTimeLabel(t.createdAt)}</span> },
          { key: 'status', label: 'Status', render: (t) => <span className={`mg-pill ${STATUS[t.status]?.tone || ''}`}>{STATUS[t.status]?.label || t.status}</span> },
          { key: 'actions', label: '', align: 'right', render: (t) => (isAdmin && isOpen(t) ? (
            <span className="mg-row-actions" onClick={(e) => e.stopPropagation()}>
              <RowMenu items={[
                t.status === 'Open' && { label: 'Mark as being worked on', onClick: () => setStatus(t, 'InProgress') },
                { label: 'Mark as fixed', onClick: () => setStatus(t, 'Resolved') },
                { label: 'Close', onClick: () => setStatus(t, 'Closed') },
              ]} />
            </span>
          ) : null) },
        ]} />

      <Modal isOpen={open} onClose={() => setOpen(false)} variant="drawer" title="Ask for help"
        footer={<>
          <span className="mg-draft-note">Closing keeps what you typed.</span>
          <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="primary" onClick={submit} loading={saving}>Send</Button>
        </>}>
        <form className="mg-form" onSubmit={submit}>
          <div className="mg-form-section">
            <Input label="What is the problem? *" value={form.subject} onChange={(e) => setForm((s) => ({ ...s, subject: e.target.value }))} placeholder="e.g. Report PDF not opening" autoFocus />
            <div className="form-group">
              <label className="form-label" htmlFor="ticket-message">Tell us more *</label>
              <textarea id="ticket-message" className="form-control" value={form.message} onChange={(e) => setForm((s) => ({ ...s, message: e.target.value }))} placeholder="What were you doing, what did you expect, and what happened instead?" />
            </div>
          </div>
          {error && <p className="mg-error" role="alert">{error}</p>}
        </form>
      </Modal>

      <Modal isOpen={!!viewing} onClose={() => setViewing(null)} variant="drawer" title={viewing?.subject || 'Help request'}
        footer={isAdmin && viewing && isOpen(viewing) ? <>
          <Button variant="secondary" onClick={() => setStatus(viewing, 'Closed')}>Close</Button>
          <Button variant="primary" onClick={() => setStatus(viewing, 'Resolved')}>Mark as fixed</Button>
        </> : null}>
        {viewing && (
          <div className="mg-form">
            <div className="mg-form-section">
              <div><span className={`mg-pill ${STATUS[viewing.status]?.tone || ''}`}>{STATUS[viewing.status]?.label || viewing.status}</span> <span className="mg-sub">Raised {dateTimeLabel(viewing.createdAt)}</span></div>
              <div className="mg-preview">{viewing.message}</div>
              {viewing.meetLink && <p className="mg-sub">Call link: <a href={viewing.meetLink} target="_blank" rel="noreferrer">join</a></p>}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
