import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Edit2, Trash2, UserCheck, UserX, RefreshCw } from 'lucide-react';
import { getUsers, createUser, updateUser, deleteUser } from '../../services/authService';
import useAuth from '../../hooks/useAuth';
import useDebounce from '../../hooks/useDebounce';
import useClientPagination from '../../hooks/useClientPagination';
import { validateEmail } from '../../utils/validators';
import formatDate from '../../utils/formatDate';
import { DataTable, PageHeader, Button, Modal, Select, ConfirmDialog, StatusBadge } from '../../components/common';
import EmployeeForm from './components/EmployeeForm';
import { permsToMap } from './components/PermissionMatrix';
import '../../styles/UserManagement.css';

const STAFF_ROLES = ['Employee', 'Admin'];
const ROLE_OPTIONS = [
  { value: 'Employee', label: 'Laboratory operator / employee' },
  { value: 'Admin', label: 'Administrator' }
];
const STATUS_OPTIONS = [
  { value: 'Active', label: 'Active' },
  { value: 'Inactive', label: 'Inactive' }
];
const EMPTY_FORM = {
  name: '',
  email: '',
  phone: '',
  password: '',
  role: 'Employee',
  status: 'Active',
  permissions: {},
  designation: '',
  qualification: '',
  joiningDate: '',
  departments: [],
  documents: ''
};

const getErrorMessage = (error, fallback) => {
  if (error?.response) {
    const message = error.response.data?.message;
    if (typeof message === 'string' && message.trim()) return message;
    const status = error.response.status;
    if (status === 401) return 'Your session has expired. Please log in again.';
    if (status === 403) return 'You do not have permission to manage user accounts.';
    if (status === 404) return 'The requested user account was not found.';
    if (status === 409) return 'The user account changed elsewhere. Refresh and try again.';
    if (status === 422) return 'The submitted user data is invalid.';
    if (status >= 500) return 'The server could not complete the user request.';
  }
  if (error?.code === 'ECONNABORTED') return 'The request timed out. Please try again.';
  if (error?.code === 'ERR_NETWORK' || error?.request) return 'Network error. Check your connection and try again.';
  return error?.message || fallback;
};

const getFieldErrors = (source) => {
  if (!source || typeof source !== 'object') return {};
  return Object.entries(source).reduce((errors, [field, value]) => {
    const message = Array.isArray(value) ? value[0] : value;
    if (typeof message === 'string' && message.trim()) errors[field] = message;
    return errors;
  }, {});
};

const getResponseError = (response, fallback) => ({
  message: response?.message || fallback,
  fields: getFieldErrors(response?.errors)
});

const EmployeeLogin = () => {
  const { user: currentUser } = useAuth();
  const canManage = currentUser?.role === 'Admin';

  const [usersState, setUsersState] = useState({ key: null, data: [], error: '' });
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const debouncedSearch = useDebounce(search, 400);
  const requestKey = JSON.stringify([debouncedSearch, roleFilter, statusFilter, refreshKey]);

  const [formOpen, setFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitLoading, setSubmitLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [statusTarget, setStatusTarget] = useState(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let active = true;
    const params = {};
    const trimmedSearch = debouncedSearch.trim();
    if (trimmedSearch) params.search = trimmedSearch;
    if (roleFilter) params.role = roleFilter;
    if (statusFilter) params.status = statusFilter;

    getUsers(params).then((response) => {
      if (!active) return;
      if (!response?.success) {
        const responseError = getResponseError(response, 'The user service returned an unsuccessful response.');
        setUsersState({ key: requestKey, data: [], error: responseError.message });
        return;
      }
      const rawUsers = Array.isArray(response.data) ? response.data : response.data?.users;
      if (!Array.isArray(rawUsers)) {
        setUsersState({ key: requestKey, data: [], error: 'The user service returned an invalid user list.' });
        return;
      }
      setUsersState({
        key: requestKey,
        data: rawUsers.filter((account) => STAFF_ROLES.includes(account.role)),
        error: ''
      });
    }).catch((error) => {
      if (active) setUsersState({ key: requestKey, data: [], error: getErrorMessage(error, 'Failed to load user accounts.') });
    });

    return () => { active = false; };
  }, [debouncedSearch, roleFilter, statusFilter, refreshKey, requestKey]);

  const users = useMemo(
    () => (usersState.key === requestKey ? usersState.data : []),
    [usersState.key, usersState.data, requestKey]
  );
  const pg = useClientPagination(users, 10);
  const loading = usersState.key !== requestKey;
  const listError = usersState.key === requestKey ? usersState.error : '';
  const searchPending = search !== debouncedSearch;
  const hasFilters = Boolean(search.trim() || roleFilter || statusFilter);

  useEffect(() => {
    pg.reset();
    // Reset client pagination whenever the server-side query changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, roleFilter, statusFilter, refreshKey]);

  const refreshUsers = () => setRefreshKey((value) => value + 1);

  const clearFormState = () => {
    setEditingUser(null);
    setFormData(EMPTY_FORM);
    setFormErrors({});
    setFormError('');
  };

  const openCreate = () => {
    if (!canManage) return;
    clearFormState();
    setActionError('');
    setNotice('');
    setFormOpen(true);
  };

  const openEdit = (account) => {
    if (!canManage || account._id === currentUser?._id) return;
    setActionError('');
    setNotice('');
    setEditingUser(account);
    setFormData({
      name: account.name || '',
      email: account.email || '',
      phone: account.phone || '',
      password: '',
      role: account.role,
      status: account.status,
      permissions: permsToMap(account.permissions),
      designation: account.designation || '',
      qualification: account.qualification || '',
      joiningDate: account.joiningDate || account.joinedOn?.split?.('T')?.[0] || '',
      departments: Array.isArray(account.departments)
        ? account.departments
        : account.department ? [account.department] : [],
      documents: Array.isArray(account.documents) ? account.documents.join(', ') : account.documents || ''
    });
    setFormErrors({});
    setFormError('');
    setFormOpen(true);
  };

  const closeForm = () => {
    if (submitLoading) return;
    setFormOpen(false);
    clearFormState();
  };

  const updateFormData = (update) => {
    setFormData(update);
    setFormErrors((current) => {
      if (!Object.keys(current).length) return current;
      return {};
    });
    setFormError('');
  };

  const validateForm = () => {
    const errors = {};
    const name = formData.name.trim();
    const email = formData.email.trim();
    const phone = formData.phone.trim();
    const password = formData.password;

    if (!name) errors.name = 'Name is required.';
    if (!email) errors.email = 'Email is required.';
    else if (!validateEmail(email)) errors.email = 'Enter a valid email address.';
    if (!phone) errors.phone = 'Phone is required.';
    if (!formData.role) errors.role = 'Role is required.';
    if (!formData.status) errors.status = 'Status is required.';
    if (!editingUser && (!password || password.length < 4)) errors.password = 'Password must be at least 4 characters.';
    else if (editingUser && password && password.length < 4) errors.password = 'Password must be at least 4 characters.';
    if (!(formData.departments || []).length) errors.departments = 'Pick at least one department.';
    if (editingUser?._id === currentUser?._id && formData.status !== 'Active') errors.status = 'You cannot deactivate your own account.';

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const submitForm = async (event) => {
    event.preventDefault();
    if (!canManage || submitLoading || !validateForm()) return;

    setSubmitLoading(true);
    setFormError('');
    setActionError('');
    setNotice('');

    const payload = {
      name: formData.name.trim(),
      email: formData.email.trim(),
      phone: formData.phone.trim(),
      role: formData.role,
      status: formData.status,
      permissions: permsToMap(formData.permissions),
      designation: formData.designation?.trim() || undefined,
      qualification: formData.qualification?.trim() || undefined,
      joiningDate: formData.joiningDate || undefined,
      departments: formData.departments,
      documents: String(formData.documents || '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean)
    };
    if (formData.password.trim()) payload.password = formData.password;

    try {
      const response = editingUser
        ? await updateUser(editingUser._id, payload)
        : await createUser(payload);
      if (!response?.success) {
        const responseError = getResponseError(response, 'The user account could not be saved.');
        setFormErrors(responseError.fields);
        setFormError(responseError.message);
        return;
      }
      setFormOpen(false);
      clearFormState();
      setNotice(response.message || 'User account saved.');
      refreshUsers();
    } catch (error) {
      setFormErrors(getFieldErrors(error?.response?.data?.errors));
      setFormError(getErrorMessage(error, 'Failed to save the user account.'));
    } finally {
      setSubmitLoading(false);
    }
  };

  const openDelete = (account) => {
    if (!canManage || account._id === currentUser?._id) return;
    setActionError('');
    setNotice('');
    setDeleteTarget(account);
  };

  const confirmDelete = async () => {
    if (!deleteTarget || deleteLoading) return;
    setDeleteLoading(true);
    setActionError('');
    try {
      const response = await deleteUser(deleteTarget._id);
      if (!response?.success) {
        setDeleteTarget(null);
        setActionError(response?.message || 'The user account could not be deleted.');
        return;
      }
      setDeleteTarget(null);
      setNotice(response.message || 'User account deleted.');
      refreshUsers();
    } catch (error) {
      setDeleteTarget(null);
      setActionError(getErrorMessage(error, 'Failed to delete the user account.'));
    } finally {
      setDeleteLoading(false);
    }
  };

  const openStatusChange = (account) => {
    if (!canManage || account._id === currentUser?._id) return;
    setActionError('');
    setNotice('');
    setStatusTarget(account);
  };

  const confirmStatusChange = async () => {
    if (!statusTarget || statusLoading) return;
    const nextStatus = statusTarget.status === 'Active' ? 'Inactive' : 'Active';
    setStatusLoading(true);
    setActionError('');
    try {
      const response = await updateUser(statusTarget._id, { status: nextStatus });
      if (!response?.success) {
        setStatusTarget(null);
        setActionError(response?.message || 'The user status could not be updated.');
        return;
      }
      setStatusTarget(null);
      setNotice(response.message || `User status updated to ${nextStatus}.`);
      refreshUsers();
    } catch (error) {
      setStatusTarget(null);
      setActionError(getErrorMessage(error, 'Failed to update the user status.'));
    } finally {
      setStatusLoading(false);
    }
  };

  const nextStatusLabel = statusTarget
    ? (statusTarget.status === 'Active' ? 'deactivate' : 'activate')
    : 'update';

  return (
    <div className="user-management-page">
      <PageHeader
        title="User Management"
        subtitle="Manage laboratory operator and administrator accounts, work profiles, and API-backed permissions."
        action={canManage ? (
          <Button variant="primary" onClick={openCreate} icon={<Plus size={16} />}>
            Create user
          </Button>
        ) : null}
      />

      {listError && (
        <div className="user-management-alert user-management-alert-error" role="alert">
          <span>{listError}</span>
          <Button variant="secondary" size="sm" onClick={refreshUsers} disabled={loading}>Retry</Button>
        </div>
      )}
      {actionError && <div className="user-management-alert user-management-alert-error" role="alert">{actionError}</div>}
      {notice && <div className="user-management-alert user-management-alert-success" role="status">{notice}</div>}

      <div className="user-management-filters" aria-label="User list filters">
        <Select
          label="Role"
          name="role-filter"
          value={roleFilter}
          onChange={(event) => setRoleFilter(event.target.value)}
          options={[{ value: '', label: 'All staff roles' }, ...ROLE_OPTIONS]}
          placeholder=""
          disabled={loading}
        />
        <Select
          label="Status"
          name="status-filter"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          options={[{ value: '', label: 'All statuses' }, ...STATUS_OPTIONS]}
          placeholder=""
          disabled={loading}
        />
        <Button variant="secondary" onClick={refreshUsers} disabled={loading} icon={<RefreshCw size={14} />}>
          Refresh
        </Button>
      </div>

      <p className="user-management-helper">
        Search and filters use the existing user API. Doctor accounts remain in Doctor Access.
      </p>

      <DataTable
        headers={['Name', 'Email', 'Phone', 'Role', 'Status', 'Created', 'Actions']}
        data={pg.paged}
        loading={loading || searchPending}
        emptyMessage={hasFilters ? 'No user accounts match the current search or filters.' : 'No user accounts are available.'}
        searchValue={search}
        onSearchChange={(event) => setSearch(event.target.value)}
        searchPlaceholder="Search by name, email, or phone..."
        pagination={{
          total: pg.total,
          page: pg.page,
          limit: pg.limit,
          pages: pg.pages,
          onPageChange: pg.goToPage,
          onLimitChange: pg.setLimit
        }}
        renderRow={(account) => {
          const isCurrentUser = account._id === currentUser?._id;
          return (
            <tr key={account._id}>
              <td style={{ fontWeight: 'var(--font-weight-semibold)' }}>{account.name || '—'}</td>
              <td>{account.email || '—'}</td>
              <td>{account.phone || '—'}</td>
              <td><StatusBadge status={account.role} /></td>
              <td><StatusBadge status={account.status} /></td>
              <td>{formatDate(account.createdAt)}</td>
              <td>
                {isCurrentUser ? (
                  <span className="user-management-current">Current user</span>
                ) : (
                  <div className="user-management-actions">
                    <Button variant="secondary" size="sm" onClick={() => openEdit(account)} aria-label={`Edit ${account.name || 'user'}`} disabled={!canManage}>
                      <Edit2 size={14} />
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => openStatusChange(account)} aria-label={`${account.status === 'Active' ? 'Deactivate' : 'Activate'} ${account.name || 'user'}`} disabled={!canManage}>
                      {account.status === 'Active' ? <UserX size={14} /> : <UserCheck size={14} />}
                    </Button>
                    <Button variant="danger" size="sm" onClick={() => openDelete(account)} aria-label={`Delete ${account.name || 'user'}`} disabled={!canManage}>
                      <Trash2 size={14} />
                    </Button>
                  </div>
                )}
              </td>
            </tr>
          );
        }}
      />

      <Modal
        isOpen={formOpen}
        onClose={closeForm}
        title={editingUser ? 'Edit user account' : 'Create user account'}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={closeForm} disabled={submitLoading}>Cancel</Button>
            <Button variant="primary" onClick={submitForm} loading={submitLoading}>Save user</Button>
          </>
        }
      >
        <form onSubmit={submitForm} noValidate>
          <EmployeeForm
            formData={formData}
            setFormData={updateFormData}
            errors={{ ...formErrors, api: formError }}
            editing={!!editingUser}
            isSuperadmin={editingUser?.role === 'Admin' && Object.keys(permsToMap(editingUser?.permissions)).length === 0}
          />
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!statusTarget}
        onClose={() => setStatusTarget(null)}
        onConfirm={confirmStatusChange}
        loading={statusLoading}
        title={`${nextStatusLabel === 'deactivate' ? 'Deactivate' : 'Activate'} user?`}
        message={`${nextStatusLabel === 'deactivate' ? 'Deactivate' : 'Activate'} ${statusTarget?.name || 'this user'}?`}
        confirmText={nextStatusLabel === 'deactivate' ? 'Deactivate' : 'Activate'}
        confirmVariant={nextStatusLabel === 'deactivate' ? 'danger' : 'primary'}
      />
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        loading={deleteLoading}
        title="Delete user account?"
        message={`Permanently delete ${deleteTarget?.name || 'this user'}? This cannot be undone.`}
        confirmText="Delete user"
      />
    </div>
  );
};

export default EmployeeLogin;
