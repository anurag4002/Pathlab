import React, { useState, useEffect } from 'react';
import { getDoctors, createDoctor, updateDoctor, deleteDoctor } from '../../services/doctorService';
import useClientPagination from '../../hooks/useClientPagination';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import { DataTable, PageHeader, Button, Modal, Input, Select, ConfirmDialog, StatusBadge } from '../../components/common';

const ReferralDoctors = () => {
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

  // Delete
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Client-side pagination (GET /api/doctors returns the full list).
  const pg = useClientPagination(doctors, 10);

  const fetchDoctors = async () => {
    setLoading(true);
    try {
      const res = await getDoctors({ search });
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
  }, [search]);

  const handleOpenCreate = () => {
    setEditingDoctor(null);
    setFormData({ name: '', phone: '', clinicHospital: '', address: '', referralPercentage: '10', status: 'Active' });
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
        fetchDoctors();
      }
    } catch (err) {
      setErrors({ api: err.response?.data?.message || 'Failed to save doctor details' });
    } finally {
      setFormSubmitLoading(false);
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
      alert(err.response?.data?.message || 'Failed to remove doctor profile');
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Referral Doctors Directory"
        subtitle="Manage referring clinics, physicians, and sales commission percentages"
        action={
          <Button variant="primary" onClick={handleOpenCreate}>
            <Plus size={16} /> Add Doctor
          </Button>
        }
      />

      <DataTable
        headers={['Name', 'Phone', 'Clinic / Hospital', 'Address', 'Commission %', 'Status', 'Actions']}
        data={pg.paged}
        loading={loading}
        emptyMessage="No referral doctor profiles matching your query."
        searchValue={search}
        onSearchChange={(e) => { setSearch(e.target.value); pg.reset(); }}
        searchPlaceholder="Search by doctor name..."
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
            <td style={{ fontWeight: '600' }}>{doctor.name}</td>
            <td>{doctor.phone}</td>
            <td>{doctor.clinicHospital || 'Walk-in'}</td>
            <td>{doctor.address || 'N/A'}</td>
            <td style={{ fontWeight: '600', color: 'var(--primary-color)' }}>
              {doctor.referralPercentage}%
            </td>
            <td>
              <StatusBadge status={doctor.status} />
            </td>
            <td>
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
            </td>
          </tr>
        )}
      />

      {/* Profile Modal */}
      <Modal
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        title={editingDoctor ? 'Edit Doctor Profile' : 'Add Referral Doctor'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setFormOpen(false)} disabled={formSubmitLoading}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleFormSubmit} loading={formSubmitLoading}>
              Save profile
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
            placeholder="e.g. Dr. Preeti Ahluwalia"
            required
          />
          <Input
            label="Phone Number"
            name="phone"
            value={formData.phone}
            onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
            error={errors.phone}
            required
          />
          <Input
            label="Clinic / Hospital Name"
            name="clinicHospital"
            value={formData.clinicHospital}
            onChange={(e) => setFormData(prev => ({ ...prev, clinicHospital: e.target.value }))}
            placeholder="e.g. Metro Heart Institute"
          />
          <Input
            label="Clinic Address"
            name="address"
            value={formData.address}
            onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
          />
          <div style={{ display: 'flex', gap: '16px' }}>
            <Input
              label="Referral Commission %"
              name="referralPercentage"
              type="number"
              value={formData.referralPercentage}
              onChange={(e) => setFormData(prev => ({ ...prev, referralPercentage: e.target.value }))}
              error={errors.referralPercentage}
              required
              style={{ flex: 1 }}
            />
            <Select
              label="Account Status"
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
        title="Remove Doctor Profile?"
        message={`Are you sure you want to permanently delete the referral profile for ${deleteTarget?.name}?`}
      />
    </div>
  );
};

export default ReferralDoctors;
