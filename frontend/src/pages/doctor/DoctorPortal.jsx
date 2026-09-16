import React, { useState, useEffect } from 'react';
import { getMyCases } from '../../services/doctorPortalService';
import { PageHeader, DataTable, StatCard } from '../../components/common';
import { FileText, Radio, Layers } from 'lucide-react';
import formatDate from '../../utils/formatDate';

const DoctorPortal = () => {
  const [data, setData] = useState({ bills: [], usg: [], xray: [], summary: {} });
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    (async () => {
      setLoading(true);
      try { const r = await getMyCases(); if (r.success) setData({ bills: r.data?.bills || [], usg: r.data?.usg || [], xray: r.data?.xray || [], summary: r.data?.summary || {} }); }
      finally { setLoading(false); }
    })();
  }, []);
  return (
    <div>
      <PageHeader title="My Cases" subtitle="Doctor portal — referred cases" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 12, marginBottom: 16 }}>
        <StatCard title="Bills" value={data.summary?.bills ?? data.bills.length} icon={FileText} />
        <StatCard title="USG" value={data.summary?.usg ?? data.usg.length} icon={Radio} />
        <StatCard title="X-Ray" value={data.summary?.xray ?? data.xray.length} icon={Layers} />
      </div>
      <h4>Bills</h4>
      <DataTable headers={['Date', 'Patient', 'Amount', 'Status']} data={data.bills} loading={loading} emptyMessage="No bill cases."
        renderRow={(b, i) => (<tr key={b._id || i}><td>{formatDate(b.date || b.createdAt)}</td><td>{(b.patient && typeof b.patient === 'object' ? b.patient.name : b.patient) || '-'}</td><td>{b.totalAmount ?? b.total ?? b.amount ?? '-'}</td><td>{b.paymentStatus || b.status || '-'}</td></tr>)} />
      <h4 style={{ marginTop: 16 }}>USG</h4>
      <DataTable headers={['Date', 'Patient', 'Study', 'Status']} data={data.usg} loading={loading} emptyMessage="No USG cases."
        renderRow={(u, i) => (<tr key={u._id || i}><td>{formatDate(u.date || u.createdAt)}</td><td>{(u.patient && typeof u.patient === 'object' ? u.patient.name : u.patientName) || '-'}</td><td>{u.templateName || u.procedure || '-'}</td><td>{u.status || '-'}</td></tr>)} />
      <h4 style={{ marginTop: 16 }}>X-Ray</h4>
      <DataTable headers={['Date', 'Patient', 'Study', 'Status']} data={data.xray} loading={loading} emptyMessage="No X-Ray cases."
        renderRow={(x, i) => (<tr key={x._id || i}><td>{formatDate(x.date || x.createdAt)}</td><td>{(x.patient && typeof x.patient === 'object' ? x.patient.name : x.patientName) || '-'}</td><td>{x.procedure || 'X-Ray Study'}</td><td>{x.status || '-'}</td></tr>)} />
    </div>
  );
};
export default DoctorPortal;
