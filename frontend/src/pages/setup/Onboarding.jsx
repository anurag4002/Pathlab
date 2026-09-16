import React, { useState, useEffect } from 'react';
import { getOnboarding, setOnboardingStep, getSignatures, createSignature, deleteSignature } from '../../services/setupService';
import { PageHeader, Button, DataTable, Input } from '../../components/common';
import { Trash2 } from 'lucide-react';

const Onboarding = () => {
  const [data, setData] = useState({ percent: 0, steps: [] });
  const [sigs, setSigs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sigForm, setSigForm] = useState({ name: '', title: '', file: null });
  const load = async () => {
    setLoading(true);
    try {
      const [o, s] = await Promise.all([getOnboarding().catch(() => null), getSignatures().catch(() => null)]);
      if (o?.success) setData(o.data || { percent: 0, steps: [] });
      if (s?.success) setSigs(s.data?.signatures || s.data || []);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);
  const toggle = async (key, done) => { try { await setOnboardingStep(key, !done); load(); } catch (e) { alert('Failed'); } };
  const uploadSig = async (e) => {
    e.preventDefault();
    if (!sigForm.file) return alert('Choose file');
    const fd = new FormData(); fd.append('file', sigForm.file); fd.append('name', sigForm.name); fd.append('title', sigForm.title);
    try { const r = await createSignature(fd); if (r.success) { setSigForm({ name: '', title: '', file: null }); load(); } }
    catch (e) { alert('Upload failed'); }
  };
  const del = async (id) => { if (!window.confirm('Delete signature?')) return; try { await deleteSignature(id); load(); } catch (e) { alert('Failed'); } };
  const steps = data.steps || data.checklist || [];
  const pct = data.percent ?? data.completion ?? 0;
  return (
    <div>
      <PageHeader title="Onboarding" subtitle="Setup checklist & signatures" />
      <div className="card" style={{ padding: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.85rem' }}><b>Progress</b><span>{pct}%</span></div>
        <div style={{ height: 8, background: '#e2e8f0', borderRadius: 4, marginTop: 6 }}><div style={{ width: `${pct}%`, height: '100%', background: 'var(--primary-color,#2563eb)', borderRadius: 4 }} /></div>
        {steps.map((s, i) => (
          <label key={s.key || i} style={{ display: 'flex', gap: 8, fontSize: '.85rem', marginTop: 8 }}>
            <input type="checkbox" checked={!!s.done} onChange={() => toggle(s.key, s.done)} /> {s.label || s.key}
          </label>
        ))}
      </div>
      <h3>Signatures</h3>
      <form onSubmit={uploadSig} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <input className="form-control" style={{ maxWidth: 180 }} placeholder="Name" value={sigForm.name} onChange={(e) => setSigForm(s => ({ ...s, name: e.target.value }))} required />
        <input className="form-control" style={{ maxWidth: 180 }} placeholder="Title" value={sigForm.title} onChange={(e) => setSigForm(s => ({ ...s, title: e.target.value }))} />
        <input type="file" accept="image/*" onChange={(e) => setSigForm(s => ({ ...s, file: e.target.files[0] }))} />
        <Button type="submit" size="sm">Upload</Button>
      </form>
      <DataTable headers={['Name', 'Title', 'Preview', 'Action']} data={sigs} loading={loading} emptyMessage="No signatures."
        renderRow={(g, i) => (<tr key={g._id || i}><td>{g.name}</td><td>{g.title || '-'}</td>
          <td>{g.url || g.imageUrl ? <img src={g.url || g.imageUrl} alt="" style={{ height: 32 }} /> : '-'}</td>
          <td><button className="btn btn-danger" style={{ padding: '4px 8px' }} onClick={() => del(g._id)}><Trash2 size={13} /></button></td></tr>)} />
    </div>
  );
};
export default Onboarding;
