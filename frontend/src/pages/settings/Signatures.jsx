import React, { useEffect, useState } from 'react';
import { Plus, Trash2, RefreshCw } from 'lucide-react';
import { PageHeader, Button, Modal, Input, DataTable, EmptyState, ConfirmDialog } from '../../components/common';
import { getSignatures, createSignature, deleteSignature, updateSignature } from '../../services/setupService';
import { DEPARTMENTS } from '../../features/billing/billingConstants';
import { signatureDepartments, isSignatureActive, signatureImageSrc } from '../../utils/signatureUtils';

// Phase 15 — Signatures manager (Admin). Sources from GET /api/setup/signatures.
// Upload (POST) + delete (DELETE) work today. Assignment is captured at
// create time via `modalities[]` (the real backend field; `assignedDepartments`
// is accepted forward-compat if the backend ever adds it). Edit/deactivate
// (PUT) does NOT exist on the backend — those controls attempt the call and
// degrade to an explicit "backend pending" state instead of faking success.
const PUT_PENDING = 'Backend pending: PUT /api/setup/signatures/:id does not exist yet.';

const Signatures = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', title: '', departments: [], file: null });
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [updatingId, setUpdatingId] = useState('');

  const fetchAll = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await getSignatures();
      if (res?.success) setItems(res.data || []);
      else setError(res?.message || 'Failed to load signatures');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load signatures');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const toggleDept = (dept) => {
    setForm((p) => ({
      ...p,
      departments: p.departments.includes(dept)
        ? p.departments.filter((d) => d !== dept)
        : [...p.departments, dept],
    }));
  };

  const handleCreate = async (e) => {
    e?.preventDefault?.();
    if (!form.name.trim()) { setError('Name is required'); return; }
    if (!form.file) { setError('Signature image is required'); return; }
    setSaving(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('name', form.name.trim());
      fd.append('title', form.title.trim());
      // Real backend field is `modalities`; also send assignedDepartments for
      // forward-compat (ignored by current backend).
      form.departments.forEach((d) => { fd.append('modalities', d); fd.append('assignedDepartments', d); });
      fd.append('file', form.file);
      const res = await createSignature(fd);
      if (res?.success) {
        setOpen(false);
        setForm({ name: '', title: '', departments: [], file: null });
        setNotice('Signature uploaded.');
        fetchAll();
      } else {
        setError(res?.message || 'Failed to create signature');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create signature');
    } finally {
      setSaving(false);
    }
  };

  const handleStatusToggle = async (sig) => {
    const next = isSignatureActive(sig) ? 'Inactive' : 'Active';
    setUpdatingId(String(sig._id));
    setNotice('');
    try {
      await updateSignature(sig._id, { status: next });
      setNotice(`Signature ${next === 'Active' ? 'activated' : 'deactivated'}.`);
      fetchAll();
    } catch (err) {
      const status = err.response?.status;
      setNotice(status === 404
        ? `${PUT_PENDING} Status left unchanged (still ${sig.status || 'Active'}).`
        : (err.response?.data?.message || 'Failed to update signature'));
    } finally {
      setUpdatingId('');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteSignature(deleteTarget._id);
      setDeleteTarget(null);
      setNotice('Signature deleted.');
      fetchAll();
    } catch (err) {
      setNotice(err.response?.data?.message || 'Failed to delete signature');
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Signatures"
        subtitle="Manage e-signatures assigned per department. Upload and delete work now; edit/deactivate awaits backend PUT."
        action={
          <Button variant="primary" onClick={() => { setForm({ name: '', title: '', departments: [], file: null }); setError(''); setOpen(true); }}>
            <Plus size={16} /> Add signature
          </Button>
        }
      />

      {notice && (
        <p style={{ fontSize: '0.8rem', background: '#eff6ff', border: '1px solid #93c5fd', borderRadius: 6, padding: '8px 12px', marginBottom: 12 }}>
          {notice}
        </p>
      )}
      {error && <p style={{ fontSize: '0.8rem', color: '#b91c1c', marginBottom: 12 }}>{error}</p>}

      {!loading && items.length === 0 && !error && (
        <EmptyState
          title="No signatures configured"
          message="Upload the first signatory image and assign it to departments. Reports cannot be signed until at least one active signature exists."
          action={<Button variant="primary" onClick={() => setOpen(true)}><Plus size={16} /> Add signature</Button>}
        />
      )}

      {items.length > 0 && (
        <DataTable
          headers={['Preview', 'Name', 'Title', 'Departments', 'Status', 'Actions']}
          data={items}
          loading={loading}
          emptyMessage="No signatures configured."
          renderRow={(sig) => (
            <tr key={sig._id}>
              <td>
                {signatureImageSrc(sig) ? (
                  <img
                    src={signatureImageSrc(sig)}
                    alt={`Signature of ${sig.name || ''}`}
                    style={{ height: 36, border: '1px solid #e5e7eb', background: '#fff' }}
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  />
                ) : '—'}
              </td>
              <td style={{ fontWeight: 600 }}>{sig.name}</td>
              <td>{sig.title || '—'}</td>
              <td style={{ fontSize: '0.8rem' }}>{signatureDepartments(sig).join(', ') || '—'}</td>
              <td>{sig.status || 'Active'}</td>
              <td>
                <div style={{ display: 'flex', gap: 8 }}>
                  <span title={PUT_PENDING}>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={updatingId === String(sig._id)}
                      title={PUT_PENDING}
                      onClick={() => handleStatusToggle(sig)}
                    >
                      <RefreshCw size={14} /> {isSignatureActive(sig) ? 'Deactivate' : 'Activate'}*
                    </Button>
                  </span>
                  <Button variant="danger" size="sm" onClick={() => setDeleteTarget(sig)}>
                    <Trash2 size={14} />
                  </Button>
                </div>
              </td>
            </tr>
          )}
        />
      )}
      <p style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: 8 }}>
        * Deactivate/activate attempts PUT which the backend does not implement yet — the button reports “backend pending” instead of faking a change.
      </p>

      <Modal
        isOpen={open}
        onClose={() => setOpen(false)}
        title="Add Signature"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
            <Button variant="primary" onClick={handleCreate} loading={saving}>Upload</Button>
          </>
        }
      >
        <form onSubmit={handleCreate} className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
          <Input label="Name" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="Dr A. Sharma" required />
          <Input label="Title" value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} placeholder="Pathologist" />
          <div>
            <span className="form-label">Assigned departments</span>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
              {DEPARTMENTS.map((d) => (
                <label key={d.name} style={{ fontSize: '0.78rem', border: '1px solid #d1d5db', borderRadius: 999, padding: '4px 10px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={form.departments.includes(d.name)}
                    onChange={() => toggleDept(d.name)}
                    style={{ marginRight: 6 }}
                  />
                  {d.name}
                </label>
              ))}
            </div>
          </div>
          <div>
            <span className="form-label">Signature image (PNG/JPG, required)</span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/jpg"
              onChange={(e) => setForm((p) => ({ ...p, file: e.target.files?.[0] || null }))}
              style={{ marginTop: 6 }}
            />
            {form.file && (
              <img
                src={URL.createObjectURL(form.file)}
                alt="Signature preview"
                style={{ height: 48, marginTop: 8, border: '1px solid #e5e7eb' }}
              />
            )}
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Delete signature?"
        message={`Permanently remove the signature of ${deleteTarget?.name}? Existing signed PDFs are unaffected.`}
      />
    </div>
  );
};

export default Signatures;
