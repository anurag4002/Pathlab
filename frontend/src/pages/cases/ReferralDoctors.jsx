import React, { useState, useEffect } from 'react';
import { getDoctors, createDoctor, updateDoctor, deleteDoctor } from '../../services/doctorService';
import useClientPagination from '../../hooks/useClientPagination';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import { DataTable, PageHeader, Button, Modal, Input, Select, ConfirmDialog, StatusBadge, AdvancedFilterBar, RowMenu } from '../../components/common';
import './v2/casesV2.css';
import { notify } from '../../components/common/Toast/toast';
import IdentityCell from '../../components/common/IdentityCell/IdentityCell';
import { useUiVersion } from '../../utils/uiVersion';

const STATUS_OPTIONS = [
  { value: 'Active', label: 'Active' },
  { value: 'Inactive', label: 'Inactive' }
];

const ReferralDoctors = () => {
  const isV2 = useUiVersion() === 'v2';
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(false);

  // Form States
  const [formOpen, setFormOpen] = useState(false);
  const [editingDoctor, setEditingDoctor] = useState(null);
  const [formData, setFormData] = useState({ name: '', phone: '', clinicHospital: '', address: '', referralPercentage: '', status: 'Active' });
  const [errors, setErrors] = useState({});
  const [formSubmitLoading, setFormSubmitLoading] = useState(false);

  // Search
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Delete
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Client-side filter + pagination (avoid refetching the API on every keystroke).
  const filtered = doctors.filter((d) => {
    if (statusFilter && d.status !== statusFilter) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return String(d.name || '').toLowerCase().includes(q)
      || String(d.phone || '').toLowerCase().includes(q)
      || String(d.clinicHospital || '').toLowerCase().includes(q);
  });
  const pg = useClientPagination(filtered, 10);

  const fetchDoctors = async () => {
    setLoading(true);
    try {
      const res = await getDoctors();
      if (res.success) {
        setDoctors(res.data);
      }
    } catch (err) {
      console.error('Failed to load doctors list', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDoctors();
  }, []);

  const handleOpenCreate = () => {
    // New look: a half-typed new doctor survives closing the panel.
    const keepDraft = isV2 && !editingDoctor && formData.name !== undefined && (formData.name || formData.phone);
    setEditingDoctor(null);
    if (!keepDraft) setFormData({ name: '', phone: '', clinicHospital: '', address: '', referralPercentage: '10', status: 'Active' });
    setErrors({});
    setFormOpen(true);
  };

  const handleOpenEdit = (doctor) => {
    setEditingDoctor(doctor);
    setFormData({
      name: doctor.name,
      phone: doctor.phone,
      clinicHospital: doctor.clinicHospital || '',
      address: doctor.address || '',
      referralPercentage: String(doctor.referralPercentage || 0),
      status: doctor.status
    });
    setErrors({});
    setFormOpen(true);
  };

  const validate = () => {
    const errs = {};
    if (!formData.name.trim()) errs.name = 'Doctor name is required';
    if (!formData.phone.trim()) errs.phone = 'Phone number is required';
    const pct = Number(formData.referralPercentage);
    if (isNaN(pct) || pct < 0 || pct > 100) {
      errs.referralPercentage = 'Commission must be between 0% and 100%';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setFormSubmitLoading(true);
    try {
      let res;
      const payload = {
        ...formData,
        referralPercentage: Number(formData.referralPercentage)
      };

      if (editingDoctor) {
        res = await updateDoctor(editingDoctor._id, payload);
      } else {
        res = await createDoctor(payload);
      }

      if (res.success) {
        setFormOpen(false);
        if (!editingDoctor) setFormData({ name: '', phone: '', clinicHospital: '', address: '', referralPercentage: '10', status: 'Active' });
        fetchDoctors();
      }
    } catch (err) {
      setErrors({ api: err.response?.data?.message || 'Failed to save doctor details' });
    } finally {
      setFormSubmitLoading(false);
    }
  };

  const toggleActive = async (doctor) => {
    try {
      const res = await updateDoctor(doctor._id, {
        name: doctor.name, phone: doctor.phone, clinicHospital: doctor.clinicHospital || '', address: doctor.address || '',
        referralPercentage: Number(doctor.referralPercentage || 0), status: doctor.status === 'Active' ? 'Inactive' : 'Active'
      });
      if (res.success) fetchDoctors();
    } catch (err) {
      notify(err.response?.data?.message || 'Could not change the status.');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      const res = await deleteDoctor(deleteTarget._id);
      if (res.success) {
        setDeleteTarget(null);
        fetchDoctors();
      }
    } catch (err) {
      notify(err.response?.data?.message || 'Failed to remove doctor profile');
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Referral Doctors Directory"
        subtitle={isV2 ? 'Doctors and clinics who send patients, and the commission each one gets.' : 'Manage referring clinics, physicians, and sales commission percentages'}
        action={
          <Button variant="primary" onClick={handleOpenCreate}>
            <Plus size={16} /> {isV2 ? 'Add doctor' : 'Add Doctor'}
          </Button>
        }
      />

      <AdvancedFilterBar
        showSearchButton={false}
        showClearButton={!!(search || statusFilter)}
        onClear={() => { setSearch(''); setStatusFilter(''); pg.reset(); }}
        values={{ search, status: statusFilter }}
        onChange={(key, value) => {
          pg.reset();
          if (key === 'search') setSearch(value);
          else if (key === 'status') setStatusFilter(value);
        }}
        fields={isV2 ? [
          { key: 'status', type: 'segmented', options: [{ value: '', label: 'All' }, ...STATUS_OPTIONS] },
          { key: 'search', label: 'Search', type: 'text', size: 'lg', placeholder: 'Doctor, clinic or phone' }
        ] : [
          { key: 'search', label: 'Search', type: 'text', size: 'lg', placeholder: 'Search by doctor name...' },
          { key: 'status', label: 'Status', type: 'select', options: STATUS_OPTIONS, placeholder: 'All statuses' }
        ]}
      />

      <DataTable
        headers={isV2 ? ['Doctor', <span key="c" className="th-num">Commission</span>, 'Status', ''] : ['Name', 'Phone', 'Clinic / Hospital', 'Address', 'Commission %', 'Status', 'Actions']}
        data={pg.paged}
        loading={loading}
        emptyMessage={isV2 ? (search || statusFilter ? 'No doctor matches these filters.' : 'No referral doctors yet. Add the doctors who send you patients.') : 'No referral doctor profiles matching your query.'}
        pagination={{
          total: pg.total,
          page: pg.page,
          limit: pg.limit,
          pages: pg.pages,
          onPageChange: pg.goToPage,
          onLimitChange: pg.setLimit,
        }}
        renderRow={(doctor) => (
          <tr key={doctor._id}>
            {isV2 ? (
              <>
                <td><IdentityCell name={doctor.name} meta={[doctor.clinicHospital && doctor.clinicHospital !== 'Walk-in' ? doctor.clinicHospital : '']}
                  copy={doctor.phone && !/^0+$/.test(doctor.phone) ? { value: doctor.phone, label: 'phone' } : undefined} /></td>
                <td className="num">{doctor.referralPercentage}%</td>
              </>
            ) : (
              <>
                <td style={{ fontWeight: '600' }}>{doctor.name}</td>
                <td>{doctor.phone}</td>
                <td>{doctor.clinicHospital || 'Walk-in'}</td>
                <td>{doctor.address || 'N/A'}</td>
                <td style={{ fontWeight: '600', color: 'var(--primary-color)' }}>
                  {doctor.referralPercentage}%
                </td>
              </>
            )}
            <td>
              <StatusBadge status={doctor.status} />
            </td>
            <td>
              {isV2 ? (
                <div className="row-actions-v2">
                  <Button variant="secondary" size="sm" icon={<Edit2 size={14} />} onClick={() => handleOpenEdit(doctor)} aria-label={`Edit ${doctor.name}`}>Edit</Button>
                  <RowMenu label={`More actions for ${doctor.name}`} items={[
                    { label: doctor.status === 'Active' ? 'Make inactive' : 'Make active', onClick: () => toggleActive(doctor) },
                    { label: 'Delete doctor', onClick: () => setDeleteTarget(doctor), danger: true },
                  ]} />
                </div>
              ) : (
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  className="btn btn-secondary"
                  style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                  onClick={() => handleOpenEdit(doctor)}
                >
                  <Edit2 size={14} />
                </button>
                <button
                  className="btn btn-danger"
                  style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                  onClick={() => setDeleteTarget(doctor)}
                >
                  <Trash2 size={14} />
                </button>
              </div>
              )}
            </td>
          </tr>
        )}
      />

      {/* Profile Modal */}
      <Modal
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        title={isV2 ? (editingDoctor ? 'Edit doctor' : 'New doctor') : editingDoctor ? 'Edit Doctor Profile' : 'Add Referral Doctor'}
        variant="drawer"
        footer={
          <>
            {isV2 && !editingDoctor && <span className="cases-drawer-note">Closing keeps what you typed.</span>}
            <Button variant="secondary" onClick={() => setFormOpen(false)} disabled={formSubmitLoading}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleFormSubmit} loading={formSubmitLoading}>
              {isV2 ? (editingDoctor ? 'Save changes' : 'Add doctor') : 'Save profile'}
            </Button>
          </>
        }
      >
        <form onSubmit={handleFormSubmit} className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
          {errors.api && <div className="form-error">{errors.api}</div>}
          <Input
            label={isV2 ? 'Name' : 'Doctor Name'}
            name="name"
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            error={errors.name}
            placeholder="e.g. Dr. Preeti Ahluwalia"
            required
          />
          <Input
            label={isV2 ? 'Phone number' : 'Phone Number'}
            name="phone"
            value={formData.phone}
            onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
            error={errors.phone}
            required
          />
          <Input
            label={isV2 ? 'Clinic or hospital' : 'Clinic / Hospital Name'}
            name="clinicHospital"
            value={formData.clinicHospital}
            onChange={(e) => setFormData(prev => ({ ...prev, clinicHospital: e.target.value }))}
            placeholder="e.g. Metro Heart Institute"
          />
          <Input
            label={isV2 ? 'Address' : 'Clinic Address'}
            name="address"
            value={formData.address}
            onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
          />
          <div style={{ display: 'flex', gap: '16px' }}>
            <Input
              label={isV2 ? 'Commission %' : 'Referral Commission %'}
              name="referralPercentage"
              type="number"
              value={formData.referralPercentage}
              onChange={(e) => setFormData(prev => ({ ...prev, referralPercentage: e.target.value }))}
              error={errors.referralPercentage}
              required
              style={{ flex: 1 }}
            />
            <Select
              label={isV2 ? 'Status' : 'Account Status'}
              name="status"
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
        title={isV2 ? 'Delete this doctor?' : 'Remove Doctor Profile?'}
        message={isV2 ? `${deleteTarget?.name} will be removed from the list. Old bills keep their name. Tip: "Make inactive" hides them without deleting.` : `Are you sure you want to permanently delete the referral profile for ${deleteTarget?.name}?`}
      />
    </div>
  );
};

export default ReferralDoctors;
