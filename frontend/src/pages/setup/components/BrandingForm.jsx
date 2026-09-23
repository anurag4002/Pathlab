import React from 'react';
import { Input } from '../../../components/common';
import LogoUploader from './LogoUploader';

// Phase 24 — branding form: website / registration no. / disclaimer +
// logo preview. Backend accept-list gap: the server only accepts its
// allow-listed keys, so website/disclaimer/logo-preview extras are kept in
// localStorage until the backend accepts `website`, `disclaimer`, `logoUrl`.
const BrandingForm = ({ form, set, logoPreview, setLogoPreview, onLogoFile }) => (
  <div className="card" style={{ padding: '1rem', marginTop: '1rem' }}>
    <h4 style={{ fontWeight: 700, marginBottom: '4px' }}>Report Branding</h4>
    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
      Lab name, address, phone and email save to the server. Website, disclaimer and logo preview
      are stored in this browser until the server accept-list supports them.
    </p>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: '12px' }}>
      <Input label="Website (URL)" value={form.website || ''} onChange={(e) => set('website', e.target.value)} placeholder="https://…" />
      <Input label="Registration No." value={form.registrationNumber || ''} onChange={(e) => set('registrationNumber', e.target.value)} placeholder="e.g. DL-REG-12345" />
    </div>
    <div className="form-group">
      <label className="form-label">Report footer / disclaimer</label>
      <textarea
        className="form-control"
        rows={2}
        value={form.disclaimer || form.invoiceFooter || ''}
        onChange={(e) => set('disclaimer', e.target.value)}
        placeholder="e.g. Report must be clinically correlated. …"
      />
    </div>
    <LogoUploader value={logoPreview} onPreview={setLogoPreview} onFile={onLogoFile} />
  </div>
);

export default BrandingForm;
