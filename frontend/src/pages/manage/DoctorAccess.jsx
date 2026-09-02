import React, { useState, useEffect } from 'react';
import { getUsers, createUser, updateUser, deleteUser } from '../../services/authService';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import { DataTable, PageHeader, Button, Modal, Input, Select, ConfirmDialog, StatusBadge } from '../../components/common';

const DoctorAccess = () => {
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(false);

  // Form States
  const [formOpen, setFormOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState(null);
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', password: '', role: 'Doctor', status: 'Active' });
  const [errors, setErrors] = useState({});
  const [submitLoading, setSubmitLoading] = useState(false);

  // Search
  const [search, setSearch] = useState('');

  // Delete State
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchDoctors = async () => {
    setLoading(true);
    try {
      const res = await getUsers({ search });
      if (res.success) {
        // filter out only Doctors
        const list = res.data.filter(u => u.role === 'Doctor');
        setDoctors(list);
      }
    } catch (err) {
      console.error('Failed to load doctors access list', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDoctors();
  }, [search]);

  const handleOpenCreate = () => {
    setEditingDoc(null);
    setFormData({ name: '', email: '', phone: '', password: '', role: 'Doctor', status: 'Active' });
    setErrors({});
    setFormOpen(true);
  };

  const handleOpenEdit = (doc) => {
    setEditingDoc(doc);
    setFormData({
      name: doc.name,
      email: doc.email,
      phone: doc.phone || '',
      password: '',
      role: 'Doctor',
      status: doc.status
    });
    setErrors({});
    setFormOpen(true);
  };

  const validate = () => {
    const errs = {};
    if (!formData.name.trim()) errs.name = 'Name is required';
    if (!formData.email.trim()) errs.email = 'Email is required';
    if (!editingDoc && !formData.password) errs.password = 'Password is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitLoading(true);
    try {
      let res;
      const payload = { ...formData };
      if (!payload.password) delete payload.password;

      if (editingDoc) {
        res = await updateUser(editingDoc._id, payload);
      } else {
        res = await createUser(payload);
      }

      if (res.success) {
        setFormOpen(false);
        fetchDoctors();
      }
    } catch (err) {
      setErrors({ api: err.response?.data?.message || 'Failed to save account details' });
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      const res = await deleteUser(deleteTarget._id);
      if (res.success) {
        setDeleteTarget(null);
        fetchDoctors();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete user');
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Doctor Portal Access"
        subtitle="Manage secure diagnostic reporting logins for radiologists and referring doctors"
        action={
          <Button variant="primary" onClick={handleOpenCreate}>
            <Plus size={16} /> Register Doctor Access
          </Button>
        }
      />

      <DataTable
        headers={['Name', 'Email Address', 'Role', 'Status', 'Actions']}
        data={doctors}
        loading={loading}
        emptyMessage="No Doctor accounts configured."
        searchValue={search}
        onSearchChange={(e) => setSearch(e.target.value)}
        searchPlaceholder="Search by doctor name..."
        renderRow={(doc) => (
          <tr key={doc._id}>
            <td style={{ fontWeight: '600' }}>{doc.name}</td>
            <td>{doc.email}</td>
            <td>
              <StatusBadge status={doc.role} />
            </td>
            <td>
              <StatusBadge status={doc.status} />
            </td>
            <td>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  className="btn btn-secondary"
                  style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                  onClick={() => handleOpenEdit(doc)}
                >
                  <Edit2 size={14} />
                </button>
                <button
                  className="btn btn-danger"
                  style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                  onClick={() => setDeleteTarget(doc)}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </td>
          </tr>
        )}
      />

      {/* Form Modal */}
      <Modal
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        title={editingDoc ? 'Edit Account' : 'Register Doctor Login'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setFormOpen(false)} disabled={submitLoading}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleFormSubmit} loading={submitLoading}>
              Save Account
            </Button>
          </>
        }
      >
        <form onSubmit={handleFormSubmit} className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
          {errors.api && <div className="form-error">{errors.api}</div>}
          
          <Input
            label="Doctor Name"
            name="name"
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            error={errors.name}
            placeholder="e.g. Dr. Anil Mehta"
            required
          />

          <Input
            label="Email Address / Login ID"
            name="email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
            error={errors.email}
            required
          />

          <Input
            label="Phone"
            name="phone"
            value={formData.phone}
            onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
          />

          <Input
            label={editingDoc ? "Reset Password (Leave blank to keep current)" : "Password *"}
            name="password"
            type="password"
            value={formData.password}
            onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
            error={errors.password}
            required={!editingDoc}
          />

          <Select
            label="Status"
            value={formData.status}
            onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
            options={[
              { value: 'Active', label: 'Active' },
              { value: 'Inactive', label: 'Inactive' }
            ]}
            required
          />

        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        loading={deleteLoading}
        title="Remove Doctor Access?"
        message={`Are you sure you want to permanently delete the login files for ${deleteTarget?.name}?`}
      />
    </div>
  );
};

export default DoctorAccess;
