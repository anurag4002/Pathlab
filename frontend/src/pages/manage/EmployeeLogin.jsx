import React, { useState, useEffect } from 'react';
import { getUsers, createUser, updateUser, deleteUser } from '../../services/authService';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import useAuth from '../../hooks/useAuth';
import { DataTable, PageHeader, Button, Modal, Input, Select, ConfirmDialog, StatusBadge } from '../../components/common';

const EmployeeLogin = () => {
  const { user: currentUser } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);

  // Form States
  const [formOpen, setFormOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', password: '', role: 'Employee', status: 'Active' });
  const [errors, setErrors] = useState({});
  const [submitLoading, setSubmitLoading] = useState(false);

  // Search
  const [search, setSearch] = useState('');

  // Delete State
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const res = await getUsers({ search });
      if (res.success) {
        // filter out Doctor roles since they are managed separately
        const list = res.data.filter(u => u.role === 'Employee' || u.role === 'Admin');
        setEmployees(list);
      }
    } catch (err) {
      console.error('Failed to load employee list', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, [search]);

  const handleOpenCreate = () => {
    setEditingEmployee(null);
    setFormData({ name: '', email: '', phone: '', password: '', role: 'Employee', status: 'Active' });
    setErrors({});
    setFormOpen(true);
  };

  const handleOpenEdit = (emp) => {
    setEditingEmployee(emp);
    setFormData({
      name: emp.name,
      email: emp.email,
      phone: emp.phone || '',
      password: '', // blank password unless changing
      role: emp.role,
      status: emp.status
    });
    setErrors({});
    setFormOpen(true);
  };

  const validate = () => {
    const errs = {};
    if (!formData.name.trim()) errs.name = 'Name is required';
    if (!formData.email.trim()) errs.email = 'Email is required';
    if (!editingEmployee && !formData.password) errs.password = 'Password is required';
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
      if (!payload.password) delete payload.password; // don't send empty password on edit

      if (editingEmployee) {
        res = await updateUser(editingEmployee._id, payload);
      } else {
        res = await createUser(payload);
      }

      if (res.success) {
        setFormOpen(false);
        fetchEmployees();
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
        fetchEmployees();
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
        title="Employee Logins & Access"
        subtitle="Manage laboratory operator roles, passwords, and portal permissions"
        action={
          <Button variant="primary" onClick={handleOpenCreate}>
            <Plus size={16} /> Register Employee
          </Button>
        }
      />

      <DataTable
        headers={['Name', 'Email', 'Role', 'Status', 'Actions']}
        data={employees}
        loading={loading}
        emptyMessage="No employee accounts matching query."
        searchValue={search}
        onSearchChange={(e) => setSearch(e.target.value)}
        searchPlaceholder="Search by name or email..."
        renderRow={(emp) => (
          <tr key={emp._id}>
            <td style={{ fontWeight: '600' }}>{emp.name}</td>
            <td>{emp.email}</td>
            <td>
              <StatusBadge status={emp.role} />
            </td>
            <td>
              <StatusBadge status={emp.status} />
            </td>
            <td>
              {emp._id !== currentUser?._id ? (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    className="btn btn-secondary"
                    style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                    onClick={() => handleOpenEdit(emp)}
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    className="btn btn-danger"
                    style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                    onClick={() => setDeleteTarget(emp)}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ) : (
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Active Session</span>
              )}
            </td>
          </tr>
        )}
      />

      {/* Form Modal */}
      <Modal
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        title={editingEmployee ? 'Edit Account' : 'Register Operator'}
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
            label="Full Name"
            name="name"
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            error={errors.name}
            required
          />

          <Input
            label="Email Address"
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
            label={editingEmployee ? "Reset Password (Leave blank to keep current)" : "Password *"}
            name="password"
            type="password"
            value={formData.password}
            onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
            error={errors.password}
            required={!editingEmployee}
          />

          <div style={{ display: 'flex', gap: '16px' }}>
            <Select
              label="Portal Role"
              value={formData.role}
              onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value }))}
              options={[
                { value: 'Employee', label: 'Laboratory Operator / Employee' },
                { value: 'Admin', label: 'Administrator' }
              ]}
              required
              style={{ flex: 1 }}
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
              style={{ flex: 1 }}
            />
          </div>

        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        loading={deleteLoading}
        title="Remove Employee account?"
        message={`Are you sure you want to permanently delete the login files for ${deleteTarget?.name}?`}
      />
    </div>
  );
};

export default EmployeeLogin;
