import React, { useEffect, useMemo, useState } from 'react';
import { Plus, RefreshCw } from 'lucide-react';
import { getBranches, createBranch, updateBranch, deleteBranch } from '../../../services/branchService';
import { PageHeader, Button, Modal, Input, ConfirmDialog, RowMenu } from '../../../components/common';
import ReportTable from '../../../components/business/ReportTable';
import { notify } from '../../../components/common/Toast/toast';
import { dayLabel } from '../../../utils/reportFormat';
import useDraft from './useDraft';
import '../../../components/business/business.css';
import './manage.css';

const EMPTY = { name: '', code: '', address: '', phone: '', email: '', status: 'Active' };

// Branches (new look): each lab location. Staff see only their own branch.
export default function BranchesV2() {
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [draft, setDraft, clearDraft] = useDraft('branch-new', EMPTY);
  const [editForm, setEditForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [del, setDel] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const form = editing ? editForm : draft;
  const setForm = editing ? setEditForm : setDraft;

  const load = async () => {
    setLoading(true); setError('');
    try {
      const res = await getBranches();
      if (res?.success) setBranches(Array.isArray(res.data) ? res.data : []);
      else setError(res?.message || 'Could not load branches.');
    } catch (e) { setError(e?.response?.data?.message || 'Could not load branches.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return branches.filter((b) => !q || `${b.name} ${b.code} ${b.phone} ${b.address}`.toLowerCase().includes(q));
  }, [branches, search]);

  const openNew = () => { setEditing(null); setFormError(''); setOpen(true); };
  const openEdit = (b) => {
    setEditing(b);
    setEditForm({ name: b.name || '', code: b.code || '', address: b.address || '', phone: b.phone || '', email: b.email || '', status: b.status || 'Active' });
    setFormError(''); setOpen(true);
  };
  const save = async (e) => {
    e?.preventDefault();
    if (!form.name.trim() || !form.code.trim()) { setFormError('Enter the branch name and a short code.'); return; }
    setSaving(true); setFormError('');
    try {
      const payload = { ...form, name: form.name.trim(), code: form.code.trim().toUpperCase() };
      const res = editing ? await updateBranch(editing._id, payload) : await createBranch(payload);
      if (!res?.success) { setFormError(res?.message || 'Could not save the branch.'); return; }
      if (!editing) clearDraft();
      setOpen(false); notify(editing ? 'Branch updated' : 'Branch added'); load();
    } catch (err) { setFormError(err?.response?.data?.message || 'Could not save the branch.'); }
    finally { setSaving(false); }
  };
  const confirmDelete = async () => {
    if (!del) return;
    setDeleting(true);
    try {
      const res = await deleteBranch(del._id);
      if (!res?.success) notify(res?.message || 'Could not delete the branch.');
      else { notify('Branch deleted'); load(); }
    } catch (err) { notify(err?.response?.data?.message || 'Could not delete the branch.'); }
    finally { setDeleting(false); setDel(null); }
  };
  const set = (key) => (e) => setForm((p) => ({ ...p, [key]: key === 'code' ? e.target.value.toUpperCase() : e.target.value }));

  return (
    <div className="biz-page">
      <PageHeader
        title="Branches"
        subtitle="Your lab locations. Each staff member works at one branch and sees only its work; admins see every branch."
        action={<div className="biz-actions">
          <Button variant="secondary" size="sm" icon={<RefreshCw size={14} />} onClick={load} disabled={loading}>Refresh</Button>
          <Button variant="primary" size="sm" icon={<Plus size={14} />} onClick={openNew}>Add branch</Button>
        </div>}
      />
      {branches.length > 5 && (
        <div className="mg-filter-row">
          <div className="form-group mg-hidden-search"><input type="search" data-page-search="" aria-label="Search branches" placeholder="Search branches" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
          <span className="mg-count">{rows.length} of {branches.length}</span>
        </div>
      )}
      {error && <div className="biz-error" role="alert">{error}<Button variant="secondary" size="sm" onClick={load}>Try again</Button></div>}

      <ReportTable loading={loading} rows={rows} rowKey={(b) => b._id} onRowClick={openEdit}
        empty="No branches yet. The main branch is created automatically."
        columns={[
          { key: 'name', label: 'Branch', render: (b) => <><div className="mg-name">{b.name}</div><div className="mg-sub">Code {b.code}</div></> },
          { key: 'contact', label: 'Contact', render: (b) => <><div>{b.phone || <span className="muted">No phone</span>}</div>{b.email && <div className="mg-sub">{b.email}</div>}</> },
          { key: 'address', label: 'Address', render: (b) => b.address || <span className="muted">Not set</span> },
          { key: 'status', label: 'Status', render: (b) => <span className={`mg-pill ${b.status === 'Active' ? 'is-good' : ''}`}>{b.status === 'Active' ? 'Open' : 'Closed'}</span> },
          { key: 'since', label: 'Added', render: (b) => <span className="muted">{b.createdAt ? dayLabel(b.createdAt) : ''}</span> },
          { key: 'actions', label: '', align: 'right', render: (b) => (
            <span className="mg-row-actions" onClick={(e) => e.stopPropagation()}>
              <Button variant="secondary" size="sm" onClick={() => openEdit(b)}>Edit</Button>
              <RowMenu items={[{ label: 'Delete branch', danger: true, onClick: () => setDel(b) }]} />
            </span>
          ) },
        ]} />

      <Modal isOpen={open} onClose={() => setOpen(false)} variant="drawer" title={editing ? `Edit ${editing.name}` : 'Add branch'}
        footer={<>
          {!editing && <span className="mg-draft-note">Closing keeps what you typed.</span>}
          <Button variant="secondary" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
          <Button variant="primary" onClick={save} loading={saving}>{editing ? 'Save changes' : 'Add branch'}</Button>
        </>}>
        <form className="mg-form" onSubmit={save} noValidate>
          <div className="mg-form-section">
            <h3>Branch</h3>
            <div className="mg-grid-2">
              <Input label="Branch name *" value={form.name} onChange={set('name')} placeholder="e.g. Laxmi Nagar" autoFocus />
              <Input label="Short code *" value={form.code} onChange={set('code')} placeholder="e.g. LXN" />
            </div>
            <p className="mg-help">The code appears on bills and reports from this branch.</p>
          </div>
          <div className="mg-form-section">
            <h3>Contact</h3>
            <div className="mg-grid-2">
              <Input label="Phone" value={form.phone} onChange={set('phone')} placeholder="10-digit number" inputMode="tel" />
              <Input label="Email" type="email" value={form.email} onChange={set('email')} placeholder="branch@yourlab.in" />
            </div>
            <Input label="Address" value={form.address} onChange={set('address')} placeholder="Full branch address" />
          </div>
          <div className="mg-form-section">
            <h3>Status</h3>
            <div className="mg-seg" role="group" aria-label="Status">
              {[['Active', 'Open'], ['Inactive', 'Closed']].map(([value, label]) => (
                <button key={value} type="button" className={form.status === value ? 'is-on' : ''} aria-pressed={form.status === value} onClick={() => setForm((p) => ({ ...p, status: value }))}>{label}</button>
              ))}
            </div>
            <p className="mg-help">A closed branch keeps its records but cannot take new work.</p>
          </div>
          {formError && <p className="mg-error" role="alert">{formError}</p>}
        </form>
      </Modal>

      <ConfirmDialog isOpen={!!del} onClose={() => setDel(null)} onConfirm={confirmDelete} loading={deleting}
        title="Delete this branch?"
        message={`${del?.name || 'This branch'} will be removed for good. A branch that still has staff cannot be deleted - move them first.`}
        confirmText="Delete branch" />
    </div>
  );
}
