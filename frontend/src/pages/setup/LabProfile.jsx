import React, { useState, useEffect } from 'react';
import { getLabProfile, updateLabProfile, uploadLogo, uploadLetterhead } from '../../services/setupService';
import { PageHeader, Button, Input } from '../../components/common';
import RegNumberConfig from './components/RegNumberConfig';
import BrandingForm from './components/BrandingForm';
import {
  Building2,
  Bell,
  FileUp,
  CheckCircle2,
  AlertCircle,
  Info,
  Save,
  Mail,
  MessageSquare,
  Send,
  ReceiptText,
} from 'lucide-react';
import './LabProfile.css';

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

const ProfileToggle = ({ label, sub, icon, val, on }) => (
  <label className={`lab-profile-switch ${val ? 'on' : ''}`}>
    <span className="lab-profile-switch-label">
      {icon}
      <span>
        {label}
        {sub && <span className="lab-profile-switch-sub">{sub}</span>}
      </span>
    </span>
    <span className="lab-profile-switch-track" aria-hidden="true">
      <span className="lab-profile-switch-thumb" />
    </span>
    <input type="checkbox" checked={!!val} onChange={(e) => on(e.target.checked)} />
  </label>
);

const LabProfile = () => {
  const [form, setForm] = useState({ name: '', address: '', phone: '', email: '', smsEnabled: true, whatsappEnabled: true, emailEnabled: true, showLetterheadByDefault: true, googleReviewLink: '', caseStartNumber: 1, website: '', registrationNumber: '', disclaimer: '', invoiceFooter: '' });
  const [logoPreview, setLogoPreview] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [msgType, setMsgType] = useState('info');
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
  const flash = (text, type = 'info') => { setMsg(text); setMsgType(type); };
  const save = async (e) => {
    e?.preventDefault?.(); setSaving(true); setMsg('');
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
      if (r.success) flash('Profile saved. Website, disclaimer and logo preview are kept on this device.', 'success');
      else flash(r.message || 'Saved.', 'success');
    } catch (e) { flash(e.response?.data?.message || 'Save failed. Please try again.', 'error'); } finally { setSaving(false); }
  };
  const up = async (file, fn) => {
    if (!file) return; flash('Uploading…', 'info');
    try {
      const r = await fn(file);
      if (r.success) {
        flash(r.message || 'Uploaded successfully.', 'success');
        // Refresh preview from server response when available.
        const url = r?.data?.url || r?.data?.logoUrl || r?.data?.letterheadUrl || r?.url;
        if (url) setLogoPreview(url);
      } else flash(r.message || 'Upload finished.', 'info');
    } catch (e) { flash(e.response?.data?.message || 'Upload failed. Please try again.', 'error'); }
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
  if (loading) {
    return (
      <div className="lab-profile-page">
        <PageHeader title="Lab Profile" subtitle="Centre details, uploads & preferences" />
        <div className="lab-profile-layout">
          <div className="lab-profile-main">
            {[0, 1].map((i) => (
              <div key={i} className="lab-profile-skeleton-card" aria-hidden="true">
                <div className="lab-profile-skeleton" style={{ height: 22, width: '40%' }} />
                <div className="lab-profile-skeleton" style={{ height: 40 }} />
                <div className="lab-profile-skeleton" style={{ height: 40 }} />
              </div>
            ))}
          </div>
          <div className="lab-profile-side">
            <div className="lab-profile-skeleton-card" aria-hidden="true">
              <div className="lab-profile-skeleton" style={{ height: 22, width: '55%' }} />
              <div className="lab-profile-skeleton" style={{ height: 120 }} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  const AlertIcon = msgType === 'success' ? CheckCircle2 : msgType === 'error' ? AlertCircle : Info;

  return (
    <div className="lab-profile-page">
      <PageHeader
        title="Lab Profile"
        subtitle="Centre details, report branding, registration numbers & notification preferences"
        action={
          <Button type="button" onClick={save} loading={saving} icon={<Save size={15} />}>
            Save Profile
          </Button>
        }
      />

      {msg && (
        <div className={`lab-profile-alert ${msgType}`} role="status">
          <AlertIcon size={17} />
          <span>{msg}</span>
        </div>
      )}

      <form onSubmit={save}>
        <div className="lab-profile-layout">
          <div className="lab-profile-main">
            {/* Centre details */}
            <section className="lab-profile-card" aria-label="Centre details">
              <div className="lab-profile-card-header">
                <span className="lab-profile-icon-box"><Building2 size={18} /></span>
                <div>
                  <h2 className="lab-profile-card-title">Centre Details</h2>
                  <p className="lab-profile-card-desc">Saved to the server. Shown on reports, invoices and patient messages.</p>
                </div>
              </div>
              <div className="lab-profile-grid">
                <Input label="Centre Name" value={form.name || ''} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Pure Path Lab" required />
                <Input label="Phone" value={form.phone || ''} onChange={(e) => set('phone', e.target.value)} placeholder="e.g. +91 98XXX XXXXX" />
                <Input label="Email" type="email" value={form.email || ''} onChange={(e) => set('email', e.target.value)} placeholder="lab@example.com" />
                <Input label="Google Review Link" value={form.googleReviewLink || ''} onChange={(e) => set('googleReviewLink', e.target.value)} placeholder="https://g.page/…" />
                <div className="lab-profile-full-row">
                  <Input label="Address" value={form.address || ''} onChange={(e) => set('address', e.target.value)} placeholder="Street, area, city, PIN" />
                </div>
              </div>
            </section>

            {/* Notifications */}
            <section className="lab-profile-card" aria-label="Notification preferences">
              <div className="lab-profile-card-header">
                <span className="lab-profile-icon-box"><Bell size={18} /></span>
                <div>
                  <h2 className="lab-profile-card-title">Notifications & Letterhead</h2>
                  <p className="lab-profile-card-desc">Control which channels are used for patient communication and reports.</p>
                </div>
              </div>
              <div className="lab-profile-toggle-grid">
                <ProfileToggle label="SMS" sub="Text alerts" icon={<MessageSquare size={15} />} val={form.smsEnabled} on={(v) => set('smsEnabled', v)} />
                <ProfileToggle label="WhatsApp" sub="Chat updates" icon={<Send size={15} />} val={form.whatsappEnabled} on={(v) => set('whatsappEnabled', v)} />
                <ProfileToggle label="Email" sub="Mail reports" icon={<Mail size={15} />} val={form.emailEnabled} on={(v) => set('emailEnabled', v)} />
                <ProfileToggle label="Letterhead" sub="On reports by default" icon={<ReceiptText size={15} />} val={form.showLetterheadByDefault} on={(v) => set('showLetterheadByDefault', v)} />
              </div>
            </section>

            {/* Uploads */}
            <section className="lab-profile-card" aria-label="Documents">
              <div className="lab-profile-card-header">
                <span className="lab-profile-icon-box"><FileUp size={18} /></span>
                <div>
                  <h2 className="lab-profile-card-title">Letterhead</h2>
                  <p className="lab-profile-card-desc">Upload the letterhead background used on printed reports.</p>
                </div>
              </div>
              <div className="lab-profile-upload-box">
                <span className="lab-profile-upload-title"><FileUp size={15} /> Letterhead image</span>
                <p className="lab-profile-upload-hint">PNG or JPG. It is uploaded straight to the server.</p>
                <input className="lab-profile-file-input" type="file" accept="image/*" onChange={(e) => up(e.target.files[0], uploadLetterhead)} />
              </div>
            </section>

            {/* Registration number config */}
            <RegNumberConfig startNumber={form.caseStartNumber} onStartNumberChange={(v) => set('caseStartNumber', v)} />
          </div>

          <div className="lab-profile-side">
            {/* Branding */}
            <BrandingForm form={form} set={set} logoPreview={logoPreview} setLogoPreview={persistLogoPreview} onLogoFile={handleLogoFile} />

            <div className="lab-profile-card">
              <div className="lab-profile-card-header">
                <span className="lab-profile-icon-box"><Save size={17} /></span>
                <div>
                  <h2 className="lab-profile-card-title">Save Changes</h2>
                  <p className="lab-profile-card-desc">Server fields save instantly; branding extras stay in this browser.</p>
                </div>
              </div>
              <Button type="submit" loading={saving} block icon={<Save size={15} />}>
                Save Profile
              </Button>
              <p className="lab-profile-note">Includes centre details, notification toggles, review link and start number.</p>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};
export default LabProfile;
