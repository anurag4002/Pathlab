import React, { useEffect, useRef, useState } from 'react';
import { Button, Input } from '../common';
import { previewDocumentFormat } from '../../services/setupService';
import './DocumentFormatEditor.css';

const numericFields = [
  ['pageMargin', 'Page margin (pt)', 12, 54], ['headerHeight', 'Header height (pt)', 60, 160],
  ['footerHeight', 'Footer height (pt)', 30, 110], ['fontSize', 'Body text size (pt)', 8, 12], ['rowPadding', 'Table row padding (pt)', 2, 8]
];
const selectFields = [
  ['fontFamily', 'Font', [['Helvetica', 'Helvetica'], ['Times-Roman', 'Times'], ['Courier', 'Courier']]],
  ['tableStyle', 'Table appearance', [['outlined', 'Reference outline'], ['plain', 'Plain'], ['banded', 'Colored header and alternating rows']]],
  ['flagPlacement', 'Abnormal flag position', [['before-value', 'Before value (reference)'], ['last', 'Last column']]],
  ['patientLayout', 'Patient details', [['columns', 'Three columns (reference)'], ['stacked', 'Stacked']]]
];

export default function DocumentFormatEditor({ form, profile, disabled, canPreview, onChange }) {
  const formats = form.documentFormats || profile.documentFormats || [];
  const [selectedId, setSelectedId] = useState('');
  const [kind, setKind] = useState('report');
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const selected = formats.find(f => f.id === selectedId) || formats[0];
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  // Any change makes the previous PDF stale. A fresh preview always uses the
  // exact server renderer, including unsaved format and profile edits.
  const signature = JSON.stringify({ form, selected: selected?.id, kind });
  const latestSignature = useRef(signature);
  useEffect(() => { latestSignature.current = signature; setPreview(null); }, [signature]);
  function change(key, value) {
    onChange('documentFormats', formats.map(f => f.id === selected.id ? { ...f, [key]: value } : f));
  }
  function create() {
    const copy = { ...selected, id: `format-${crypto.randomUUID()}`, name: `${selected.name} copy` };
    onChange('documentFormats', [...formats, copy]); setSelectedId(copy.id);
  }
  function remove() {
    const remaining = formats.filter(f => f.id !== selected.id);
    onChange('documentFormats', remaining);
    for (const key of ['reportFormatId', 'billFormatId']) if ((form[key] || profile[key]) === selected.id) onChange(key, remaining[0].id);
    setSelectedId(remaining[0].id);
  }
  async function showPreview() {
    setBusy(true); setError(''); setPreview(null);
    try {
      const blob = await previewDocumentFormat({ ...form, documentFormats: formats, reportFormatId: selected.id, billFormatId: selected.id, kind });
      if (latestSignature.current === signature) setPreview(URL.createObjectURL(blob));
    } catch (err) {
      let message = err.response?.data?.message || err.message || 'Could not generate the preview.';
      if (err.response?.data instanceof Blob) {
        try { message = JSON.parse(await err.response.data.text()).message || message; } catch { /* retain fallback */ }
      }
      setError(message);
    } finally { setBusy(false); }
  }
  if (!selected) return null;
  return (
    <section className="lab-profile-section document-format-editor" aria-labelledby="document-format-heading">
      <div className="lab-profile-section-heading">
        <h2 id="document-format-heading">Report and bill formats</h2>
        <p>Based on your reference PDF. Create a format from a copy, customize it, and select the defaults. Use Save changes to apply formats to future downloads and prints.</p>
      </div>
      <div className="document-format-grid">
        <label className="form-group">Format to edit
          <select className="form-control" value={selected.id} onChange={e => setSelectedId(e.target.value)}>
            {formats.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </label>
        {['report', 'bill'].map(type => <label className="form-group" key={type}>Default {type} format
          <select className="form-control" disabled={disabled} value={form[`${type}FormatId`] || profile[`${type}FormatId`] || formats[0].id} onChange={e => onChange(`${type}FormatId`, e.target.value)}>
            {formats.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </label>)}
      </div>
      <div className="document-format-actions">
        <Button type="button" variant="secondary" disabled={disabled || formats.length >= 20} onClick={create}>Create format from copy</Button>
        <Button type="button" variant="secondary" disabled={disabled || formats.length <= 1} onClick={remove}>Delete selected format</Button>
      </div>
      <div className="document-format-grid">
        <Input id="format-name" label="Format name" value={selected.name} maxLength={120} required disabled={disabled} onChange={e => change('name', e.target.value)} />
        {numericFields.map(([key, label, min, max]) => <Input id={`format-${key}`} key={key} label={label} type="number" min={min} max={max} step="1" required value={selected[key]} disabled={disabled} onChange={e => change(key, e.target.value === '' ? '' : Number(e.target.value))} />)}
        {selectFields.map(([key, label, options]) => <label className="form-group" key={key}>{label}
          <select className="form-control" disabled={disabled} value={selected[key]} onChange={e => change(key, e.target.value)}>
            {options.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
          </select>
        </label>)}
        <Input id="format-accent" label="Accent color" type="color" value={selected.accentColor} disabled={disabled} onChange={e => change('accentColor', e.target.value)} />
        <Input id="format-report-title" label="Report title (optional)" value={selected.reportTitle} maxLength={120} disabled={disabled} onChange={e => change('reportTitle', e.target.value)} />
        <Input id="format-bill-title" label="Bill title" value={selected.billTitle} maxLength={120} disabled={disabled} onChange={e => change('billTitle', e.target.value)} />
        <Input id="format-end-text" label="End of report text" value={selected.endOfReportText} maxLength={120} disabled={disabled} onChange={e => change('endOfReportText', e.target.value)} />
      </div>
      <label className="document-format-branding"><input type="checkbox" disabled={disabled} checked={selected.useReferenceBranding} onChange={e => change('useReferenceBranding', e.target.checked)} /> Use the reference header, watermark and footer when no custom image is uploaded</label>
      <p className="lab-profile-helper">The reference header includes the lab's printed contact details. Turn this off to use your editable lab details. Uploaded header, logo and footer images take priority. Signatures come from each report's sign-off records.</p>
      <div className="document-format-actions">
        <label>Preview as <select className="form-control" value={kind} onChange={e => setKind(e.target.value)}><option value="report">Lab report</option><option value="bill">Bill / invoice</option></select></label>
        <Button type="button" disabled={busy || !canPreview} loading={busy} onClick={showPreview}>Preview selected format as PDF</Button>
      </div>
      {error && <p role="alert" className="document-format-error">{error}</p>}
      {preview && <><a href={preview} download="Format-preview.pdf">Download this preview</a><iframe className="document-format-preview" title="Exact generated PDF format preview" src={preview} /></>}
    </section>
  );
}
