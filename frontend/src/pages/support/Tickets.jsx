import React, { useState, useEffect } from 'react';
import { getTickets, createTicket, setTicketStatus } from '../../services/supportService';
import { PageHeader, DataTable, Button, Modal, Input, StatusBadge } from '../../components/common';
import useClientPagination from '../../hooks/useClientPagination';
import useAuth from '../../hooks/useAuth';

const Tickets = () => {
  const { user } = useAuth();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const filtered = list.filter((t) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return String(t.subject || '').toLowerCase().includes(q) ||
      String(t.message || '').toLowerCase().includes(q) ||
      String(t.status || '').toLowerCase().includes(q);
  });
  const pg = useClientPagination(filtered, 10);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ subject: '', message: '', priority: 'Normal' });
  const isAdmin = user?.role === 'Admin';
  const load = async () => {
    setLoading(true);
    try { const r = await getTickets(); if (r.success) setList(r.data?.tickets || r.data || []); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);
  const create = async (e) => {
    e.preventDefault();
    try { const r = await createTicket(form); if (r.success) { setModal(false); setForm({ subject: '', message: '', priority: 'Normal' }); load(); } } catch (e) { alert('Failed'); }
  };
  const close = async (id) => { try { await setTicketStatus(id, { status: 'Closed' }); load(); } catch (e) { alert('Failed'); } };
  return (
    <div>
      <PageHeader title="Support Tickets" subtitle="Raise & track issues" action={<Button size="sm" onClick={() => setModal(true)}>New Ticket</Button>} />
      <DataTable headers={['Subject', 'Priority', 'Status', 'Action']} data={pg.paged} loading={loading} emptyMessage="No tickets."
        searchValue={search}
        onSearchChange={(e) => { setSearch(e.target.value); pg.reset(); }}
        searchPlaceholder="Search tickets…"
        pagination={{
          total: pg.total,
          page: pg.page,
          limit: pg.limit,
          pages: pg.pages,
          onPageChange: pg.goToPage,
          onLimitChange: pg.setLimit,
        }}
        renderRow={(t, i) => (<tr key={t._id || i}><td style={{ fontWeight: 600 }}>{t.subject}<div style={{ fontWeight: 400, fontSize: '.78rem' }}>{(t.message || '').slice(0, 80)}</div></td>
          <td>{t.priority || '-'}</td><td><StatusBadge status={t.status} /></td>
          <td>{isAdmin && t.status !== 'Closed' ? <button className="btn btn-secondary" style={{ fontSize: '.72rem' }} onClick={() => close(t._id)}>Close</button> : '-'}</td></tr>)} />
      <Modal isOpen={modal} onClose={() => setModal(false)} title="New Ticket"
        footer={<><Button variant="secondary" onClick={() => setModal(false)}>Cancel</Button><Button variant="primary" onClick={create}>Submit</Button></>}>
        <form onSubmit={create} className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
          <Input label="Subject" value={form.subject} onChange={(e) => setForm(s => ({ ...s, subject: e.target.value }))} required />
          <label className="form-label">Message</label>
          <textarea className="form-control" rows={4} value={form.message} onChange={(e) => setForm(s => ({ ...s, message: e.target.value }))} required />
          <Input label="Priority" value={form.priority} onChange={(e) => setForm(s => ({ ...s, priority: e.target.value }))} />
        </form>
      </Modal>
    </div>
  );
};
export default Tickets;
