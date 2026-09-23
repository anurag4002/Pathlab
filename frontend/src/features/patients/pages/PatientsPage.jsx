import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getPatients, createPatient, updatePatient, deletePatient } from '../../../services/patientService';
import { getDoctors } from '../../../services/doctorService';
import { DataTable, PageHeader, Button, ConfirmDialog, StatusBadge, AdvancedFilterBar } from '../../../components/common';
import { PATIENT_TABLE_HEADERS } from '../../../constants/patientConstants';
import PatientFormModal, { EMPTY_FORM } from '../components/PatientFormModal';
import usePagination from '../../../hooks/usePagination';
import useDebounce from '../../../hooks/useDebounce';
import { FolderOpen, Edit2, Trash2, UserPlus } from 'lucide-react';

const validatePatient = (formData) => {
  const errs = {};
  if (!formData.name.trim()) errs.name = 'Patient name is required';
  if (!formData.age || isNaN(formData.age) || Number(formData.age) < 0) {
    errs.age = 'Valid age is required';
  }
  if (!formData.gender) errs.gender = 'Gender is required';
  if (!formData.phone.trim()) errs.phone = 'Phone number is required';
  return errs;
};

const PatientsPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [patients, setPatients] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [doctorsLoading, setDoctorsLoading] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editingPatient, setEditingPatient] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [formSubmitLoading, setFormSubmitLoading] = useState(false);

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 500);
  const { page, limit, goToPage, setLimit } = usePagination(1, 10);
  const [paginationInfo, setPaginationInfo] = useState({ total: 0, pages: 0 });
  const [adv, setAdv] = useState({ uhid: '', firstName: '', lastName: '', mobile: '', patientId: '', from: '', to: '' });
  const setAdvKey = (k, v) => setAdv((p) => ({ ...p, [k]: v }));

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchPatientsList = async () => {
    setLoading(true);
    try {
      const res = await getPatients({
        search: debouncedSearch || undefined,
        uhid: adv.uhid || undefined,
        firstName: adv.firstName || undefined,
        lastName: adv.lastName || undefined,
        mobile: adv.mobile || undefined,
        patientId: adv.patientId || undefined,
        from: adv.from || undefined,
        to: adv.to || undefined,
        page, limit
      });
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
        setDoctors(
          res.data.map((d) => ({
            value: d._id,
            label: `${d.name} (${d.clinicHospital || 'Self'})`
          }))
        );
      }
    } catch (err) {
      console.error('Failed to fetch doctors', err);
    } finally {
      setDoctorsLoading(false);
    }
  };

  useEffect(() => {
    fetchPatientsList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, page, limit, adv.uhid, adv.firstName, adv.lastName, adv.mobile, adv.patientId, adv.from, adv.to]);

  useEffect(() => {
    fetchDoctorsList();
    if (searchParams.get('add') === 'true') {
      openCreate();
    }
  }, []);

  const openCreate = () => {
    setEditingPatient(null);
    setFormData(EMPTY_FORM);
    setErrors({});
    setFormOpen(true);
  };

  const openEdit = (patient) => {
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

  const handleFormSubmit = async (e) => {
    e?.preventDefault();
    const validationErrors = validatePatient(formData);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setFormSubmitLoading(true);
    try {
      const payload = { ...formData, referringDoctor: formData.referringDoctor || null };
      const res = editingPatient
        ? await updatePatient(editingPatient._id, payload)
        : await createPatient(payload);

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
          <Button variant="primary" onClick={openCreate} icon={<UserPlus size={16} />}>
            Add Patient
          </Button>
        }
      />

      <AdvancedFilterBar
        values={adv}
        onChange={setAdvKey}
        onSearch={() => { goToPage(1); fetchPatientsList(); }}
        onClear={() => { setAdv({ uhid: '', firstName: '', lastName: '', mobile: '', patientId: '', from: '', to: '' }); setSearch(''); goToPage(1); }}
        fields={[
          { key: 'uhid', label: 'UHID', type: 'text', placeholder: 'UHID' },
          { key: 'firstName', label: 'First name', type: 'text', placeholder: 'First name' },
          { key: 'lastName', label: 'Last name', type: 'text', placeholder: 'Last name' },
          { key: 'mobile', label: 'Mobile number', type: 'text', placeholder: 'Mobile' },
          { key: 'patientId', label: 'ID', type: 'text', placeholder: 'ID / Reg.no' },
          { key: 'from', label: 'From', type: 'date' },
          { key: 'to', label: 'To', type: 'date' },
        ]}
      />

      <DataTable
        headers={['Reg No', 'Name', 'Address', 'Mobile', 'Registered On', 'Referred By', 'Actions']}
        data={patients}
        loading={loading}
        emptyMessage="No patient profiles matched your query."
        searchValue={search}
        onSearchChange={(e) => { setSearch(e.target.value); goToPage(1); }}
        searchPlaceholder="Search by name, phone or reg no..."
        pagination={{
          total: paginationInfo.total,
          page,
          limit,
          pages: paginationInfo.pages,
          onPageChange: goToPage,
          onLimitChange: setLimit,
        }}
        renderRow={(patient) => (
          <tr key={patient._id}>
            <td style={{ fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-primary)' }}>
              {patient.registrationNumber}
            </td>
            <td style={{ fontWeight: 'var(--font-weight-semibold)' }}>{patient.name}</td>
            <td>{patient.address || '—'}</td>
            <td>{patient.phone}</td>
            <td>{patient.createdAt ? new Date(patient.createdAt).toLocaleDateString('en-IN') : '—'}</td>
            <td>{patient.referringDoctor?.name || 'Self'}</td>
            <td>
              <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                <Button variant="secondary" size="sm" onClick={() => navigate(`/cases/patients/${patient._id}`)} icon={<FolderOpen size={14} />}>
                  Details
                </Button>
                <Button variant="secondary" size="sm" onClick={() => openEdit(patient)} icon={<Edit2 size={14} />} />
                <Button variant="danger" size="sm" onClick={() => setDeleteTarget(patient)} icon={<Trash2 size={14} />} />
              </div>
            </td>
          </tr>
        )}
      />

      <PatientFormModal
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={handleFormSubmit}
        formData={formData}
        setFormData={setFormData}
        errors={errors}
        loading={formSubmitLoading}
        isEditing={!!editingPatient}
        doctors={doctors}
        doctorsLoading={doctorsLoading}
      />

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        loading={deleteLoading}
        title="Delete Patient Profile?"
        message={`Are you sure you want to permanently delete patient files for ${deleteTarget?.name}?`}
      />
    </div>
  );
};

export default PatientsPage;
