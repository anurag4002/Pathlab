import React from 'react';
import { Input } from '../../../components/common';
import LogoUploader from './LogoUploader';
import { Palette } from 'lucide-react';

// Phase 24 — branding form: website / registration no. / disclaimer +
// logo preview. Backend accept-list gap: the server only accepts its
// allow-listed keys, so website/disclaimer/logo-preview extras are kept in
// localStorage until the backend accepts `website`, `disclaimer`, `logoUrl`.
const BrandingForm = ({ form, set, logoPreview, setLogoPreview, onLogoFile }) => (
  <section className="lab-profile-card" aria-label="Report branding">
    <div className="lab-profile-card-header">
      <span className="lab-profile-icon-box"><Palette size={18} /></span>
      <div>
        <h2 className="lab-profile-card-title">Report Branding</h2>
        <p className="lab-profile-card-desc">
          Website, registration no., disclaimer and logo preview are kept on this device.
        </p>
      </div>
    </div>
    <div className="lab-profile-grid" style={{ gridTemplateColumns: '1fr' }}>
      <Input label="Website (URL)" value={form.website || ''} onChange={(e) => set('website', e.target.value)} placeholder="https://…" inputMode="url" />
      <Input label="Registration No." value={form.registrationNumber || ''} onChange={(e) => set('registrationNumber', e.target.value)} placeholder="e.g. DL-REG-12345" />
    </div>
    <div className="form-group" style={{ marginBottom: 0 }}>
      <label className="form-label" htmlFor="branding-disclaimer">
        <span>Report footer / disclaimer</span>
      </label>
      <textarea
        id="branding-disclaimer"
        className="lab-profile-textarea"
        rows={3}
        value={form.disclaimer || form.invoiceFooter || ''}
        onChange={(e) => { set('disclaimer', e.target.value); set('invoiceFooter', e.target.value); }}
        placeholder="e.g. Report must be clinically correlated…"
      />
    </div>
    <LogoUploader value={logoPreview} onPreview={setLogoPreview} onFile={onLogoFile} />
  </section>
);

export default BrandingForm;
