import React, { useState, useEffect } from 'react';
import { getTemplates, saveTemplate } from '../../services/notifyService';
import { PageHeader, DataTable, Button, Modal, Input } from '../../components/common';
import useClientPagination from '../../hooks/useClientPagination';
import { Edit2 } from 'lucide-react';

const Templates = () => {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const filtered = list.filter((t) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return String(t.key || '').toLowerCase().includes(q) ||
      String(t.channel || '').toLowerCase().includes(q) ||
      String(t.body || t.content || '').toLowerCase().includes(q);
  });
  const pg = useClientPagination(filtered, 10);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ key: '', channel: 'sms', body: '' });
  const [saving, setSaving] = useState(false);
  const load = async () => {
    setLoading(true);
    try { const r = await getTemplates(); if (r.success) setList(r.data?.templates || r.data || []); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);
  const open = (t) => { setForm(t ? { key: t.key, channel: t.channel || 'sms', body: t.body || t.content || '' } : { key: '', channel: 'sms', body: '' }); setModal(true); };
  const save = async (e) => {
    e.preventDefault(); setSaving(true);
    try { const r = await saveTemplate(form); if (r.success) { setModal(false); load(); } } catch (e) { alert('Save failed'); } finally { setSaving(false); }
  };
  return (
    <div>
      <PageHeader title="Message Templates" subtitle="SMS / WhatsApp / Email templates" action={<Button size="sm" onClick={() => open(null)}>New Template</Button>} />
      <DataTable headers={['Key', 'Channel', 'Body', 'Action']} data={pg.paged} loading={loading} emptyMessage="No templates."
        searchValue={search}
        onSearchChange={(e) => { setSearch(e.target.value); pg.reset(); }}
        searchPlaceholder="Search templates…"
        pagination={{
          total: pg.total,
          page: pg.page,
          limit: pg.limit,
          pages: pg.pages,
          onPageChange: pg.goToPage,
          onLimitChange: pg.setLimit,
        }}
        renderRow={(t, i) => (<tr key={t._id || i}><td style={{ fontWeight: 600 }}>{t.key}</td><td>{t.channel}</td>
          <td style={{ maxWidth: 320, fontSize: '.8rem' }}>{(t.body || t.content || '').slice(0, 100)}</td>
          <td><button className="btn btn-secondary" style={{ padding: '4px 8px' }} onClick={() => open(t)}><Edit2 size={13} /></button></td></tr>)} />
      <Modal isOpen={modal} onClose={() => setModal(false)} title="Edit Template"
        footer={<><Button variant="secondary" onClick={() => setModal(false)}>Cancel</Button><Button variant="primary" onClick={save} loading={saving}>Save</Button></>}>
        <form onSubmit={save} className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
          <Input label="Key" value={form.key} onChange={(e) => setForm(s => ({ ...s, key: e.target.value }))} required />
          <Input label="Channel (sms/whatsapp/email)" value={form.channel} onChange={(e) => setForm(s => ({ ...s, channel: e.target.value }))} required />
          <label className="form-label">Body</label>
          <textarea className="form-control" rows={5} value={form.body} onChange={(e) => setForm(s => ({ ...s, body: e.target.value }))} required />
        </form>
      </Modal>
    </div>
  );
};
export default Templates;
