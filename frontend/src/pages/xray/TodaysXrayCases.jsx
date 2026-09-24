import React, { useState, useEffect, useMemo } from 'react';
import { getXrayCases, createXrayCase, updateXrayCase, uploadXrayImage } from '../../services/xrayService';
import { deleteXrayCase } from '../../services/modalityService';
import { getPatients } from '../../services/patientService';
import { getDoctors } from '../../services/doctorService';
import { getLabProfile, getSignatures } from '../../services/setupService';
import formatDate from '../../utils/formatDate';
import useAuth from '../../hooks/useAuth';
import useDebounce from '../../hooks/useDebounce';
import usePagination from '../../hooks/usePagination';
import { Plus, Edit2, Download, Trash2, Printer, AlertTriangle, RefreshCw } from 'lucide-react';
import downloadFile from '../../utils/downloadFile';
import {
  DataTable,
  PageHeader,
  Button,
  Modal,
  Select,
  FileUploader,
  ImageUploader,
  StatusBadge,
  ConfirmDialog,
  PatientPicker
} from '../../components/common';
import InlineSignButton from '../../components/usg/InlineSignButton';
import XrayImagePane from '../../components/xray/XrayImagePane';
import '../../styles/Xray.css';

/* Surfaces only the backend's user-facing `message` field (never stack traces),
   with sensible fallbacks per failure type (same mapping as the other lab
   screens). */
const getApiErrorMessage = (err, fallback) => {
  if (err?.response) {
    const data = err.response.data;
    if (data && typeof data.message === 'string' && data.message.trim()) return data.message;
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

  // Phase 24-backed branding (fallbacks = previous hardcoded strings)
  const [labProfile, setLabProfile] = useState(null);
  const [signatures, setSignatures] = useState([]);

  // Unified Today + Search view: date scope + debounced search + filters +
  // pagination. Backend /api/xray supports only `search` (patient name),
  // `date`, `status` — reg-no, doctor, from/to and pagination are applied
  // client-side so the list works before server support lands.
  const [dateScope, setDateScope] = useState('today'); // 'today' | 'all'
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [doctorFilter, setDoctorFilter] = useState('');
  const debouncedSearch = useDebounce(search, 500);
  const { page, limit, goToPage, setLimit } = usePagination(1, 10);

  // Form States
  const [formOpen, setFormOpen] = useState(false);
  const [editingCase, setEditingCase] = useState(null);
  const [pickedPatient, setPickedPatient] = useState(null);
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
      const params = {
        status: statusFilter || undefined
      };
      // Today scope filters server-side; All-dates scope loads everything
      // and filters client-side (backend has no from/to support).
      if (dateScope === 'today' && !debouncedSearch.trim() && !fromDate && !toDate) {
        params.date = new Date().toISOString().split('T')[0];
      }
      const res = await getXrayCases(params);
      if (!res?.success) {
        setCases([]);
        setListError(res?.message || "Failed to load today's X-Ray cases.");
        return;
      }
      setCases(Array.isArray(res.data) ? res.data : []);
      setListError(null);
    } catch (err) {
      setCases([]);
      setListError(getApiErrorMessage(err, "Failed to load today's X-Ray cases."));
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
      if (!patRes?.success) throw new Error(patRes?.message || 'Failed to load patients.');
      if (!docRes?.success) throw new Error(docRes?.message || 'Failed to load doctors.');
      setPatients(
        Array.isArray(patRes.data?.patients)
          ? patRes.data.patients
          : Array.isArray(patRes.data)
            ? patRes.data
            : []
      );
      setDoctors(Array.isArray(docRes.data) ? docRes.data : []);
      if (profRes?.success) setLabProfile(profRes.data?.profile || profRes.data);
      if (sigRes?.success) {
        setSignatures(Array.isArray(sigRes.data) ? sigRes.data : sigRes.data?.signatures || []);
      }
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
    loadOptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    goToPage(1);
    fetchCases();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, statusFilter, dateScope, fromDate, toDate]);

  // Client-side filter pass (works regardless of server support).
  const filteredCases = useMemo(() => {
    const q = search.trim().toLowerCase();
    const todayStr = new Date().toISOString().split('T')[0];
    const from = fromDate ? new Date(fromDate).setHours(0, 0, 0, 0) : null;
    const to = toDate ? new Date(toDate).setHours(23, 59, 59, 999) : null;
    return cases.filter((c) => {
      if (statusFilter && c.status !== statusFilter) return false;
      if (doctorFilter && (c.referringDoctor?._id || c.referringDoctor) !== doctorFilter) return false;
      if (dateScope === 'today' && !q && from === null && to === null) {
        const d = c.date ? new Date(c.date).toISOString().split('T')[0] : '';
        if (d !== todayStr) return false;
      }
      if (from !== null || to !== null) {
        const t = c.date ? new Date(c.date).getTime() : NaN;
        if (Number.isNaN(t)) return false;
        if (from !== null && t < from) return false;
        if (to !== null && t > to) return false;
      }
      if (q) {
        const hay = `${c.patient?.name || ''} ${c.patient?.registrationNumber || ''} ${c.findings || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [cases, search, statusFilter, doctorFilter, dateScope, fromDate, toDate]);

  // Client-side pagination (backend returns the full list — no page/limit).
  const totalPages = Math.max(1, Math.ceil(filteredCases.length / limit));
  const safePage = Math.min(page, totalPages);
  const pagedCases = useMemo(() => {
    const start = (safePage - 1) * limit;
    return filteredCases.slice(start, start + limit);
  }, [filteredCases, safePage, limit]);

  const resetFilters = () => {
    setSearch('');
    setStatusFilter('');
    setDoctorFilter('');
    setFromDate('');
    setToDate('');
    setDateScope('today');
    goToPage(1);
  };

  const handleOpenCreate = () => {
    setEditingCase(null);
    setPickedPatient(null);
    setFormData({ patient: '', referringDoctor: '', findings: '', file: null, status: 'Completed' });
    setGalleryUrls([]);
    setErrors({});
    setFormOpen(true);
  };

  const handleOpenEdit = (c) => {
    setEditingCase(c);
    setPickedPatient(c.patient && typeof c.patient === 'object' ? c.patient : null);
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
        title="X-Ray Cases"
        subtitle="Today's and historical digital X-Ray cases — search, filter and paginate"
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
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }} role="tablist" aria-label="Date scope">
          {[
            { value: 'today', label: "Today's Cases" },
            { value: 'all', label: 'All / Search' },
          ].map((opt) => (
            <button
              key={opt.value}
              type="button"
              role="tab"
              aria-selected={dateScope === opt.value}
              onClick={() => { setDateScope(opt.value); goToPage(1); }}
              style={{
                padding: '6px 14px',
                fontSize: '0.8rem',
                fontWeight: dateScope === opt.value ? 700 : 500,
                border: 'none',
                cursor: 'pointer',
                backgroundColor: dateScope === opt.value ? 'var(--color-primary-light)' : 'var(--color-surface)',
                color: dateScope === opt.value ? 'var(--color-primary)' : 'var(--color-text)',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <label style={{ fontSize: '0.78rem', display: 'flex', flexDirection: 'column', gap: 4 }}>
          Referring doctor
          <select value={doctorFilter} onChange={(e) => { setDoctorFilter(e.target.value); goToPage(1); }} className="select-control" style={{ minWidth: 170 }}>
            <option value="">Everyone</option>
            {doctors.map((d) => (
              <option key={d._id} value={d._id}>{d.name}</option>
            ))}
          </select>
        </label>
        <label style={{ fontSize: '0.78rem', display: 'flex', flexDirection: 'column', gap: 4 }}>
          Status
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); goToPage(1); }} className="select-control" style={{ minWidth: 140 }}>
            <option value="">All statuses</option>
            <option value="Pending">Pending Signature</option>
            <option value="Completed">Completed Report</option>
          </select>
        </label>
        <label style={{ fontSize: '0.78rem', display: 'flex', flexDirection: 'column', gap: 4 }}>
          From
          <input type="date" value={fromDate} onChange={(e) => { setFromDate(e.target.value); goToPage(1); }} className="select-control" />
        </label>
        <label style={{ fontSize: '0.78rem', display: 'flex', flexDirection: 'column', gap: 4 }}>
          To
          <input type="date" value={toDate} onChange={(e) => { setToDate(e.target.value); goToPage(1); }} className="select-control" />
        </label>
        {(doctorFilter || statusFilter || search || fromDate || toDate || dateScope !== 'today') && (
          <button type="button" className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.78rem' }} onClick={resetFilters}>
            Clear filters
          </button>
        )}
        <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginLeft: 'auto' }}>
          {filteredCases.length} case{filteredCases.length === 1 ? '' : 's'}
        </span>
      </div>

      <DataTable
        headers={['Registered Date', 'Patient Reg No', 'Patient Name', 'Referring Doctor', 'Findings', 'Status', 'Download Scan', 'Actions']}
        data={pagedCases}
        loading={loading}
        emptyMessage={dateScope === 'today' && !search && !fromDate && !toDate ? 'No X-Ray cases recorded today.' : 'No X-Ray cases matched your search query.'}
        searchValue={search}
        onSearchChange={(e) => { setSearch(e.target.value); goToPage(1); }}
        searchPlaceholder="Search name, reg no, findings..."
        maxHeight={440}
        stickyActions
        pagination={{
          total: filteredCases.length,
          page: safePage,
          limit,
          pages: totalPages,
          onPageChange: goToPage,
          onLimitChange: setLimit,
        }}
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
        <form onSubmit={handleFormSubmit} className="modal-form">
          {errors.api && <div className="form-error">{errors.api}</div>}
          <div className="xray-form-section-title">Case details</div>

          <PatientPicker
            label="Patient Profile"
            value={pickedPatient || patients.find((p) => p._id === formData.patient) || null}
            onSelect={(p) => {
              setPickedPatient(p);
              setFormData((prev) => ({ ...prev, patient: p ? p._id : '' }));
            }}
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

          {editingCase && (
            <div className="form-group" style={{ marginTop: '0.5rem' }}>
              <label className="form-label">Additional scan images (uploads in background — saving is never blocked)</label>
              <ImageUploader
                key={uploaderKey}
                uploadFn={(file, progress) => uploadXrayImage(editingCase._id, file, progress)}
                initialUrls={editingCase.images || editingCase.imageUrls || []}
                onUploaded={setGalleryUrls}
                compress
              />
            </div>
          )}

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
