import React, { useState, useEffect } from 'react';
import { getCredits, topupCredits, getReviewRequests, sendReviewRequest, markReview } from '../../services/notifyService';
import { PageHeader, DataTable, Button, Modal, Input, StatCard } from '../../components/common';
import { Wallet, Star } from 'lucide-react';

const Reviews = () => {
  const [credits, setCredits] = useState({ balance: 0, history: [] });
  const [reqs, setReqs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [topOpen, setTopOpen] = useState(false);
  const [topForm, setTopForm] = useState({ credits: 100, note: '' });
  const [sendForm, setSendForm] = useState({ phone: '' });
  const load = async () => {
    setLoading(true);
    try {
      const [c, r] = await Promise.all([getCredits().catch(() => null), getReviewRequests().catch(() => null)]);
      if (c?.success) setCredits(c.data || { balance: 0, history: [] });
      if (r?.success) setReqs(r.data?.requests || r.data || []);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);
  const topup = async (e) => {
    e.preventDefault();
    try { const r = await topupCredits(Number(topForm.credits), topForm.note); if (r.success) { setTopOpen(false); load(); } } catch (e) { alert('Topup failed'); }
  };
  const send = async (e) => {
    e.preventDefault();
    // Phone-only: backend stores patient as ObjectId ref, a name string would fail validation.
    try { const r = await sendReviewRequest({ phone: sendForm.phone }); if (r.success) { setSendForm({ phone: '' }); load(); } } catch (e) { alert(e.response?.data?.message || 'Send failed'); }
  };
  const mark = async (id, status) => { try { await markReview(id, status); load(); } catch (e) { alert('Failed'); } };
  return (
    <div>
      <PageHeader title="Reviews & Credits" subtitle="Google review requests + SMS credits" action={<Button size="sm" onClick={() => setTopOpen(true)}>Topup Credits</Button>} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12, marginBottom: 16 }}>
        <StatCard title="Credit Balance" value={credits.balance ?? 0} icon={Wallet} />
        <StatCard title="Review Requests" value={reqs.length} icon={Star} />
      </div>
      <div className="card" style={{ padding: '1rem', marginBottom: 16 }}>
        <h4 style={{ margin: '0 0 8px' }}>Send Review Request</h4>
        <form onSubmit={send} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input className="form-control" style={{ maxWidth: 180 }} placeholder="Phone" value={sendForm.phone} onChange={(e) => setSendForm(s => ({ ...s, phone: e.target.value }))} required />
          <Button type="submit" size="sm">Send</Button>
        </form>
      </div>
      <DataTable headers={['Patient', 'Phone', 'Status', 'Actions']} data={reqs} loading={loading} emptyMessage="No review requests."
        renderRow={(q, i) => (<tr key={q._id || i}><td>{(q.patient && typeof q.patient === 'object' ? q.patient.name : q.patient) || '-'}</td><td>{q.phone}</td><td>{q.status}</td>
          <td style={{ display: 'flex', gap: 6 }}>
            <button className="btn btn-secondary" style={{ fontSize: '.72rem' }} onClick={() => mark(q._id, 'Clicked')}>Clicked</button>
            <button className="btn btn-secondary" style={{ fontSize: '.72rem' }} onClick={() => mark(q._id, 'Reviewed')}>Reviewed</button>
          </td></tr>)} />
      {(credits.history || []).length > 0 && (
        <><h4 style={{ margin: '1rem 0 .5rem' }}>Credit History</h4>
        <DataTable headers={['Date', 'Credits', 'Note']} data={credits.history} emptyMessage="No history"
          renderRow={(h, i) => (<tr key={i}><td>{h.date || h.createdAt || '-'}</td><td>{h.credits}</td><td>{h.note || '-'}</td></tr>)} /></>
      )}
      <Modal isOpen={topOpen} onClose={() => setTopOpen(false)} title="Topup Credits"
        footer={<><Button variant="secondary" onClick={() => setTopOpen(false)}>Cancel</Button><Button variant="primary" onClick={topup}>Topup</Button></>}>
        <form onSubmit={topup} className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
          <Input label="Credits" type="number" value={topForm.credits} onChange={(e) => setTopForm(s => ({ ...s, credits: e.target.value }))} required />
          <Input label="Note" value={topForm.note} onChange={(e) => setTopForm(s => ({ ...s, note: e.target.value }))} />
        </form>
      </Modal>
    </div>
  );
};
export default Reviews;
