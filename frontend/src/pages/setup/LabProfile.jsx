import React, { useState, useEffect } from 'react';
import { getLabProfile, updateLabProfile, uploadLogo, uploadLetterhead } from '../../services/setupService';
import { PageHeader, Button, Input } from '../../components/common';

const LabProfile = () => {
  const [form, setForm] = useState({ name: '', address: '', phone: '', email: '', smsEnabled: true, whatsappEnabled: true, emailEnabled: true, showLetterheadByDefault: true, googleReviewLink: '', caseStartNumber: 1 });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  useEffect(() => {
    (async () => {
      setLoading(true);
      try { const r = await getLabProfile(); if (r.success) setForm(s => ({ ...s, ...(r.data?.profile || r.data || {}) })); }
      catch (e) { console.error(e); } finally { setLoading(false); }
    })();
  }, []);
  const set = (k, v) => setForm(s => ({ ...s, [k]: v }));
  const save = async (e) => {
    e.preventDefault(); setSaving(true); setMsg('');
    try { const r = await updateLabProfile(form); if (r.success) setMsg(r.message || 'Saved.'); }
    catch (e) { setMsg(e.response?.data?.message || 'Save failed'); } finally { setSaving(false); }
  };
  const up = async (file, fn) => {
    if (!file) return; setMsg('Uploading...');
    try { const r = await fn(file); if (r.success) setMsg(r.message || 'Uploaded.'); } catch (e) { setMsg('Upload failed'); }
  };
  const Toggle = ({ label, val, on }) => (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '.85rem' }}><input type="checkbox" checked={!!val} onChange={(e) => on(e.target.checked)} /> {label}</label>
  );
  if (loading) return <p>Loading...</p>;
  return (
    <div>
      <PageHeader title="Lab Profile" subtitle="Centre details, uploads & preferences" />
      {msg && <p style={{ fontSize: '.85rem' }}>{msg}</p>}
      <form onSubmit={save} className="form-grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 12 }}>
        <Input label="Centre Name" value={form.name || ''} onChange={(e) => set('name', e.target.value)} />
        <Input label="Phone" value={form.phone || ''} onChange={(e) => set('phone', e.target.value)} />
        <Input label="Email" value={form.email || ''} onChange={(e) => set('email', e.target.value)} />
        <Input label="Address" value={form.address || ''} onChange={(e) => set('address', e.target.value)} />
        <Input label="Google Review Link" value={form.googleReviewLink || ''} onChange={(e) => set('googleReviewLink', e.target.value)} />
        <Input label="Case Start Number" type="number" value={form.caseStartNumber ?? 1} onChange={(e) => set('caseStartNumber', Number(e.target.value))} />
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <Toggle label="SMS" val={form.smsEnabled} on={(v) => set('smsEnabled', v)} />
          <Toggle label="WhatsApp" val={form.whatsappEnabled} on={(v) => set('whatsappEnabled', v)} />
          <Toggle label="Email" val={form.emailEnabled} on={(v) => set('emailEnabled', v)} />
          <Toggle label="Letterhead by default" val={form.showLetterheadByDefault} on={(v) => set('showLetterheadByDefault', v)} />
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <label style={{ fontSize: '.82rem' }}>Logo: <input type="file" accept="image/*" onChange={(e) => up(e.target.files[0], uploadLogo)} /></label>
          <label style={{ fontSize: '.82rem' }}>Letterhead: <input type="file" accept="image/*" onChange={(e) => up(e.target.files[0], uploadLetterhead)} /></label>
        </div>
        <div><Button type="submit" loading={saving}>Save Profile</Button></div>
      </form>
    </div>
  );
};
export default LabProfile;
