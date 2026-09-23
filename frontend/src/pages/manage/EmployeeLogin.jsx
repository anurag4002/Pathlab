import React, { useState, useEffect } from 'react';
import { getUsers, createUser, updateUser, deleteUser } from '../../services/authService';
import useClientPagination from '../../hooks/useClientPagination';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import useAuth from '../../hooks/useAuth';
import { DataTable, PageHeader, Button, Modal, ConfirmDialog, StatusBadge } from '../../components/common';
import EmployeeForm from './components/EmployeeForm';
import { permsToMap } from './components/PermissionMatrix';

const EMPTY_FORM = {
  name: '', email: '', phone: '', password: '', role: 'Employee', status: 'Active',
  permissions: {}, designation: '', qualification: '', joiningDate: '', departments: [], documents: '',
};

const EmployeeLogin = () => {
  const { user: currentUser } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);

  // Form States
  const [formOpen, setFormOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [submitLoading, setSubmitLoading] = useState(false);

  // Search
  const [search, setSearch] = useState('');

  // Delete State
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Client-side pagination (GET /api/users returns the full list).
  const pg = useClientPagination(employees, 10);

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const [empRes, adminRes] = await Promise.all([
        getUsers({ role: 'Employee', search }).catch(() => null),
        getUsers({ role: 'Admin', search }).catch(() => null),
      ]);
      let list = [];
      if (empRes?.success) list = list.concat(empRes.data);
      if (adminRes?.success) list = list.concat(adminRes.data);
      if (!empRes && !adminRes) {
        const res = await getUsers({ search });
        if (res.success) list = res.data.filter(u => u.role === 'Employee' || u.role === 'Admin');
      }
      setEmployees(Array.isArray(list) ? list : list?.users || []);
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
    setFormData(EMPTY_FORM);
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
      status: emp.status,
      // Phase 25 — backend stores permissions as a Map (object over the
      // wire); legacy arrays are converted to { key: true } on the way in.
      permissions: permsToMap(emp.permissions),
      designation: emp.designation || '',
      qualification: emp.qualification || '',
      joiningDate: emp.joiningDate || emp.joinedOn?.split?.('T')?.[0] || '',
      departments: emp.departments || (emp.department ? [emp.department] : []),
      documents: emp.documents || '',
    });
    setErrors({});
    setFormOpen(true);
  };

  const validate = () => {
    const errs = {};
    if (!formData.name.trim()) errs.name = 'Name is required';
    if (!formData.email.trim()) errs.email = 'Email is required';
    if (!editingEmployee && !formData.password) errs.password = 'Password is required';
    if (!(formData.departments || []).length) errs.departments = 'Pick at least one department';
    if (formData.role === 'Admin' && editingEmployee?._id === currentUser?._id && formData.status !== 'Active') {
      errs.status = 'You cannot deactivate your own admin account';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitLoading(true);
    try {
      let res;
      // Phase 25 — send permissions as an OBJECT MAP { key: true } to match
      // the backend Map. Never send the legacy array shape.
      const permsMap = permsToMap(formData.permissions);
      const payload = {
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        role: formData.role,
        status: formData.status,
        permissions: permsMap,
        // Phase 19 — extended profile fields. Backend gap: User model +
        // create/update whitelists do not persist these yet; they are sent
        // for forward-compat and documented in the form note.
        designation: formData.designation || undefined,
        qualification: formData.qualification || undefined,
        joiningDate: formData.joiningDate || undefined,
        departments: formData.departments,
        documents: formData.documents || undefined,
      };
      if (!formData.password) delete payload.password;
      else payload.password = formData.password;

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
        data={pg.paged}
        loading={loading}
        emptyMessage="No employee accounts matching query."
        searchValue={search}
        onSearchChange={(e) => { setSearch(e.target.value); pg.reset(); }}
        searchPlaceholder="Search by name or email..."
        pagination={{
          total: pg.total,
          page: pg.page,
          limit: pg.limit,
          pages: pg.pages,
          onPageChange: pg.goToPage,
          onLimitChange: pg.setLimit,
        }}
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

      {/* Form Modal — Phase 19 extended form + Phase 25 permission matrix.
          Sessions panel omitted: session list/revoke endpoints do not exist. */}
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
        <form onSubmit={handleFormSubmit}>
          <EmployeeForm
            formData={formData}
            setFormData={setFormData}
            errors={errors}
            editing={!!editingEmployee}
            isSuperadmin={editingEmployee?.role === 'Admin' && Object.keys(permsToMap(editingEmployee?.permissions)).length === 0}
          />
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
