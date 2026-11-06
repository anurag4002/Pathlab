import React, { useEffect, useMemo, useState } from 'react';
import { Plus, RefreshCw } from 'lucide-react';
import { getBrowsers, createBrowser, setBrowserStatus, deleteBrowser } from '../../../services/setupService';
import { PageHeader, Button, Modal, Input, ConfirmDialog, RowMenu, StatGroup } from '../../../components/common';
import ReportTable from '../../../components/business/ReportTable';
import { notify } from '../../../components/common/Toast/toast';
import { dateTimeLabel } from '../../../utils/reportFormat';
import useDraft from './useDraft';
import { plainAction } from '../../settings/v2/AuditLogV2';
import '../../../components/business/business.css';
import './manage.css';

// "Mozilla/5.0 (Windows NT 10.0...) Chrome/120" -> "Chrome on Windows"
export const deviceLabel = (ua = '') => {
  const s = String(ua);
  if (!s) return 'Unknown device';
  const browser = /Edg\//.test(s) ? 'Edge' : /OPR\//.test(s) ? 'Opera' : /Chrome\//.test(s) ? 'Chrome' : /Firefox\//.test(s) ? 'Firefox' : /Safari\//.test(s) ? 'Safari' : 'Browser';
  const os = /Windows/.test(s) ? 'Windows' : /Android/.test(s) ? 'Android phone' : /iPhone|iPad/.test(s) ? 'iPhone / iPad' : /Mac OS/.test(s) ? 'Mac' : /Linux/.test(s) ? 'Linux' : '';
  return os ? `${browser} on ${os}` : browser;
};

// Approved computers (new look): which computers may open the lab software,
// and who signed in recently.
export default function BrowserSecurityV2() {
  const [browsers, setBrowsers] = useState([]);
  const [logins, setLogins] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm, clearForm] = useDraft('browser-new', { label: '', code: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState(null); // { kind: 'block'|'delete', b }
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const r = await getBrowsers();
      if (r.success) { setBrowsers(r.data?.browsers || []); setLogins(r.data?.recentLogins || []); }
    } catch { notify('Could not load approved computers.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const q = search.trim().toLowerCase();
  const rows = useMemo(() => browsers.filter((b) => !q || `${b.label} ${b.code}`.toLowerCase().includes(q)), [browsers, q]);
  const loginRows = useMemo(() => logins.filter((l) => !q || `${l.user?.name || l.email || l.userName || ''} ${l.ip || ''}`.toLowerCase().includes(q)), [logins, q]);

  const register = async (e) => {
    e?.preventDefault();
    if (!form.label.trim()) { setError('Give this computer a name people recognise, e.g. "Front desk PC".'); return; }
    setSaving(true); setError('');
    try {
      const r = await createBrowser({ label: form.label.trim(), ...(form.code.trim() ? { code: form.code.trim() } : {}) });
      if (r.success) { clearForm(); setOpen(false); notify('Computer approved'); load(); }
    } catch (err) { setError(err.response?.data?.message || 'Could not approve this computer.'); }
    finally { setSaving(false); }
  };
  const runConfirm = async () => {
    const { kind, b } = confirm;
    setBusy(true);
    try {
      if (kind === 'delete') { const r = await deleteBrowser(b._id || b.code); if (r.success) notify('Computer removed'); }
      else { const next = b.status === 'Blocked' ? 'Active' : 'Blocked'; const r = await setBrowserStatus(b._id || b.code, next); if (r.success) notify(next === 'Blocked' ? 'Computer blocked' : 'Computer allowed again'); }
      load();
    } catch { notify('Could not update. Try again.'); }
    finally { setBusy(false); setConfirm(null); }
  };
  const unblock = async (b) => {
    try { const r = await setBrowserStatus(b._id || b.code, 'Active'); if (r.success) { notify('Computer allowed again'); load(); } } catch { notify('Could not update. Try again.'); }
  };

  const blocked = browsers.filter((b) => b.status === 'Blocked').length;
  return (
    <div className="biz-page">
      <PageHeader
        title="Approved computers"
        subtitle="Only the computers listed here can open the lab software. Block one if it is lost or no longer used."
        action={<div className="biz-actions">
          <Button variant="secondary" size="sm" icon={<RefreshCw size={14} />} onClick={load}>Refresh</Button>
          <Button variant="primary" size="sm" icon={<Plus size={14} />} onClick={() => { setError(''); setOpen(true); }}>Approve a computer</Button>
        </div>}
      />
      <div className="form-group mg-hidden-search" style={{ display: 'none' }}><input type="search" data-page-search="" aria-label="Search computers or sign-ins" placeholder="Computer, person or IP" value={search} onChange={(e) => setSearch(e.target.value)} /></div>

      <StatGroup loading={loading} items={[
        { label: 'Approved', value: String(browsers.length - blocked) },
        { label: 'Blocked', value: String(blocked), tone: blocked ? 'warning' : undefined },
        { label: 'Recent sign-ins', value: String(logins.length) },
      ]} />

      <section className="biz-section">
        <div className="biz-section-head"><h2>Computers</h2></div>
        <ReportTable loading={loading} rows={rows} rowKey={(b) => b._id || b.code} empty="No computers approved yet."
          columns={[
            { key: 'name', label: 'Computer', render: (b) => <><div className="mg-name">{b.label || 'Unnamed computer'}</div><div className="mg-sub" style={{ fontFamily: 'ui-monospace, Consolas, monospace' }}>{b.code}</div></> },
            { key: 'status', label: 'Status', render: (b) => <span className={`mg-pill ${b.status === 'Blocked' ? 'is-bad' : 'is-good'}`}>{b.status === 'Blocked' ? 'Blocked' : 'Allowed'}</span> },
            { key: 'seen', label: 'Last used', render: (b) => <span className="muted">{dateTimeLabel(b.lastSeen || b.updatedAt) || 'Never'}</span> },
            { key: 'act', label: '', align: 'right', render: (b) => (
              <span className="mg-row-actions">
                {b.status === 'Blocked'
                  ? <Button variant="secondary" size="sm" onClick={() => unblock(b)}>Allow again</Button>
                  : <Button variant="secondary" size="sm" onClick={() => setConfirm({ kind: 'block', b })}>Block</Button>}
                <RowMenu items={[{ label: 'Remove from list', danger: true, onClick: () => setConfirm({ kind: 'delete', b }) }]} />
              </span>
            ) },
          ]} />
      </section>

      <section className="biz-section">
        <div className="biz-section-head"><h2>Recent sign-ins</h2><p>Who opened the software, from where.</p></div>
        <ReportTable loading={loading} rows={loginRows} rowKey={(l, i) => l._id || i} empty="No sign-ins yet."
          columns={[
            { key: 'when', label: 'When', render: (l) => <span className="muted">{dateTimeLabel(l.date || l.createdAt)}</span> },
            { key: 'who', label: 'Who', render: (l) => <><div className="mg-name">{l.user?.name || l.email || l.userName || 'Unknown'}</div>{(l.user?.role || l.role) && <div className="mg-sub">{l.user?.role || l.role}</div>}</> },
            { key: 'device', label: 'Device', render: (l) => deviceLabel(l.userAgent) },
            { key: 'ip', label: 'Network address', render: (l) => <span className="mg-sub">{l.ip || '-'}</span> },
            { key: 'what', label: 'What', render: (l) => <span className="mg-sub" style={{ color: '#3f3f46' }}>{l.action ? plainAction(l.action) : (l.description || 'Signed in')}</span> },
          ]} />
      </section>

      <Modal isOpen={open} onClose={() => setOpen(false)} variant="drawer" title="Approve a computer"
        footer={<>
          <span className="mg-draft-note">Closing keeps what you typed.</span>
          <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="primary" onClick={register} loading={saving}>Approve</Button>
        </>}>
        <form className="mg-form" onSubmit={register}>
          <div className="mg-form-section">
            <Input label="Computer name *" value={form.label} onChange={(e) => setForm((s) => ({ ...s, label: e.target.value }))} placeholder="e.g. Front desk PC" autoFocus />
            <Input label="Code (optional)" value={form.code} onChange={(e) => setForm((s) => ({ ...s, code: e.target.value }))} placeholder="Leave empty to create one" />
            <p className="mg-help">The code is entered once on that computer to approve it.</p>
          </div>
          {error && <p className="mg-error" role="alert">{error}</p>}
        </form>
      </Modal>

      <ConfirmDialog isOpen={!!confirm} onClose={() => setConfirm(null)} onConfirm={runConfirm} loading={busy}
        title={confirm?.kind === 'delete' ? 'Remove this computer?' : 'Block this computer?'}
        message={confirm?.kind === 'delete'
          ? `${confirm?.b?.label || 'This computer'} will be removed from the list and will need to be approved again.`
          : `${confirm?.b?.label || 'This computer'} will not be able to open the lab software until you allow it again.`}
        confirmText={confirm?.kind === 'delete' ? 'Remove' : 'Block'} />
    </div>
  );
}
