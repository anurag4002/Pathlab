import React, { useState, useEffect } from 'react';
import { getBrowsers, createBrowser, setBrowserStatus, deleteBrowser } from '../../services/setupService';
import formatDate from '../../utils/formatDate';
import { Plus, Ban, CheckCircle2, Trash2 } from 'lucide-react';
import { PageHeader, DataTable, StatusBadge, Button, Modal, Input } from '../../components/common';

const BrowserSecurity = () => {
  const [browsers, setBrowsers] = useState([]);
  const [logins, setLogins] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ code: '', label: '' });
  const [saving, setSaving] = useState(false);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const r = await getBrowsers();
      if (r.success) { setBrowsers(r.data?.browsers || []); setLogins(r.data?.recentLogins || []); }
    } catch (e) { console.error('browsers', e); } finally { setLoading(false); }
  };
  useEffect(() => { fetchAll(); }, []);

  const handleRegister = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      const payload = { label: form.label, ...(form.code.trim() ? { code: form.code.trim() } : {}) };
      const r = await createBrowser(payload);
      if (r.success) { setModal(false); setForm({ code: '', label: '' }); fetchAll(); }
    } catch (e) { alert(e.response?.data?.message || 'Register failed'); } finally { setSaving(false); }
  };
  const toggle = async (b) => {
    const next = b.status === 'Blocked' ? 'Active' : 'Blocked';
    try { const r = await setBrowserStatus(b._id || b.code, next); if (r.success) fetchAll(); } catch (e) { alert('Failed'); }
  };
  const remove = async (b) => {
    if (!window.confirm(`Delete browser ${b.code}?`)) return;
    try { const r = await deleteBrowser(b._id || b.code); if (r.success) fetchAll(); } catch (e) { alert('Delete failed'); }
  };

  return (
    <div>
      <PageHeader title="Browser Security" subtitle="Allow-listed browsers + recent login feed"
        action={<Button variant="primary" size="sm" onClick={() => setModal(true)}><Plus size={14} /> Register Browser</Button>} />
      <DataTable headers={['Code', 'Label', 'Status', 'Last Seen', 'Actions']} data={browsers} loading={loading} emptyMessage="No browsers registered."
        renderRow={(b, i) => (
          <tr key={b._id || i}>
            <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{b.code}</td>
            <td>{b.label || '-'}</td>
            <td><StatusBadge status={b.status} /></td>
            <td>{formatDate(b.lastSeen || b.updatedAt)}</td>
            <td><div style={{ display: 'flex', gap: 6 }}>
              <button className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '.72rem' }} onClick={() => toggle(b)} title={b.status === 'Blocked' ? 'Unblock' : 'Block'}>
                {b.status === 'Blocked' ? <CheckCircle2 size={13} /> : <Ban size={13} />} {b.status === 'Blocked' ? 'Unblock' : 'Block'}</button>
              <button className="btn btn-danger" style={{ padding: '4px 8px' }} onClick={() => remove(b)}><Trash2 size={13} /></button>
            </div></td>
          </tr>)} />
      <h3 style={{ margin: '1.5rem 0 .5rem' }}>Recent Logins</h3>
      <DataTable headers={['Date', 'User', 'Role', 'IP', 'User Agent', 'Action']} data={logins} loading={loading} emptyMessage="No login activity."
        renderRow={(l, i) => (
          <tr key={l._id || i}>
            <td>{formatDate(l.date || l.createdAt)}</td>
            <td style={{ fontWeight: 600 }}>{l.user?.name || l.email || l.userName || '-'}</td>
            <td><StatusBadge status={l.user?.role || l.role || '-'} /></td>
            <td style={{ fontFamily: 'monospace', fontSize: '.78rem' }}>{l.ip || '-'}</td>
            <td style={{ fontSize: '.75rem', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.userAgent || '-'}</td>
            <td>{l.action || l.description || '-'}</td>
          </tr>)} />
      <Modal isOpen={modal} onClose={() => setModal(false)} title="Register Browser"
        footer={<><Button variant="secondary" onClick={() => setModal(false)}>Cancel</Button><Button variant="primary" onClick={handleRegister} loading={saving}>Save</Button></>}>
        <form onSubmit={handleRegister} className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
          <Input label="Label" value={form.label} onChange={(e) => setForm(s => ({ ...s, label: e.target.value }))} placeholder="Front Desk PC" required />
          <Input label="Custom Code (blank = auto)" value={form.code} onChange={(e) => setForm(s => ({ ...s, code: e.target.value }))} placeholder="FRONT-DESK-01" helperText="Leave blank to auto-generate" />
        </form>
      </Modal>
    </div>
  );
};
export default BrowserSecurity;
