import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader, Button, Input, LoadingSpinner, EmptyState } from '../../components/common';
import { toast } from '../../components/common/Toast/toast';
import { getLabProfile, updateLabProfile, previewDocumentFormat } from '../../services/setupService';
import {
  NUMERIC_FORMAT_FIELDS, SELECT_FORMAT_FIELDS, formatFieldKey, validateDocumentFormats
} from '../../components/lab/documentFormatFields';
import './ReportTemplate.css';

// Report template: edit the report format on the left and see the real
// server-rendered report PDF (sample data) update on the right, before saving.

const PREVIEW_DELAY_MS = 400;

// Report blocks stored on the lab profile (also on Setup > Lab profile).
const REPORT_TOGGLES = [
  ['showWatermark', 'Watermark logo'],
  ['showPageNumber', 'Page numbers'],
  ['showFooterByDefault', 'Footer'],
  ['showQR', 'QR code'],
  ['showBarcode', 'Barcode'],
  ['showTatDates', 'Sample and report dates'],
  ['showReferredBy', 'Referred by'],
  ['showDepartmentHeading', 'Department heading'],
  ['showFlagColumn', 'High / low flags'],
  ['showInterpretation', 'Interpretation'],
  ['showEndOfReport', 'End-of-report line']
];

const errorMessage = async (error, fallback) => {
  const data = error?.response?.data;
  if (data instanceof Blob) {
    try { return JSON.parse(await data.text()).message || fallback; } catch { return fallback; }
  }
  if (typeof data?.message === 'string' && data.message.trim()) return data.message;
  if (error?.response?.status === 403) return 'Only an Admin can change the report template.';
  return error?.message && !error.response ? 'Could not reach the server. Check the connection and try again.' : fallback;
};

const pickToggles = (profile) => Object.fromEntries(REPORT_TOGGLES.map(([key]) => [key, profile?.[key] ?? true]));

export default function ReportTemplate() {
  const [profile, setProfile] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [formats, setFormats] = useState([]);
  const [reportFormatId, setReportFormatId] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [toggles, setToggles] = useState({});
  const [letterhead, setLetterhead] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pdfUrl, setPdfUrl] = useState('');
  const [rendering, setRendering] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const requestSeq = useRef(0);
  const lastToast = useRef('');

  const reset = (data) => {
    const list = data.documentFormats?.length ? data.documentFormats : [];
    setFormats(list);
    const defaultId = data.reportFormatId && list.some((f) => f.id === data.reportFormatId) ? data.reportFormatId : list[0]?.id;
    setReportFormatId(defaultId || '');
    setSelectedId(defaultId || '');
    setToggles(pickToggles(data));
    setDirty(false);
  };

  const load = async () => {
    setLoadError('');
    try {
      const response = await getLabProfile();
      const data = response?.data?.profile ?? response?.data;
      if (!data || typeof data !== 'object') throw new Error('The lab profile could not be loaded.');
      setProfile(data);
      setLetterhead(data.showLetterheadByDefault ?? true);
      reset(data);
    } catch (error) {
      setLoadError(await errorMessage(error, 'The lab profile could not be loaded.'));
    }
  };
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const selected = formats.find((f) => f.id === selectedId) || formats[0];
  const fieldErrors = useMemo(() => validateDocumentFormats(formats), [formats]);
  const selectedErrors = selected ? Object.keys(fieldErrors).filter((k) => k.startsWith(formatFieldKey(selected.id, ''))) : [];
  const hasErrors = Object.keys(fieldErrors).length > 0;

  // Re-render the real PDF (debounced) whenever a setting changes.
  const previewBody = useMemo(() => (selected ? {
    documentFormats: formats, reportFormatId: selected.id, billFormatId: selected.id,
    kind: 'report', letterhead, showLetterheadByDefault: letterhead, ...toggles
  } : null), [formats, selected, letterhead, toggles]);
  useEffect(() => {
    if (!previewBody || hasErrors) return undefined;
    const seq = ++requestSeq.current;
    const timer = setTimeout(async () => {
      setRendering(true);
      try {
        const blob = await previewDocumentFormat(previewBody);
        if (seq !== requestSeq.current) return;
        setPdfUrl(URL.createObjectURL(blob));
        setPreviewError(''); lastToast.current = '';
      } catch (error) {
        if (seq !== requestSeq.current) return;
        const message = await errorMessage(error, 'Could not update the preview.');
        setPreviewError(message);
        // One toast per distinct problem, not one per keystroke.
        if (lastToast.current !== message) { toast.error(message); lastToast.current = message; }
      } finally {
        if (seq === requestSeq.current) setRendering(false);
      }
    }, PREVIEW_DELAY_MS);
    return () => clearTimeout(timer);
  }, [previewBody, hasErrors]);
  useEffect(() => () => { if (pdfUrl) URL.revokeObjectURL(pdfUrl); }, [pdfUrl]);

  const change = (key, value) => {
    setFormats((list) => list.map((f) => (f.id === selected.id ? { ...f, [key]: value } : f)));
    setDirty(true);
  };
  const setToggle = (key, value) => { setToggles((t) => ({ ...t, [key]: value })); setDirty(true); };

  const save = async () => {
    if (hasErrors) { toast.error(Object.values(fieldErrors)[0]); return; }
    setSaving(true);
    try {
      const response = await updateLabProfile({ documentFormats: formats, reportFormatId, ...toggles });
      if (!response?.success) throw new Error(response?.message || 'The report template could not be saved.');
      const data = response.data?.profile ?? response.data;
      setProfile(data);
      reset({ ...data, documentFormats: data.documentFormats?.length ? data.documentFormats : formats });
      setSelectedId(selected.id);
      toast.success('Report template saved. New reports will use it.');
    } catch (error) {
      toast.error(await errorMessage(error, 'The report template could not be saved.'));
    } finally { setSaving(false); }
  };

  if (loadError) {
    return (
      <div className="report-template">
        <PageHeader title="Report Template" />
        <EmptyState title="Report template unavailable" message={loadError} action={<Button onClick={load}>Try again</Button>} />
      </div>
    );
  }
  if (!profile || !selected) return <div className="report-template"><PageHeader title="Report Template" /><LoadingSpinner /></div>;

  const err = (key) => fieldErrors[formatFieldKey(selected.id, key)];
  return (
    <div className="report-template">
      <PageHeader
        title="Report Template"
        subtitle="Change how lab reports look and check the real PDF on the right before saving."
        action={(
          <div className="report-template-actions">
            <Button variant="secondary" disabled={!dirty || saving} onClick={() => reset(profile)}>Discard changes</Button>
            <Button loading={saving} disabled={!dirty} onClick={save}>Save template</Button>
          </div>
        )}
      />
      <div className="report-template-layout">
        <form className="report-template-fields" noValidate onSubmit={(e) => { e.preventDefault(); save(); }} aria-label="Report template settings">
          <fieldset>
            <legend>Format</legend>
            <label className="form-group">Format to edit
              <select className="form-control" value={selected.id} onChange={(e) => setSelectedId(e.target.value)}>
                {formats.map((f) => <option key={f.id} value={f.id}>{f.name}{f.id === reportFormatId ? ' (used for reports)' : ''}</option>)}
              </select>
            </label>
            <label className="report-template-check">
              <input type="checkbox" checked={reportFormatId === selected.id} disabled={reportFormatId === selected.id}
                onChange={() => { setReportFormatId(selected.id); setDirty(true); }} />
              Use this format for reports
            </label>
            <Input id="rt-name" label="Format name" value={selected.name} maxLength={120} required error={err('name')} onChange={(e) => change('name', e.target.value)} />
          </fieldset>

          <fieldset>
            <legend>Page layout</legend>
            <div className="report-template-grid">
              {NUMERIC_FORMAT_FIELDS.map(([key, label, min, max]) => (
                <Input id={`rt-${key}`} key={key} label={label} type="number" min={min} max={max} step="1" required
                  value={selected[key]} error={err(key)} helperText={err(key) ? undefined : `${min} to ${max}`}
                  onChange={(e) => change(key, e.target.value === '' ? '' : Number(e.target.value))} />
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend>Results and text</legend>
            <div className="report-template-grid">
              {SELECT_FORMAT_FIELDS.map(([key, label, options]) => (
                <label className="form-group" key={key}>{label}
                  <select className="form-control" value={selected[key]} onChange={(e) => change(key, e.target.value)}>
                    {options.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
                  </select>
                </label>
              ))}
              <Input id="rt-accent" label="Accent color" type="color" value={selected.accentColor} onChange={(e) => change('accentColor', e.target.value)} />
            </div>
            <Input id="rt-title" label="Report title (optional)" value={selected.reportTitle} maxLength={120} onChange={(e) => change('reportTitle', e.target.value)} />
            <Input id="rt-end" label="End of report text" value={selected.endOfReportText} maxLength={120} onChange={(e) => change('endOfReportText', e.target.value)} />
            <label className="report-template-check">
              <input type="checkbox" checked={!!selected.useReferenceBranding} onChange={(e) => change('useReferenceBranding', e.target.checked)} />
              Use the reference header, watermark and footer when no custom image is uploaded
            </label>
          </fieldset>

          <fieldset>
            <legend>Show on reports</legend>
            <div className="report-template-toggles">
              {REPORT_TOGGLES.map(([key, label]) => (
                <label className="report-template-check" key={key}>
                  <input type="checkbox" checked={!!toggles[key]} onChange={(e) => setToggle(key, e.target.checked)} /> {label}
                </label>
              ))}
            </div>
            <p className="report-template-note">
              Header, footer and signature images are uploaded on <Link to="/setup/profile">Lab profile</Link>. The preview uses those saved images.
            </p>
          </fieldset>
        </form>

        <section className="report-template-preview" aria-label="Report preview">
          <div className="report-template-preview-bar">
            <div className="report-template-segment" role="group" aria-label="Paper">
              <button type="button" aria-pressed={letterhead} className={letterhead ? 'is-on' : ''} onClick={() => setLetterhead(true)}>With letterhead</button>
              <button type="button" aria-pressed={!letterhead} className={!letterhead ? 'is-on' : ''} onClick={() => setLetterhead(false)}>Without letterhead (pre-printed pad)</button>
            </div>
            <span className="report-template-status" role="status" aria-live="polite">
              {hasErrors ? 'Fix the highlighted field to update the preview'
                : rendering ? 'Updating preview…'
                  : previewError ? 'Preview not updated'
                    : dirty ? 'Unsaved changes shown' : 'Saved template shown'}
            </span>
            {pdfUrl && <a className="report-template-open" href={pdfUrl} target="_blank" rel="noreferrer">Open PDF</a>}
          </div>
          {(hasErrors || previewError) && (
            <div className="report-template-callout" role="alert">
              <strong>Preview not updated.</strong> {hasErrors ? (selectedErrors.length ? fieldErrors[selectedErrors[0]] : Object.values(fieldErrors)[0]) : previewError}
            </div>
          )}
          <div className={`report-template-frame${rendering ? ' is-busy' : ''}`}>
            {rendering && <div className="report-template-progress" aria-hidden="true" />}
            {pdfUrl
              ? <iframe title="Report PDF preview with sample data" src={`${pdfUrl}#toolbar=0&navpanes=0&view=FitH`} />
              : <div className="report-template-empty">{previewError ? 'The preview could not be made.' : 'Making the preview…'}</div>}
          </div>
          <p className="report-template-note">Sample patient and results only. Nothing is saved until you press Save template.</p>
        </section>
      </div>
    </div>
  );
}
