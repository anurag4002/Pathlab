import React, { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, RefreshCw } from 'lucide-react';
import { getBranches, createBranch, updateBranch, deleteBranch } from '../../services/branchService';
import { DataTable, PageHeader, Button, Modal, Input, Select, ConfirmDialog, StatusBadge } from '../../components/common';
import '../../styles/UserManagement.css';

const EMPTY = { name: '', code: '', address: '', phone: '', email: '', status: 'Active' };

const Branches = () => {
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [del, setDel] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await getBranches();
      if (res?.success) setBranches(Array.isArray(res.data) ? res.data : []);
      else setError(res?.message || 'Failed to load branches.');
    } catch (e) {
      setError(e?.response?.data?.message || 'Failed to load branches.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditing(null); setForm(EMPTY); setOpen(true); };
  const openEdit = (b) => {
    setEditing(b);
    setForm({ name: b.name || '', code: b.code || '', address: b.address || '', phone: b.phone || '', email: b.email || '', status: b.status || 'Active' });
    setOpen(true);
  };

  const save = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.code.trim()) {
      setError('Branch name and code are required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload = { ...form, name: form.name.trim(), code: form.code.trim().toUpperCase() };
      const res = editing ? await updateBranch(editing._id, payload) : await createBranch(payload);
      if (!res?.success) { setError(res?.message || 'Could not save branch.'); return; }
      setOpen(false);
      setNotice(res.message || 'Branch saved.');
      load();
    } catch (err) {
      setError(err?.response?.data?.message || 'Could not save branch.');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!del) return;
    setDeleting(true);
    try {
      const res = await deleteBranch(del._id);
      if (!res?.success) { setError(res?.message || 'Could not delete branch.'); setDel(null); return; }
      setDel(null);
      setNotice(res.message || 'Branch deleted.');
      load();
    } catch (err) {
      setError(err?.response?.data?.message || 'Could not delete branch.');
      setDel(null);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="user-management-page">
      <PageHeader
        title="Branches"
        subtitle="Each staff member belongs to exactly one branch. Staff see only their own branch; Admins see all."
        action={<Button variant="primary" onClick={openCreate} icon={<Plus size={16} />}>Add branch</Button>}
      />
      {error && <div className="user-management-alert user-management-alert-error" role="alert"><span>{error}</span><Button variant="secondary" size="sm" onClick={load} disabled={loading}>Retry</Button></div>}
      {notice && <div className="user-management-alert user-management-alert-success" role="status">{notice}</div>}
      <DataTable
        headers={['Name', 'Code', 'Phone', 'Status', 'Created', 'Actions']}
        data={branches}
        loading={loading}
        emptyMessage="No branches yet. Main is created automatically."
        renderRow={(b) => (
          <tr key={b._id}>
            <td style={{ fontWeight: 'var(--font-weight-semibold)' }}>{b.name}</td>
            <td>{b.code}</td>
            <td>{b.phone || '—'}</td>
            <td><StatusBadge status={b.status} /></td>
            <td>{b.createdAt ? new Date(b.createdAt).toLocaleDateString() : '—'}</td>
            <td>
              <div className="user-management-actions">
                <Button variant="secondary" size="sm" onClick={() => openEdit(b)} aria-label={`Edit ${b.name}`}><Edit2 size={14} /></Button>
                <Button variant="danger" size="sm" onClick={() => setDel(b)} aria-label={`Delete ${b.name}`}><Trash2 size={14} /></Button>
              </div>
            </td>
          </tr>
        )}
      />
      <Modal
        isOpen={open}
        onClose={() => setOpen(false)}
        title={editing ? 'Edit branch' : 'Add branch'}
        footer={<><Button variant="secondary" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button><Button variant="primary" onClick={save} loading={saving}>Save</Button></>}
      >
        <form onSubmit={save} noValidate>
          <div className="emp-form-grid">
            <Input label="Branch Name" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="e.g. Laxmi Nagar" required />
            <Input label="Branch Code" value={form.code} onChange={(e) => setForm((p) => ({ ...p, code: e.target.value.toUpperCase() }))} placeholder="e.g. LXN" required />
            <Input label="Phone" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} placeholder="+91…" />
            <Input label="Email" type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} placeholder="branch@purepathlab.in" />
            <div className="emp-form-full"><Input label="Address" value={form.address} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} placeholder="Full branch address" /></div>
            <Select label="Status" value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))} options={[{ value: 'Active', label: 'Active' }, { value: 'Inactive', label: 'Inactive' }]} required />
          </div>
        </form>
      </Modal>
      <ConfirmDialog
        isOpen={!!del}
        onClose={() => setDel(null)}
        onConfirm={confirmDelete}
        loading={deleting}
        title="Delete branch?"
        message={`Permanently delete ${del?.name || 'this branch'}? Branches with staff assigned cannot be deleted.`}
        confirmText="Delete branch"
      />
      <div style={{ marginTop: 12 }}>
        <Button variant="secondary" size="sm" onClick={load} disabled={loading} icon={<RefreshCw size={14} />}>Refresh</Button>
      </div>
    </div>
  );
};

export default Branches;
