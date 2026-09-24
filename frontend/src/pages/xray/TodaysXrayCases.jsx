import React, { useState, useEffect } from 'react';
import { getXrayCases, createXrayCase, updateXrayCase } from '../../services/xrayService';
import { deleteXrayCase } from '../../services/modalityService';
import { getPatients } from '../../services/patientService';
import { getDoctors } from '../../services/doctorService';
import formatDate from '../../utils/formatDate';
import useAuth from '../../hooks/useAuth';
import { Plus, Edit2, Download, Trash2, AlertTriangle, RefreshCw } from 'lucide-react';
import downloadFile from '../../utils/downloadFile';
import { DataTable, PageHeader, Button, Modal, Select, FileUploader, StatusBadge, ConfirmDialog } from '../../components/common';
import '../../styles/Xray.css';

/* Surfaces only the backend's user-facing `message` field (never stack traces),
   with sensible fallbacks per failure type (same mapping as the other lab
   screens). */
const getApiErrorMessage = (err, fallback) => {
  if (err?.response) {
    const data = err.response.data;
    if (data && typeof data.message === 'string' && data.message.trim()) {
      return data.message;
    }
    const status = err.response.status;
    if (status === 401) return 'Your session has expired. Please log in again.';
    if (status === 403) return 'You do not have permission to perform this action.';
    if (status === 404) return 'The requested record was not found.';
    if (status === 409) return 'The record was changed elsewhere. Please refresh and try again.';
    if (status === 422) return 'The submitted data is invalid.';
    if (status >= 500) return 'Server error. Please try again.';
    return fallback;
  }
  if (err?.code === 'ECONNABORTED') return 'The request timed out. Please try again.';
  if (err?.request) return 'Network error. Please check your connection and try again.';
  return err?.message || fallback;
};

// The scan's extension comes from the API-provided fileUrl, so downloads
// keep the uploaded file's real type (jpg/png/pdf) instead of a fixed name.
const scanFileExt = (fileUrl) => (fileUrl?.includes('.') ? `.${fileUrl.split('.').pop()}` : '');

const TodaysXrayCases = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'Admin';
  const [cases, setCases] = useState([]);
  const [patients, setPatients] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(false);
  // List/options load failures — surfaced as a banner (an empty table after a
  // failed fetch must never read as "no cases today"); each fetch owns its
  // error so one success never clears the other's failure.
  const [listError, setListError] = useState(null);
  const [optionsError, setOptionsError] = useState(null);

  // Form States
  const [formOpen, setFormOpen] = useState(false);
  const [editingCase, setEditingCase] = useState(null);
  const [formData, setFormData] = useState({ patient: '', referringDoctor: '', findings: '', file: null, status: 'Completed' });
  const [errors, setErrors] = useState({});
  const [submitLoading, setSubmitLoading] = useState(false);

  // Admin delete
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      const res = await deleteXrayCase(deleteTarget._id);
      if (res.success) {
        setDeleteTarget(null);
        fetchCases();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete X-Ray case');
    } finally {
      setDeleteLoading(false);
    }
  };

  const fetchCases = async () => {
    setLoading(true);
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const res = await getXrayCases({ date: todayStr });
      if (res.success) {
        setCases(res.data);
        setListError(null);
      }
    } catch (err) {
      setCases([]);
      setListError(getApiErrorMessage(err, "Failed to load today's X-Ray cases."));
    } finally {
      setLoading(false);
    }
  };

  const loadOptions = async () => {
    try {
      const [patRes, docRes] = await Promise.all([
        getPatients({ limit: 100 }),
        getDoctors({ status: 'Active' })
      ]);
      if (patRes.success) setPatients(patRes.data.patients);
      if (docRes.success) setDoctors(docRes.data);
      setOptionsError(null);
    } catch (err) {
      setOptionsError(getApiErrorMessage(err, 'Failed to load patients or doctors.'));
    }
  };

  // Retry for the banners above — re-runs both page loads; their success
  // paths clear the matching error state.
  const refresh = () => {
    fetchCases();
    loadOptions();
  };

  useEffect(() => {
    fetchCases();
    loadOptions();
  }, []);

  const handleOpenCreate = () => {
    setEditingCase(null);
    setFormData({ patient: '', referringDoctor: '', findings: '', file: null, status: 'Completed' });
    setErrors({});
    setFormOpen(true);
  };

  const handleOpenEdit = (c) => {
    setEditingCase(c);
    setFormData({
      patient: c.patient?._id || '',
      referringDoctor: c.referringDoctor?._id || '',
      findings: c.findings,
      file: null,
      status: c.status
    });
    setErrors({});
    setFormOpen(true);
  };

  const validate = () => {
    const errs = {};
    if (!formData.patient) errs.patient = 'Please select a patient';
    if (!formData.findings.trim()) errs.findings = 'Findings report text is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitLoading(true);
    try {
      let res;
      const payload = new FormData();
      payload.append('patient', formData.patient);
      if (formData.referringDoctor) payload.append('referringDoctor', formData.referringDoctor);
      payload.append('findings', formData.findings);
      payload.append('status', formData.status);
      if (formData.file) {
        payload.append('file', formData.file);
      }

      if (editingCase) {
        res = await updateXrayCase(editingCase._id, payload);
      } else {
        res = await createXrayCase(payload);
      }

      if (res.success) {
        setFormOpen(false);
        fetchCases();
      }
    } catch (err) {
      setErrors({ api: err.response?.data?.message || 'Failed to save X-Ray case details' });
    } finally {
      setSubmitLoading(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Today's Digital X-Ray Cases"
        subtitle="Record findings, attach scan images, and download X-Ray reports"
        action={
          <Button variant="primary" onClick={handleOpenCreate}>
            <Plus size={16} /> Create X-Ray Case
          </Button>
        }
      />

      {(listError || optionsError) && (
        <div className="xray-banner xray-banner-error" role="alert">
          <AlertTriangle size={16} />
          <span>{listError || optionsError}</span>
          <Button
            variant="secondary"
            size="sm"
            icon={<RefreshCw size={14} />}
            onClick={refresh}
          >
            Retry
          </Button>
        </div>
      )}

      <DataTable
        headers={['Registered Date', 'Patient Reg No', 'Patient Name', 'Referring Doctor', 'Findings', 'Status', 'Download Scan', 'Actions']}
        data={cases}
        loading={loading}
        emptyMessage="No X-Ray cases recorded today."
        renderRow={(c) => (
          <tr key={c._id}>
            <td>{formatDate(c.date).split(',')[0]}</td>
            <td style={{ fontWeight: '600' }}>{c.patient?.registrationNumber}</td>
            <td style={{ fontWeight: '600' }}>{c.patient?.name}</td>
            <td>{c.referringDoctor?.name || 'Self'}</td>
            <td style={{ maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={c.findings || ''}>{c.findings || '—'}</td>
            <td>
              <StatusBadge status={c.status} />
            </td>
            <td>
              {c.fileUrl ? (
                <button
                  className="btn btn-secondary"
                  style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                  onClick={() => downloadFile(`/${c.fileUrl}`, `scan_${c.patient?.registrationNumber}${scanFileExt(c.fileUrl)}`)}
                >
                  <Download size={14} /> Download Scan
                </button>
              ) : (
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>No attachment</span>
              )}
            </td>
            <td>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  className="btn btn-secondary"
                  style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                  onClick={() => handleOpenEdit(c)}
                >
                  <Edit2 size={14} /> Findings
                </button>
                {isAdmin && (
                  <button
                    className="btn btn-danger"
                    style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                    onClick={() => setDeleteTarget(c)}
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </td>
          </tr>
        )}
      />

      {/* Case Form Modal */}
      <Modal
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        title={editingCase ? 'Edit X-Ray Case Findings' : 'Create X-Ray Case Entry'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setFormOpen(false)} disabled={submitLoading}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleFormSubmit} loading={submitLoading}>
              Save Case
            </Button>
          </>
        }
      >
        <form onSubmit={handleFormSubmit} className="form-grid" style={{ gridTemplateColumns: '1fr', maxHeight: '70vh', overflowY: 'auto', paddingRight: '8px' }}>
          {errors.api && <div className="form-error">{errors.api}</div>}
          
          <div className="xray-form-section-title">Case details</div>

          <Select
            label="Patient"
            value={formData.patient}
            onChange={(e) => setFormData(prev => ({ ...prev, patient: e.target.value }))}
            options={patients.map(p => ({ value: p._id, label: `${p.name} (${p.registrationNumber})` }))}
            error={errors.patient}
            required
            disabled={!!editingCase}
          />

          <Select
            label="Referring Doctor"
            value={formData.referringDoctor}
            onChange={(e) => setFormData(prev => ({ ...prev, referringDoctor: e.target.value }))}
            options={doctors.map(d => ({ value: d._id, label: d.name }))}
            placeholder="Self Referral"
          />

          <Select
            label="Case Status"
            value={formData.status}
            onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
            options={[
              { value: 'Pending', label: 'Pending Signature' },
              { value: 'Completed', label: 'Completed Report' }
            ]}
            required
          />

          <div className="xray-form-section-title">Report findings</div>

          <div className="form-group">
            <label className="form-label" htmlFor="xray-findings">
              <span>Clinical X-Ray Findings</span>
              <span className="form-required-star" aria-hidden="true">*</span>
            </label>
            <textarea
              id="xray-findings"
              value={formData.findings}
              onChange={(e) => setFormData(prev => ({ ...prev, findings: e.target.value }))}
              className="form-control"
              rows={8}
              placeholder="Record findings details..."
              required
            />
            {errors.findings && <p className="form-error">{errors.findings}</p>}
          </div>

          <div className="xray-form-section-title">Scan attachment</div>

          <div style={{ marginTop: '0.5rem' }}>
            <FileUploader
              onChange={(file) => setFormData(prev => ({ ...prev, file }))}
              value={formData.file}
              label="Select X-Ray Scan image file"
              accept=".jpg,.jpeg,.png,.pdf"
            />
          </div>

        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        loading={deleteLoading}
        title="Delete X-Ray case?"
        message={`Permanently delete X-Ray case for ${deleteTarget?.patient?.name || 'this patient'}?`}
      />
    </div>
  );
};

export default TodaysXrayCases;
