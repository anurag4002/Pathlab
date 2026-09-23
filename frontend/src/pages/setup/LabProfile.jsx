import React, { useState, useEffect } from 'react';
import { getLabProfile, updateLabProfile, uploadLogo, uploadLetterhead } from '../../services/setupService';
import { PageHeader, Button, Input } from '../../components/common';
import RegNumberConfig from './components/RegNumberConfig';
import BrandingForm from './components/BrandingForm';

const BRANDING_LS_KEY = 'ppl_branding';

// Phase 23/24 — Lab profile with registration-number config + branding.
// Backend gaps (documented, not worked around by faking):
// - PUT /api/setup/lab-profile accepts ONLY its allow-list
//   (labName, tagline, phone, address, email, letterheadTopMargin,
//   showLetterheadByDefault, smsEnabled, whatsappEnabled, emailEnabled,
//   smsSenderId, googleReviewLink, caseStartNumber). registrationPrefix,
//   dateFormat, website, disclaimer/logoUrl are NOT accepted.
// - Prefix/format + website/disclaimer/logo-preview extras persist to
//   localStorage until the backend accepts them.
// - Key mapping: the form uses friendly keys (name/phone/email) mapped to
//   server keys (labName/phone/email) on save, and back on load.
const loadBrandingLocal = () => {
  try {
    return JSON.parse(localStorage.getItem(BRANDING_LS_KEY) || '{}');
  } catch (e) {
    return {};
  }
};

const LabProfile = () => {
  const [form, setForm] = useState({ name: '', address: '', phone: '', email: '', smsEnabled: true, whatsappEnabled: true, emailEnabled: true, showLetterheadByDefault: true, googleReviewLink: '', caseStartNumber: 1, website: '', registrationNumber: '', disclaimer: '', invoiceFooter: '' });
  const [logoPreview, setLogoPreview] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const r = await getLabProfile();
        const profile = r?.data?.profile || r?.data || {};
        const local = loadBrandingLocal();
        setForm((s) => ({
          ...s,
          name: profile.labName ?? s.name,
          address: profile.address ?? s.address,
          phone: profile.phone ?? s.phone,
          email: profile.email ?? s.email,
          smsEnabled: profile.smsEnabled ?? s.smsEnabled,
          whatsappEnabled: profile.whatsappEnabled ?? s.whatsappEnabled,
          emailEnabled: profile.emailEnabled ?? s.emailEnabled,
          showLetterheadByDefault: profile.showLetterheadByDefault ?? s.showLetterheadByDefault,
          googleReviewLink: profile.googleReviewLink ?? s.googleReviewLink,
          caseStartNumber: profile.caseStartNumber ?? s.caseStartNumber,
          website: local.website || '',
          registrationNumber: profile.registrationNumber || local.registrationNumber || '',
          disclaimer: local.disclaimer || profile.invoiceFooter || '',
          invoiceFooter: profile.invoiceFooter || local.disclaimer || '',
        }));
        if (profile.logoUrl) setLogoPreview(profile.logoUrl);
        else if (local.logoPreview) setLogoPreview(local.logoPreview);
      } catch (e) { console.error(e); } finally { setLoading(false); }
    })();
  }, []);
  const set = (k, v) => setForm((s) => ({ ...s, [k]: v }));
  const save = async (e) => {
    e.preventDefault(); setSaving(true); setMsg('');
    try {
      // Server-accepted keys only (mapped); extras go to localStorage.
      const serverPatch = {
        labName: form.name,
        address: form.address,
        phone: form.phone,
        email: form.email,
        smsEnabled: form.smsEnabled,
        whatsappEnabled: form.whatsappEnabled,
        emailEnabled: form.emailEnabled,
        showLetterheadByDefault: form.showLetterheadByDefault,
        googleReviewLink: form.googleReviewLink,
        caseStartNumber: Number(form.caseStartNumber) || 1,
      };
      const r = await updateLabProfile(serverPatch);
      try {
        localStorage.setItem(BRANDING_LS_KEY, JSON.stringify({
          website: form.website || '',
          registrationNumber: form.registrationNumber || '',
          disclaimer: form.disclaimer || form.invoiceFooter || '',
          logoPreview: logoPreview && !logoPreview.startsWith('blob:') ? logoPreview : (loadBrandingLocal().logoPreview || ''),
        }));
      } catch (e2) { /* ignore */ }
      if (r.success) setMsg('Saved. Note: website/disclaimer/logo-preview extras are kept in this browser until the server accept-list supports them.');
    } catch (e) { setMsg(e.response?.data?.message || 'Save failed'); } finally { setSaving(false); }
  };
  const up = async (file, fn) => {
    if (!file) return; setMsg('Uploading...');
    try { const r = await fn(file); if (r.success) setMsg(r.message || 'Uploaded.'); } catch (e) { setMsg('Upload failed'); }
  };
  const handleLogoFile = (file) => {
    // Real logo upload endpoint exists (POST /api/setup/lab-profile/logo);
    // try it, but keep the instant local preview regardless.
    if (file) up(file, uploadLogo);
  };
  const persistLogoPreview = (url) => {
    setLogoPreview(url);
    try {
      const cur = loadBrandingLocal();
      localStorage.setItem(BRANDING_LS_KEY, JSON.stringify({ ...cur, logoPreview: url && !url.startsWith('blob:') ? url : cur.logoPreview || '' }));
    } catch (e) { /* ignore */ }
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
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <Toggle label="SMS" val={form.smsEnabled} on={(v) => set('smsEnabled', v)} />
          <Toggle label="WhatsApp" val={form.whatsappEnabled} on={(v) => set('whatsappEnabled', v)} />
          <Toggle label="Email" val={form.emailEnabled} on={(v) => set('emailEnabled', v)} />
          <Toggle label="Letterhead by default" val={form.showLetterheadByDefault} on={(v) => set('showLetterheadByDefault', v)} />
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <label style={{ fontSize: '.82rem' }}>Letterhead: <input type="file" accept="image/*" onChange={(e) => up(e.target.files[0], uploadLetterhead)} /></label>
        </div>
        <div><Button type="submit" loading={saving}>Save Profile</Button></div>
      </form>
      {/* Phase 23 — prefix/format preview; start number binds to the server field above. */}
      <RegNumberConfig startNumber={form.caseStartNumber} onStartNumberChange={(v) => set('caseStartNumber', v)} />
      {/* Phase 24 — website / reg.no. / disclaimer + logo preview (localStorage fallback documented inside). */}
      <BrandingForm form={form} set={set} logoPreview={logoPreview} setLogoPreview={persistLogoPreview} onLogoFile={handleLogoFile} />
    </div>
  );
};
export default LabProfile;
