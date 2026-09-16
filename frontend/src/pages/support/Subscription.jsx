import React, { useState, useEffect } from 'react';
import { getSubscription, changePlan, requestRefund } from '../../services/supportService';
import { PageHeader, Button, Input, DataTable, StatusBadge } from '../../components/common';
import formatDate from '../../utils/formatDate';

const Subscription = () => {
  const [sub, setSub] = useState(null);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(false);
  const [gst, setGst] = useState({ gstNumber: '', gstName: '' });
  const load = async () => {
    setLoading(true);
    try {
      const r = await getSubscription();
      // Backend returns data = { subscription, plans } — never render raw objects.
      if (r.success && r.data) {
        setSub(r.data.subscription || null);
        setPlans(r.data.plans || []);
        setGst({ gstNumber: r.data.subscription?.gstNumber || '', gstName: r.data.subscription?.gstName || '' });
      }
    } catch (err) {
      console.error('Failed to load subscription', err);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);
  const change = async (planId) => {
    try { const r = await changePlan(planId, gst); if (r.success) load(); } catch (e) { alert(e.response?.data?.message || 'Failed'); }
  };
  const refund = async () => { if (!window.confirm('Request refund?')) return; try { await requestRefund(); load(); } catch (e) { alert('Failed'); } };
  if (loading) return <p>Loading...</p>;
  const plan = sub?.plan || {};
  return (
    <div>
      <PageHeader title="Subscription" subtitle="Plan, trial & billing caps" action={<Button size="sm" variant="secondary" onClick={refund}>Request Refund</Button>} />
      <div className="card" style={{ padding: '1rem', marginBottom: 16 }}>
        <p style={{ margin: 0 }}><b>Plan:</b> {plan.name || '-'} <StatusBadge status={sub?.status || 'Active'} /></p>
        <p style={{ fontSize: '.85rem' }}>
          Trial ends: {sub?.trialEndsAt ? formatDate(sub.trialEndsAt) : '-'} |
          Caps: {plan.yearlyCaseCap || '-'} cases/yr, {plan.dailyCourtesyCap || '-'} /day courtesy
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 8, marginTop: 8 }}>
          <Input label="GST Number" value={gst.gstNumber} onChange={(e) => setGst(s => ({ ...s, gstNumber: e.target.value }))} />
          <Input label="GST Name" value={gst.gstName} onChange={(e) => setGst(s => ({ ...s, gstName: e.target.value }))} />
        </div>
      </div>
      <DataTable headers={['Plan', 'Price', 'Yearly Cap', 'Action']} data={plans} emptyMessage="No plans listed."
        renderRow={(p, i) => (<tr key={p._id || p.id || i}><td style={{ fontWeight: 600 }}>{p.name || '-'}</td><td>{p.price ?? '-'}</td><td>{p.yearlyCaseCap ?? '-'}</td>
          <td><Button size="sm" onClick={() => change(p._id || p.id)}>Change Plan</Button></td></tr>)} />
    </div>
  );
};
export default Subscription;
