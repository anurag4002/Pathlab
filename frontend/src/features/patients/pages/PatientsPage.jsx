import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getPatients, getPatientById, createPatient, updatePatient, deletePatient } from '../../../services/patientService';
import { getDoctors } from '../../../services/doctorService';
import { DataTable, PageHeader, Button, ConfirmDialog, AdvancedFilterBar, BranchFilter, IdentityCell, RowMenu } from '../../../components/common';
import { useUiVersion } from '../../../utils/uiVersion';
import { PATIENT_TABLE_HEADERS } from '../../../constants/patientConstants';
import PatientFormModal, { EMPTY_FORM } from '../components/PatientFormModal';
import useStickyState from '../../../utils/useStickyState';
import useDebounce from '../../../hooks/useDebounce';
import { FolderOpen, Edit2, Trash2, UserPlus, FilePlus } from 'lucide-react';
import { notify } from '../../../components/common/Toast/toast';
import formatDate from '../../../utils/formatDate';
import '../../../pages/cases/v2/casesV2.css';

const validatePatient = (formData) => {
  const errs = {};
  if (!formData.name.trim()) errs.name = 'Patient name is required';
  if (formData.age === '' || formData.age == null || isNaN(formData.age) || Number(formData.age) < 0) {
    errs.age = 'Valid age is required';
  }
  if (!formData.gender) errs.gender = 'Gender is required';
  if (!formData.phone.trim()) errs.phone = 'Phone number is required';
  return errs;
};

const PatientsPage = () => {
  const isV2 = useUiVersion() === 'v2';
  // New bill for this patient: the bill form fills the patient in.
  const newBillFor = (patient) => navigate('/cases/bills/new', { state: { booking: { patientId: patient._id, name: patient.name, phone: patient.phone, age: patient.age, gender: patient.gender, title: patient.title, email: patient.email, address: patient.address } } });
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [patients, setPatients] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [doctorsLoading, setDoctorsLoading] = useState(false);

  const [formOpen, setFormOpenRaw] = useState(false);
  // New look: which panel was open ('new' or a patient id) comes back after a
  // reload, with what was typed in it.
  const [openPanel, setOpenPanel] = useStickyState('panel', null);
  const [editingPatient, setEditingPatient] = useState(null);
  const [formData, setFormData] = useStickyState('form', EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [formSubmitLoading, setFormSubmitLoading] = useState(false);

  const [search, setSearch] = useStickyState('search', '');
  const [branch, setBranch] = useStickyState('branch', '');
  const debouncedSearch = useDebounce(search, 500);
  const [page, goToPage] = useStickyState('page', 1);
  const [limit, setLimitRaw] = useStickyState('limit', 10);
  const setLimit = (n) => { setLimitRaw(Math.max(1, Number(n) || 10)); goToPage(1); };
  const [paginationInfo, setPaginationInfo] = useState({ total: 0, pages: 0 });
  const [adv, setAdv] = useStickyState('adv', { uhid: '', firstName: '', lastName: '', mobile: '', patientId: '', from: '', to: '' });
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
        branch: branch || undefined,
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
  }, [debouncedSearch, page, limit, branch, adv.uhid, adv.firstName, adv.lastName, adv.mobile, adv.patientId, adv.from, adv.to]);

  useEffect(() => {
    if (searchParams.get('add') === 'true') {
      openCreate();
    }
    // Deep-link from the enquiry queue ("Find patient" passes ?search=phone).
    const q = searchParams.get('search');
    if (q && q !== 'undefined' && q !== 'null') setSearch(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Doctors only needed for create/edit form — not on list mount.
  useEffect(() => {
    if (formOpen && doctors.length === 0) fetchDoctorsList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formOpen]);

  const setFormOpen = (open) => {
    setFormOpenRaw(open);
    if (open) return;
    setOpenPanel(null);
    // An edit is not a draft: closing it drops the values (a new patient keeps them).
    if (editingPatient) { setFormData(EMPTY_FORM); setEditingPatient(null); }
  };
  const openCreate = () => {
    const keepDraft = isV2 && !editingPatient;
    setEditingPatient(null);
    if (!keepDraft) setFormData(EMPTY_FORM);
    setErrors({});
    setFormOpenRaw(true);
    setOpenPanel('new');
  };

  const openEdit = (patient) => {
    setEditingPatient(patient);
    setFormData({
      name: patient.name,
      age: patient.age,
      ageUnit: patient.ageUnit || 'years',
      birthYear: patient.birthYear || '',
      gender: patient.gender,
      phone: patient.phone,
      address: patient.address || '',
      email: patient.email || '',
      aadhaar: patient.aadhaar || '',
      history: patient.history || '',
      uhid: patient.uhid || '',
      referringDoctor: patient.referringDoctor?._id || ''
    });
    setErrors({});
    setFormOpenRaw(true);
    setOpenPanel(patient._id);
  };

  // After a reload: reopen the panel that was open, keeping what was typed.
  useEffect(() => {
    if (!isV2 || formOpen || !openPanel) return;
    if (openPanel === 'new') { setEditingPatient(null); setFormOpenRaw(true); return; }
    let active = true;
    const found = patients.find((p) => String(p._id) === String(openPanel));
    const reopen = (patient) => { if (!active || !patient) return; setEditingPatient(patient); setFormOpenRaw(true); };
    if (found) reopen(found);
    else getPatientById(openPanel).then((res) => reopen(res?.data)).catch(() => setOpenPanel(null));
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isV2, openPanel]);

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
        setEditingPatient(null);
        if (isV2) setFormData(EMPTY_FORM);
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
      notify(err.response?.data?.message || 'Failed to delete patient profile');
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Patients File Registry"
        subtitle={isV2 ? 'Everyone registered at the lab. Open a name to see their bills and reports.' : 'Manage laboratory patient records and look up case history files'}
        action={
          <Button variant="primary" onClick={openCreate} icon={<UserPlus size={16} />}>
            {isV2 ? 'Add patient' : 'Add Patient'}
          </Button>
        }
      />

      <AdvancedFilterBar
        values={{ branch, ...adv }}
        onChange={(key, value) => {
          if (key === 'branch') {
            setBranch(value);
            goToPage(1);
            return;
          }
          setAdvKey(key, value);
        }}
        onSearch={() => { goToPage(1); fetchPatientsList(); }}
        onClear={() => { setAdv({ uhid: '', firstName: '', lastName: '', mobile: '', patientId: '', from: '', to: '' }); setSearch(''); setBranch(''); goToPage(1); }}
        fields={[
          { key: 'branch', type: 'custom', size: 'md', render: ({ value, onChange }) => (
            <BranchFilter value={value} onChange={onChange} />
          ) },
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
        headers={isV2 ? ['Patient', 'Referred by', 'Registered', ''] : PATIENT_TABLE_HEADERS}
        data={patients}
        loading={loading}
        emptyMessage={isV2 ? 'No patient matches your search.' : 'No patient profiles matched your query.'}
        searchValue={search}
        onSearchChange={(e) => { setSearch(e.target.value); goToPage(1); }}
        searchPlaceholder="Search by name, phone or reg no..."
        stickyActions
        pagination={{
          total: paginationInfo.total,
          page,
          limit,
          pages: paginationInfo.pages,
          onPageChange: goToPage,
          onLimitChange: setLimit,
        }}
        renderRow={(patient) => isV2 ? (
          <tr key={patient._id}>
            <td>
              <IdentityCell
                name={[patient.title, patient.name].filter(Boolean).join(' ')}
                onClick={() => navigate(`/cases/patients/${patient._id}`)}
                title="Open patient details"
                clinical={{ age: patient.age, ageUnit: patient.ageUnit, gender: patient.gender }}
                meta={[`Reg ${patient.registrationNumber}`]}
                copy={patient.phone ? { value: patient.phone, label: 'phone' } : undefined}
              />
            </td>
            <td>{patient.referringDoctor?.name || <span className="cell-empty">Self</span>}</td>
            <td style={{ whiteSpace: 'nowrap', color: '#71717a' }}>{patient.createdAt ? formatDate(patient.createdAt).split(',')[0] : ''}</td>
            <td>
              <div className="row-actions-v2">
                <Button variant="secondary" size="sm" icon={<FilePlus size={14} />} onClick={() => newBillFor(patient)} aria-label={`New bill for ${patient.name}`}>New bill</Button>
                <RowMenu label={`More actions for ${patient.name}`} items={[
                  { label: 'Details', onClick: () => navigate(`/cases/patients/${patient._id}`) },
                  { label: 'Edit patient', onClick: () => openEdit(patient), ariaLabel: `Edit ${patient.name}` },
                  { label: 'Delete patient', onClick: () => setDeleteTarget(patient), danger: true, ariaLabel: `Delete ${patient.name}` },
                ]} />
              </div>
            </td>
          </tr>
        ) : (
          <tr key={patient._id}>
            <td style={{ fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-primary)', whiteSpace: 'nowrap' }}>
              {patient.registrationNumber}
            </td>
            <td style={{ fontWeight: 'var(--font-weight-semibold)' }}>{patient.name}</td>
            <td>{patient.age != null && patient.age !== '' ? `${patient.age} ${patient.ageUnit || 'years'}` : '—'}</td>
            <td>{patient.gender || '—'}</td>
            <td style={{ whiteSpace: 'nowrap' }}>{patient.phone}</td>
            <td>{patient.referringDoctor?.name || 'Self'}</td>
            <td>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'nowrap' }}>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => navigate(`/cases/patients/${patient._id}`)}
                  icon={<FolderOpen size={16} />}
                  title="View details"
                >
                  Details
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => openEdit(patient)}
                  icon={<Edit2 size={16} strokeWidth={2.25} />}
                  title="Edit patient"
                  aria-label={`Edit ${patient.name}`}
                >
                  Edit
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="btn-quiet-danger"
                  onClick={() => setDeleteTarget(patient)}
                  icon={<Trash2 size={16} strokeWidth={2.25} />}
                  title="Delete patient"
                  aria-label={`Delete ${patient.name}`}
                >
                  Delete
                </Button>
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
        title={isV2 ? 'Delete this patient?' : 'Delete Patient Profile?'}
        message={isV2 ? `${deleteTarget?.name} and their record will be removed. This cannot be undone.` : `Are you sure you want to permanently delete patient files for ${deleteTarget?.name}?`}
      />
    </div>
  );
};

export default PatientsPage;
