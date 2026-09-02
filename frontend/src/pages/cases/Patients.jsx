import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getPatients, createPatient, updatePatient, deletePatient } from '../../services/patientService';
import { getDoctors } from '../../services/doctorService';
import { PATIENT_TABLE_HEADERS, GENDER_OPTIONS } from '../../constants/patientConstants';
import usePagination from '../../hooks/usePagination';
import useDebounce from '../../hooks/useDebounce';
import * as Icons from 'lucide-react';
import { DataTable, PageHeader, Button, Modal, Input, Select, ConfirmDialog } from '../../components/common';

const Patients = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  // Data lists
  const [patients, setPatients] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [doctorsLoading, setDoctorsLoading] = useState(false);
  
  // Form states
  const [formOpen, setFormOpen] = useState(false);
  const [editingPatient, setEditingPatient] = useState(null);
  const [formData, setFormData] = useState({ name: '', age: '', gender: '', phone: '', address: '', referringDoctor: '' });
  const [errors, setErrors] = useState({});
  const [formSubmitLoading, setFormSubmitLoading] = useState(false);

  // Search & Pagination
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 500);
  const { page, limit, goToPage } = usePagination(1, 10);
  const [paginationInfo, setPaginationInfo] = useState({ total: 0, pages: 0 });

  // Delete State
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchPatientsList = async () => {
    setLoading(true);
    try {
      const res = await getPatients({ search: debouncedSearch, page, limit });
      if (res.success) {
        setPatients(res.data.patients);
        setPaginationInfo(res.data.pagination);
      }
    } catch (err) {
      console.error('Failed to load patients', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchDoctorsList = async () => {
    setDoctorsLoading(true);
    try {
      const res = await getDoctors({ status: 'Active' });
      if (res.success) {
        setDoctors(res.data.map(d => ({ value: d._id, label: `${d.name} (${d.clinicHospital || 'Self'})` })));
      }
    } catch (err) {
      console.error('Failed to fetch doctors', err);
    } finally {
      setDoctorsLoading(false);
    }
  };

  useEffect(() => {
    fetchPatientsList();
  }, [debouncedSearch, page, limit]);

  useEffect(() => {
    fetchDoctorsList();
    if (searchParams.get('add') === 'true') {
      handleOpenCreate();
    }
  }, [searchParams]);

  const handleOpenCreate = () => {
    setEditingPatient(null);
    setFormData({ name: '', age: '', gender: '', phone: '', address: '', referringDoctor: '' });
    setErrors({});
    setFormOpen(true);
  };

  const handleOpenEdit = (patient) => {
    setEditingPatient(patient);
    setFormData({
      name: patient.name,
      age: patient.age,
      gender: patient.gender,
      phone: patient.phone,
      address: patient.address || '',
      referringDoctor: patient.referringDoctor?._id || ''
    });
    setErrors({});
    setFormOpen(true);
  };

  const validate = () => {
    const errs = {};
    if (!formData.name.trim()) errs.name = 'Patient name is required';
    if (!formData.age || isNaN(formData.age) || Number(formData.age) < 0) {
      errs.age = 'Valid age is required';
    }
    if (!formData.gender) errs.gender = 'Gender is required';
    if (!formData.phone.trim()) errs.phone = 'Phone number is required';
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
        referringDoctor: formData.referringDoctor || null
      };

      if (editingPatient) {
        res = await updatePatient(editingPatient._id, payload);
      } else {
        res = await createPatient(payload);
      }

      if (res.success) {
        setFormOpen(false);
        fetchPatientsList();
      }
    } catch (err) {
      setErrors({ api: err.response?.data?.message || 'Failed to submit patient details' });
    } finally {
      setFormSubmitLoading(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      const res = await deletePatient(deleteTarget._id);
      if (res.success) {
        setDeleteTarget(null);
        fetchPatientsList();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete patient profile');
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Patients File Registry"
        subtitle="Manage laboratory patient records and look up case history files"
        action={
          <Button variant="primary" onClick={handleOpenCreate}>
            <Icons.UserPlus size={16} /> Add Patient
          </Button>
        }
      />

      <DataTable
        headers={PATIENT_TABLE_HEADERS}
        data={patients}
        loading={loading}
        emptyMessage="No patient profiles matched your query."
        searchValue={search}
        onSearchChange={(e) => {
          setSearch(e.target.value);
          goToPage(1);
        }}
        searchPlaceholder="Search by name, phone or reg no..."
        pagination={{
          total: paginationInfo.total,
          page,
          limit,
          pages: paginationInfo.pages,
          onPageChange: goToPage
        }}
        renderRow={(patient) => (
          <tr key={patient._id}>
            <td style={{ fontWeight: '600', color: 'var(--primary-color)' }}>
              {patient.registrationNumber}
            </td>
            <td style={{ fontWeight: '600' }}>{patient.name}</td>
            <td>{patient.age} Yrs</td>
            <td>{patient.gender}</td>
            <td>{patient.phone}</td>
            <td>{patient.referringDoctor?.name || 'Self'}</td>
            <td>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  className="btn btn-secondary"
                  style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                  onClick={() => navigate(`/cases/patients/${patient._id}`)}
                >
                  <Icons.FolderOpen size={14} /> Details
                </button>
                <button
                  className="btn btn-secondary"
                  style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                  onClick={() => handleOpenEdit(patient)}
                >
                  <Icons.Edit2 size={14} />
                </button>
                <button
                  className="btn btn-danger"
                  style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                  onClick={() => setDeleteTarget(patient)}
                >
                  <Icons.Trash2 size={14} />
                </button>
              </div>
            </td>
          </tr>
        )}
      />

      {/* Profile Creation/Edit Modal */}
      <Modal
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        title={editingPatient ? 'Edit Patient details' : 'Register New Patient'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setFormOpen(false)} disabled={formSubmitLoading}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleFormSubmit} loading={formSubmitLoading}>
              Save details
            </Button>
          </>
        }
      >
        <form onSubmit={handleFormSubmit} className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
          {errors.api && <div className="form-error" style={{ marginBottom: '10px' }}>{errors.api}</div>}
          <Input
            label="Patient Name"
            name="name"
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            error={errors.name}
            required
          />
          <div style={{ display: 'flex', gap: '16px' }}>
            <Input
              label="Age (Years)"
              name="age"
              type="number"
              value={formData.age}
              onChange={(e) => setFormData(prev => ({ ...prev, age: e.target.value }))}
              error={errors.age}
              required
              style={{ flex: 1 }}
            />
            <Select
              label="Gender"
              name="gender"
              value={formData.gender}
              onChange={(e) => setFormData(prev => ({ ...prev, gender: e.target.value }))}
              options={GENDER_OPTIONS}
              error={errors.gender}
              required
              placeholder="Select Gender"
              style={{ flex: 1 }}
            />
          </div>
          <Input
            label="Phone Number"
            name="phone"
            value={formData.phone}
            onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
            error={errors.phone}
            required
          />
          <Input
            label="Full Address"
            name="address"
            value={formData.address}
            onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
          />
          <Select
            label="Referring Doctor"
            name="referringDoctor"
            value={formData.referringDoctor}
            onChange={(e) => setFormData(prev => ({ ...prev, referringDoctor: e.target.value }))}
            options={doctors}
            placeholder={doctorsLoading ? 'Loading doctors list...' : 'Walk-in / Self'}
          />
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        loading={deleteLoading}
        title="Delete Patient Profile?"
        message={`Are you sure you want to permanently delete patient files for ${deleteTarget?.name}? This removes historical records associated.`}
      />
    </div>
  );
};

export default Patients;
