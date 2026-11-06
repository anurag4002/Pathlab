import React, { useEffect, useMemo, useState } from 'react';
import { Plus, RefreshCw } from 'lucide-react';
import { PageHeader, Button, Modal, Input, ConfirmDialog, RowMenu } from '../../../components/common';
import { getSignatures, createSignature, deleteSignature, updateSignature } from '../../../services/setupService';
import { DEPARTMENTS } from '../../../features/billing/billingConstants';
import { signatureDepartments, isSignatureActive, signatureImageSrc } from '../../../utils/signatureUtils';
import { notify } from '../../../components/common/Toast/toast';
import useDraft from '../../manage/v2/useDraft';
import '../../../components/business/business.css';
import '../../manage/v2/manage.css';
import './signaturesV2.css';

const EMPTY = { name: '', title: '', departments: [] };

// Signatures (new look): who signs reports, for which departments.
export default function SignaturesV2() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm, clearForm] = useDraft('signature-new', EMPTY);
  const [file, setFile] = useState(null);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [del, setDel] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [updating, setUpdating] = useState('');
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : ''), [file]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const load = async () => {
    setLoading(true); setError('');
    try { const res = await getSignatures(); if (res?.success) setItems(res.data || []); else setError(res?.message || 'Could not load signatures.'); }
    catch (err) { setError(err.response?.data?.message || 'Could not load signatures.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const toggleDept = (d) => setForm((p) => ({ ...p, departments: p.departments.includes(d) ? p.departments.filter((x) => x !== d) : [...p.departments, d] }));
  const create = async (e) => {
    e?.preventDefault();
    if (!form.name.trim()) { setFormError('Enter the name as it should appear under the signature.'); return; }
    if (!file) { setFormError('Choose the signature picture (PNG or JPG).'); return; }
    setSaving(true); setFormError('');
    try {
      const fd = new FormData();
      fd.append('name', form.name.trim());
      fd.append('title', form.title.trim());
      form.departments.forEach((d) => { fd.append('modalities', d); fd.append('assignedDepartments', d); });
      fd.append('file', file);
      const res = await createSignature(fd);
      if (res?.success) { clearForm(); setFile(null); setOpen(false); notify('Signature added'); load(); }
      else setFormError(res?.message || 'Could not add the signature.');
    } catch (err) { setFormError(err.response?.data?.message || 'Could not add the signature.'); }
    finally { setSaving(false); }
  };
  const toggleActive = async (sig) => {
    const next = isSignatureActive(sig) ? 'Inactive' : 'Active';
    setUpdating(String(sig._id));
    try { await updateSignature(sig._id, { status: next }); notify(next === 'Active' ? 'Signature in use again' : 'Signature paused'); load(); }
    catch (err) { notify(err.response?.data?.message || 'Could not update.'); }
    finally { setUpdating(''); }
  };
  const remove = async () => {
    setDeleting(true);
    try { await deleteSignature(del._id); notify('Signature deleted'); load(); }
    catch (err) { notify(err.response?.data?.message || 'Could not delete.'); }
    finally { setDeleting(false); setDel(null); }
  };
  const active = items.filter(isSignatureActive).length;

  return (
    <div className="biz-page">
      <PageHeader
        title="Signatures"
        subtitle="Who signs the reports, and for which departments. A report can only be signed once a matching signature is in use."
        action={<div className="biz-actions">
          <Button variant="secondary" size="sm" icon={<RefreshCw size={14} />} onClick={load}>Refresh</Button>
          <Button variant="primary" size="sm" icon={<Plus size={14} />} onClick={() => { setFormError(''); setOpen(true); }}>Add signature</Button>
        </div>}
      />
      {error && <div className="biz-error" role="alert">{error}<Button variant="secondary" size="sm" onClick={load}>Try again</Button></div>}
      {!loading && items.length > 0 && active === 0 && <div className="biz-error" role="status">No signature is in use, so reports cannot be signed. Turn one on below.</div>}

      {!loading && items.length === 0 && !error ? (
        <div className="mg-empty-card"><strong>No signatures yet</strong>Add the pathologist's signature so reports can be signed.<br /><Button variant="primary" size="sm" icon={<Plus size={14} />} onClick={() => setOpen(true)}>Add signature</Button></div>
      ) : (
        <div className="sg-grid">
          {items.map((sig) => {
            const on = isSignatureActive(sig);
            const depts = signatureDepartments(sig);
            return (
              <article key={sig._id} className={`sg-card${on ? '' : ' is-off'}`}>
                <div className="sg-image">{signatureImageSrc(sig) ? <img src={signatureImageSrc(sig)} alt={`Signature of ${sig.name || ''}`} onError={(e) => { e.currentTarget.style.display = 'none'; }} /> : <span className="muted">No picture</span>}</div>
                <div className="sg-body">
                  <div className="sg-head">
                    <div><div className="mg-name">{sig.name}</div><div className="mg-sub">{sig.title || 'No title'}</div></div>
                    <RowMenu items={[{ label: 'Delete signature', danger: true, onClick: () => setDel(sig) }]} />
                  </div>
                  <div className="sg-depts">{depts.length ? depts.map((d) => <span key={d} className="mg-pill">{d}</span>) : <span className="mg-sub">All departments</span>}</div>
                  <label className="mg-switch">
                    <input type="checkbox" checked={on} disabled={updating === String(sig._id)} onChange={() => toggleActive(sig)} />
                    <span className="mg-switch-track" />
                    {on ? 'In use' : 'Paused'}
                  </label>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <Modal isOpen={open} onClose={() => setOpen(false)} variant="drawer" title="Add signature"
        footer={<>
          <span className="mg-draft-note">Closing keeps the name and departments.</span>
          <Button variant="secondary" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
          <Button variant="primary" onClick={create} loading={saving}>Add signature</Button>
        </>}>
        <form className="mg-form" onSubmit={create}>
          <div className="mg-form-section">
            <h3>Who signs</h3>
            <Input label="Name *" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="e.g. Dr. A. Sharma" autoFocus />
            <Input label="Title" value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} placeholder="e.g. MD Pathology" />
          </div>
          <div className="mg-form-section">
            <h3>Signs for</h3>
            <p className="mg-help">Pick departments. Leave all unticked to sign for every department.</p>
            <div className="sg-dept-picks">
              {DEPARTMENTS.map((d) => (
                <button key={d.name} type="button" className={form.departments.includes(d.name) ? 'is-on' : ''} aria-pressed={form.departments.includes(d.name)} onClick={() => toggleDept(d.name)}>{d.name}</button>
              ))}
            </div>
          </div>
          <div className="mg-form-section">
            <h3>Signature picture *</h3>
            <p className="mg-help">A clear scan or photo on a white background (PNG or JPG).</p>
            <input type="file" accept="image/png,image/jpeg,image/jpg" onChange={(e) => setFile(e.target.files?.[0] || null)} aria-label="Signature picture" />
            {preview && <div className="sg-image sg-preview"><img src={preview} alt="Signature preview" /></div>}
          </div>
          {formError && <p className="mg-error" role="alert">{formError}</p>}
        </form>
      </Modal>

      <ConfirmDialog isOpen={!!del} onClose={() => setDel(null)} onConfirm={remove} loading={deleting}
        title="Delete this signature?"
        message={`${del?.name || 'This signature'} will be removed. Reports already signed keep their signature. To stop using it for a while, pause it instead.`}
        confirmText="Delete" />
    </div>
  );
}
