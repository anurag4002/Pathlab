import React, { useState, useEffect } from 'react';
import { getXrayCases, createXrayCase, updateXrayCase, uploadXrayImage } from '../../services/xrayService';
import { deleteXrayCase } from '../../services/modalityService';
import { getPatients } from '../../services/patientService';
import { getDoctors } from '../../services/doctorService';
import { getLabProfile, getSignatures } from '../../services/setupService';
import formatDate from '../../utils/formatDate';
import useAuth from '../../hooks/useAuth';
import { Plus, Edit2, Download, Trash2, Printer } from 'lucide-react';
import downloadFile from '../../utils/downloadFile';
import { DataTable, PageHeader, Button, Modal, Select, Input, FileUploader, ImageUploader, StatusBadge, ConfirmDialog } from '../../components/common';
import InlineSignButton from '../../components/usg/InlineSignButton';
import XrayImagePane from '../../components/xray/XrayImagePane';

const TodaysXrayCases = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'Admin';
  const [cases, setCases] = useState([]);
  const [patients, setPatients] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(false);

  // Phase 24-backed branding (fallbacks = previous hardcoded strings)
  const [labProfile, setLabProfile] = useState(null);
  const [signatures, setSignatures] = useState([]);

  // Form States
  const [formOpen, setFormOpen] = useState(false);
  const [editingCase, setEditingCase] = useState(null);
  const [formData, setFormData] = useState({ patient: '', referringDoctor: '', findings: '', file: null, status: 'Completed' });
  const [errors, setErrors] = useState({});
  const [submitLoading, setSubmitLoading] = useState(false);
  // Phase 14 — gallery images for the case being edited. Uploads run in
  // the background and never block saving (non-blocking save).
  const [galleryUrls, setGalleryUrls] = useState([]);
  const [uploaderKey, setUploaderKey] = useState(0);

  // Print preview (aligned with the USG preview layout)
  const [printTarget, setPrintTarget] = useState(null);
  const [printOpen, setPrintOpen] = useState(false);

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
      }
    } catch (err) {
      console.error('Failed to load today Xray cases', err);
    } finally {
      setLoading(false);
    }
  };

  const loadOptions = async () => {
    try {
      const [patRes, docRes, profRes, sigRes] = await Promise.all([
        getPatients({ limit: 100 }),
        getDoctors({ status: 'Active' }),
        getLabProfile().catch(() => null),
        getSignatures().catch(() => null)
      ]);
      if (patRes.success) setPatients(patRes.data.patients);
      if (docRes.success) setDoctors(docRes.data);
      if (profRes?.success) setLabProfile(profRes.data?.profile || profRes.data);
      if (sigRes?.success) setSignatures(Array.isArray(sigRes.data) ? sigRes.data : sigRes.data?.signatures || []);
    } catch (err) {
      console.error('Failed to load options', err);
    }
  };

  useEffect(() => {
    fetchCases();
    loadOptions();
  }, []);

  const handleOpenCreate = () => {
    setEditingCase(null);
    setFormData({ patient: '', referringDoctor: '', findings: '', file: null, status: 'Completed' });
    setGalleryUrls([]);
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
    setGalleryUrls(c.images || c.imageUrls || []);
    setUploaderKey((k) => k + 1);
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

  const handlePrint = (c) => {
    setPrintTarget(c);
    setPrintOpen(true);
  };

  const handleSigned = (updated) => {
    if (!updated) return fetchCases();
    setCases((prev) => prev.map((c) => (c._id === updated._id ? { ...c, ...updated } : c)));
  };

  const labName = labProfile?.labName || 'PURE PATH LAB';
  const labTagline = labProfile?.tagline || 'Pathology & Diagnostic Center';
  const labContact = [labProfile?.address, labProfile?.phone, labProfile?.email].filter(Boolean).join(' · ');
  const logoSrc = labProfile?.logoUrl ? `/${String(labProfile.logoUrl).replace(/^\//, '')}` : '/logo.jpg';
  const xraySignature = signatures.find((s) => (s.modalities || s.assignedDepartments || []).includes('XRAY')) || signatures[0];
  const signatoryName = xraySignature?.name || printTarget?.signedBy?.name || 'Authorised Signatory';
  const signatoryTitle = xraySignature?.title || 'Consultant Radiologist';

  return (
    <div>
      <PageHeader
        title="Today's Digital X-Ray Cases"
        subtitle="Manage Digital X-Ray records, findings reports, and scan attachments uploading"
        action={
          <Button variant="primary" onClick={handleOpenCreate}>
            <Plus size={16} /> Create X-Ray Case
          </Button>
        }
      />

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
                  onClick={() => downloadFile(`/${c.fileUrl}`, `scan_${c.patient?.registrationNumber}.jpg`)}
                >
                  <Download size={14} /> Download Scan
                </button>
              ) : (
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>No attachment</span>
              )}
            </td>
            <td>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  className="btn btn-secondary"
                  style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                  onClick={() => handleOpenEdit(c)}
                >
                  <Edit2 size={14} /> Findings
                </button>
                <button
                  className="btn btn-secondary"
                  style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                  onClick={() => handlePrint(c)}
                >
                  <Printer size={14} /> Print
                </button>
                <InlineSignButton
                  caseId={c._id}
                  modality="xray"
                  signed={c.status === 'Completed'}
                  onSigned={handleSigned}
                />
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

          <Select
            label="Patient Profile"
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

          <div className="form-group">
            <label className="form-label">Clinical X-Ray Findings Details *</label>
            <textarea
              value={formData.findings}
              onChange={(e) => setFormData(prev => ({ ...prev, findings: e.target.value }))}
              className="form-control"
              rows={8}
              placeholder="Record findings details..."
              required
            />
            {errors.findings && <p className="form-error">{errors.findings}</p>}
          </div>

          <div style={{ marginTop: '0.5rem' }}>
            <FileUploader
              onChange={(file) => setFormData(prev => ({ ...prev, file }))}
              value={formData.file}
              label="Select X-Ray Scan image file"
              accept=".jpg,.jpeg,.png,.pdf"
            />
          </div>

          {editingCase && (
            <div className="form-group" style={{ marginTop: '0.5rem' }}>
              <label className="form-label">Additional scan images (uploads in background — saving is never blocked)</label>
              <ImageUploader
                key={uploaderKey}
                uploadFn={(file, prog) => uploadXrayImage(editingCase._id, file, prog)}
                initialUrls={editingCase.images || editingCase.imageUrls || []}
                onUploaded={setGalleryUrls}
                compress
              />
            </div>
          )}

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

        </form>
      </Modal>

      {/* Print X-Ray Findings Modal (aligned with USG preview) */}
      <Modal
        isOpen={printOpen}
        onClose={() => setPrintOpen(false)}
        title="X-Ray Report Print Preview"
        footer={
          <>
            <Button variant="secondary" onClick={() => setPrintOpen(false)}>Close</Button>
            <Button variant="primary" onClick={() => window.print()}><Printer size={16} /> Print Report</Button>
          </>
        }
      >
        {printTarget && (
          <div className="printable-area" style={{ padding: '16px', color: '#000', fontSize: '0.9rem', lineHeight: '1.5' }}>
            <div style={{ textAlign: 'center', marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <img
                src={logoSrc}
                alt="Logo"
                style={{ width: '64px', height: '64px', borderRadius: '50%', marginBottom: '4px', objectFit: 'cover' }}
              />
              <h2 style={{ margin: 0, fontWeight: '700' }}>{labName}</h2>
              <p style={{ margin: '2px 0' }}>{labTagline}</p>
              {labContact && <p style={{ margin: '2px 0', fontSize: '0.75rem' }}>{labContact}</p>}
              <p style={{ margin: '2px 0', fontWeight: '600' }}>DIGITAL X-RAY REPORT</p>
              <div style={{ borderBottom: '2px solid #000', margin: '10px 0', width: '100%' }}></div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', marginBottom: '1.5rem' }}>
              <div>
                <strong>Patient Name:</strong> {printTarget.patient?.name}<br />
                <strong>Age / Gender:</strong> {printTarget.patient?.age} Yrs / {printTarget.patient?.gender}
              </div>
              <div style={{ textAlign: 'right' }}>
                <strong>Reg Code:</strong> {printTarget.patient?.registrationNumber}<br />
                <strong>Date:</strong> {formatDate(printTarget.date).split(',')[0]}
              </div>
            </div>

            <div style={{ borderBottom: '1px solid #000', marginBottom: '1rem' }}></div>

            <div style={{ minHeight: '200px', whiteSpace: 'pre-wrap', fontFamily: 'sans-serif' }}>
              <strong>FINDINGS:</strong><br /><br />
              {printTarget.findings}
            </div>

            <XrayImagePane images={printTarget._id === editingCase?._id ? galleryUrls : (printTarget.images || printTarget.imageUrls || [])} fileUrl={printTarget.fileUrl} />

            <div style={{ borderTop: '1px solid #000', marginTop: '2rem', paddingTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
              <div style={{ textAlign: 'center', width: '200px' }}>
                {(xraySignature?.imageUrl || printTarget.signatureUrl) && (
                  <img
                    src={xraySignature?.imageUrl ? `/${String(xraySignature.imageUrl).replace(/^\//, '')}` : `/${printTarget.signatureUrl}`}
                    alt="Signature"
                    style={{ height: '40px', objectFit: 'contain' }}
                  />
                )}
                <div style={{ height: (xraySignature?.imageUrl || printTarget.signatureUrl) ? '4px' : '40px' }}></div>
                <strong>{signatoryName}</strong><br />
                <span>{signatoryTitle}</span>
              </div>
            </div>
          </div>
        )}
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
