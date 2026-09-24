import React, { useState, useEffect, useMemo } from 'react';
import { getUSGCases, createUSGCase, updateUSGCase, getUSGTemplates, uploadUSGImage } from '../../services/usgService';
import { deleteUSGCase } from '../../services/modalityService';
import { getPatients } from '../../services/patientService';
import { getDoctors } from '../../services/doctorService';
import { getLabProfile, getSignatures } from '../../services/setupService';
import formatDate from '../../utils/formatDate';
import assetSrc from '../../utils/assetSrc';
import useAuth from '../../hooks/useAuth';
import useDebounce from '../../hooks/useDebounce';
import usePagination from '../../hooks/usePagination';
import { Plus, Edit2, Printer, Trash2, AlertTriangle, RefreshCw } from 'lucide-react';
import {
  DataTable,
  PageHeader,
  Button,
  Modal,
  Select,
  StatusBadge,
  ConfirmDialog,
  ImageUploader,
  PatientPicker,
  Letterhead
} from '../../components/common';
import CaseFilterBar from '../../components/usg/CaseFilterBar';
import InlineSignButton from '../../components/usg/InlineSignButton';
import '../../styles/USG.css';

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

const caseImages = (c) => (
  Array.isArray(c?.images)
    ? c.images
    : Array.isArray(c?.imageUrls)
      ? c.imageUrls
      : []
);

const TodaysUSGCases = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'Admin';
  const [cases, setCases] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [patients, setPatients] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(false);
  // List/options load failures — surfaced as a banner (an empty table after a
  // failed fetch must never read as "no cases today"); each fetch owns its
  // error so one success never clears the other's failure.
  const [listError, setListError] = useState(null);
  const [optionsError, setOptionsError] = useState(null);

  // Phase 13 — filter bar (dept / assigned / status / search). Params are
  // sent server-side AND applied client-side until backend filtering lands.
  // Unified Today + Search view: date scope + debounced search + pagination.
  // Backend /api/usg supports only `search` (patient name), `date`, `status`
  // — reg-no, doctor, from/to and pagination are applied client-side.
  const [deptFilter, setDeptFilter] = useState('');
  const [assignedFilter, setAssignedFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [searchFilter, setSearchFilter] = useState('');
  const [dateScope, setDateScope] = useState('today'); // 'today' | 'all'
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const debouncedSearch = useDebounce(searchFilter, 500);
  const { page, limit, goToPage, setLimit } = usePagination(1, 10);

  // Form States
  const [formOpen, setFormOpen] = useState(false);
  const [editingCase, setEditingCase] = useState(null);
  const [pickedPatient, setPickedPatient] = useState(null);
  const [formData, setFormData] = useState({ patient: '', referringDoctor: '', templateName: '', findings: '', status: 'Completed' });
  const [errors, setErrors] = useState({});
  const [submitLoading, setSubmitLoading] = useState(false);
  // Phase 5 — uploaded image URLs for the case being edited (non-blocking:
  // uploads run in the background; saving never waits for them).
  const [caseImageUrls, setCaseImageUrls] = useState([]);
  const [uploaderKey, setUploaderKey] = useState(0);

  // Print Case State
  const [printTarget, setPrintTarget] = useState(null);
  const [printOpen, setPrintOpen] = useState(false);
  // Print-only metadata: lab letterhead profile (GET /setup/lab-profile) and
  // signature masters (GET /setup/signatures) used to name the printed
  // signatory. Loaded lazily on the first print open; both are optional —
  // a failure degrades the printout, it never fabricates lab/doctor values.
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState(null);
  const [sigMasters, setSigMasters] = useState([]);
  const [printMetaLoaded, setPrintMetaLoaded] = useState(false);
  const [brokenSignature, setBrokenSignature] = useState('');

  // Admin delete
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      const res = await deleteUSGCase(deleteTarget._id);
      if (res.success) {
        setDeleteTarget(null);
        fetchCases();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete USG case');
    } finally {
      setDeleteLoading(false);
    }
  };

  const fetchCases = async () => {
    setLoading(true);
    try {
      const params = {
        status: statusFilter || undefined,
        department: deptFilter || undefined,
        assignedTo: assignedFilter || undefined
      };
      // Today scope filters server-side; All-dates scope loads everything
      // and filters client-side (backend has no from/to support).
      if (dateScope === 'today' && !debouncedSearch.trim() && !fromDate && !toDate) {
        params.date = new Date().toISOString().split('T')[0];
      }
      const res = await getUSGCases(params);
      if (!res?.success) {
        setCases([]);
        setListError(res?.message || "Failed to load today's USG cases.");
        return;
      }
      setCases(Array.isArray(res.data) ? res.data : []);
      setListError(null);
    } catch (err) {
      setCases([]);
      setListError(getApiErrorMessage(err, "Failed to load today's USG cases."));
    } finally {
      setLoading(false);
    }
  };

  const loadOptions = async () => {
    try {
      const [patRes, docRes, tempRes] = await Promise.all([
        getPatients({ limit: 100 }),
        getDoctors({ status: 'Active' }),
        getUSGTemplates()
      ]);
      if (!patRes?.success) throw new Error(patRes?.message || 'Failed to load patients.');
      if (!docRes?.success) throw new Error(docRes?.message || 'Failed to load doctors.');
      if (!tempRes?.success) throw new Error(tempRes?.message || 'Failed to load templates.');

      setPatients(
        Array.isArray(patRes.data?.patients)
          ? patRes.data.patients
          : Array.isArray(patRes.data)
            ? patRes.data
            : []
      );
      setDoctors(Array.isArray(docRes.data) ? docRes.data : []);
      setTemplates(Array.isArray(tempRes.data) ? tempRes.data : []);
      setOptionsError(null);
    } catch (err) {
      setOptionsError(getApiErrorMessage(err, 'Failed to load patients, doctors or templates.'));
    }
  };

  // Retry for the banners above — re-runs both page loads; their success
  // paths clear the matching error state.
  const refresh = () => {
    fetchCases();
    loadOptions();
  };

  // Print-only metadata (see state block). allSettled so the profile and the
  // signature masters fail independently — same split as Report Preview, so
  // header metadata can never block or corrupt the case list/form data.
  const loadPrintMeta = async () => {
    setProfileLoading(true);
    setProfileError(null);
    const [profileRes, sigRes] = await Promise.allSettled([
      getLabProfile(),
      getSignatures()
    ]);

    if (profileRes.status === 'fulfilled') {
      setProfile(profileRes.value?.data?.profile || profileRes.value?.data || null);
    } else {
      setProfile(null);
      setProfileError(
        getApiErrorMessage(profileRes.reason, 'Failed to load the lab letterhead.')
      );
    }

    if (sigRes.status === 'fulfilled') {
      const payload = sigRes.value?.data;
      if (Array.isArray(payload?.signatures)) {
        setSigMasters(payload.signatures);
      } else {
        setSigMasters(Array.isArray(payload) ? payload : []);
      }
    } else {
      // Signature masters only enrich the signatory block — the print keeps
      // its generic fallback labels when they cannot be loaded.
      setSigMasters([]);
    }

    setPrintMetaLoaded(true);
    setProfileLoading(false);
  };

  useEffect(() => {
    loadOptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    goToPage(1);
    fetchCases();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, deptFilter, assignedFilter, debouncedSearch, dateScope, fromDate, toDate]);

  // Client-side filter pass (works regardless of server support).
  const filteredCases = useMemo(() => {
    const q = searchFilter.trim().toLowerCase();
    const todayStr = new Date().toISOString().split('T')[0];
    const from = fromDate ? new Date(fromDate).setHours(0, 0, 0, 0) : null;
    const to = toDate ? new Date(toDate).setHours(23, 59, 59, 999) : null;
    return cases.filter((c) => {
      if (assignedFilter && (c.referringDoctor?._id || c.referringDoctor) !== assignedFilter) return false;
      if (statusFilter && c.status !== statusFilter) return false;
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
  }, [cases, assignedFilter, statusFilter, searchFilter, dateScope, fromDate, toDate]);

  // Client-side pagination (backend returns the full list — no page/limit).
  const totalPages = Math.max(1, Math.ceil(filteredCases.length / limit));
  const safePage = Math.min(page, totalPages);
  const pagedCases = useMemo(() => {
    const start = (safePage - 1) * limit;
    return filteredCases.slice(start, start + limit);
  }, [filteredCases, safePage, limit]);

  const resetFilters = () => {
    setDeptFilter('');
    setAssignedFilter('');
    setStatusFilter('');
    setSearchFilter('');
    setFromDate('');
    setToDate('');
    setDateScope('today');
    goToPage(1);
  };

  const handleOpenCreate = () => {
    setEditingCase(null);
    setPickedPatient(null);
    setFormData({ patient: '', referringDoctor: '', templateName: '', findings: '', status: 'Completed' });
    setCaseImageUrls([]);
    setErrors({});
    setFormOpen(true);
  };

  const handleOpenEdit = (c) => {
    setEditingCase(c);
    setPickedPatient(c.patient && typeof c.patient === 'object' ? c.patient : null);
    setFormData({
      patient: c.patient?._id || '',
      referringDoctor: c.referringDoctor?._id || '',
      templateName: c.templateName || '',
      findings: c.findings,
      status: c.status
    });
    setCaseImageUrls(caseImages(c));
    setUploaderKey((k) => k + 1);
    setErrors({});
    setFormOpen(true);
  };

  // Currently selected API template (GET /usg/templates) — drives the preview
  // and the explicit apply below; this component never invents template text.
  const selectedTemplate = templates.find(t => t.name === formData.templateName) || null;

  const handleTemplateChange = (e) => {
    const tempName = e.target.value;
    const picked = templates.find(t => t.name === tempName);
    setFormData(prev => ({
      ...prev,
      templateName: tempName,
      // Auto-load only into an empty editor — findings already on screen are
      // never replaced silently (the preview below offers an explicit apply),
      // and clearing the template no longer wipes the report text.
      findings: picked && !prev.findings.trim() ? picked.findings : prev.findings
    }));
  };

  const applyTemplate = () => {
    if (!selectedTemplate) return;
    setFormData(prev => ({ ...prev, findings: selectedTemplate.findings }));
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
      const payload = {
        ...formData,
        referringDoctor: formData.referringDoctor || null
      };

      if (editingCase) {
        res = await updateUSGCase(editingCase._id, payload);
      } else {
        res = await createUSGCase(payload);
      }

      if (res.success) {
        setFormOpen(false);
        fetchCases();
      }
    } catch (err) {
      setErrors({ api: err.response?.data?.message || 'Failed to save USG findings' });
    } finally {
      setSubmitLoading(false);
    }
  };

  const handlePrint = (c) => {
    setPrintTarget(c);
    setBrokenSignature('');
    setPrintOpen(true);
    // Letterhead profile + signature masters load lazily on the first print
    // open (print-only metadata — never blocks the list or the form).
    if (!printMetaLoaded) loadPrintMeta();
  };

  // Signatory block resolution for the print modal — the case's signatureUrl
  // is matched against the signature masters (Phase 9) so the printed name /
  // designation come from API data; no match keeps the existing generic
  // fallback labels. Missing images are tracked by src so a fresh print of a
  // different record retries the load (same pattern as Report Preview).
  const signatureSrc = assetSrc(printTarget?.signatureUrl);
  const sigMaster = signatureSrc
    ? sigMasters.find((m) => m.imageUrl && assetSrc(m.imageUrl) === signatureSrc) || null
    : null;
  const showSignatureImg = !!signatureSrc && brokenSignature !== signatureSrc;
  const printImages = printTarget && editingCase?._id === printTarget._id
    ? caseImageUrls
    : printImages;

  const handleSigned = (updated) => {
    if (!updated) return fetchCases();
    setCases((prev) => prev.map((c) => (c._id === updated._id ? { ...c, ...updated } : c)));
  };

  return (
    <div>
      <PageHeader
        title="USG Cases"
        subtitle="Today's and historical ultrasonography cases — search, filter and paginate"
        action={
          <Button variant="primary" onClick={handleOpenCreate}>
            <Plus size={16} /> Create USG Case
          </Button>
        }
      />

      {(listError || optionsError) && (
        <div className="usg-banner usg-banner-error" role="alert">
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
          From
          <input type="date" value={fromDate} onChange={(e) => { setFromDate(e.target.value); goToPage(1); }} className="select-control" />
        </label>
        <label style={{ fontSize: '0.78rem', display: 'flex', flexDirection: 'column', gap: 4 }}>
          To
          <input type="date" value={toDate} onChange={(e) => { setToDate(e.target.value); goToPage(1); }} className="select-control" />
        </label>
        {(deptFilter || assignedFilter || statusFilter || searchFilter || fromDate || toDate || dateScope !== 'today') && (
          <button type="button" className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.78rem' }} onClick={resetFilters}>
            Clear filters
          </button>
        )}
        <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginLeft: 'auto' }}>
          {filteredCases.length} case{filteredCases.length === 1 ? '' : 's'}
        </span>
      </div>

      <CaseFilterBar
        department={deptFilter}
        onDepartmentChange={(v) => { setDeptFilter(v); goToPage(1); }}
        departments={[{ value: 'USG', label: 'USG' }]}
        assignedTo={assignedFilter}
        onAssignedChange={(v) => { setAssignedFilter(v); goToPage(1); }}
        assignees={doctors.map((d) => ({ value: d._id, label: d.name }))}
        status={statusFilter}
        onStatusChange={(v) => { setStatusFilter(v); goToPage(1); }}
      />

      <DataTable
        headers={['Registered Date', 'Patient Reg No', 'Patient Name', 'Referring Doctor', 'Template Selected', 'Findings', 'Images', 'Status', 'Actions']}
        data={pagedCases}
        loading={loading}
        emptyMessage={dateScope === 'today' && !searchFilter && !fromDate && !toDate ? 'No ultrasonography cases recorded today.' : 'No ultrasonography cases matched your search query.'}
        searchValue={searchFilter}
        onSearchChange={(e) => { setSearchFilter(e.target.value); goToPage(1); }}
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
            <td>{c.templateName || 'Custom Findings'}</td>
            <td style={{ maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={c.findings || ''}>{c.findings || '—'}</td>
            <td style={{ textAlign: 'center' }}>{caseImages(c).length || '—'}</td>
            <td>
              <StatusBadge status={c.status} />
            </td>
            <td style={{ minWidth: 210 }}>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  className="btn btn-secondary"
                  style={{ padding: '4px 8px', fontSize: '0.75rem', whiteSpace: 'nowrap' }}
                  onClick={() => handleOpenEdit(c)}
                >
                  <Edit2 size={14} /> Findings
                </button>
                <button
                  className="btn btn-secondary"
                  style={{ padding: '4px 8px', fontSize: '0.75rem', whiteSpace: 'nowrap' }}
                  onClick={() => handlePrint(c)}
                >
                  <Printer size={14} /> Print
                </button>
                <InlineSignButton
                  caseId={c._id}
                  modality="usg"
                  signed={c.status === 'Completed' || !!c.signatureUrl}
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

      {/* Case Creation Modal */}
      <Modal
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        title={editingCase ? 'Edit USG Case Findings' : 'Create USG Case File'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setFormOpen(false)} disabled={submitLoading}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleFormSubmit} loading={submitLoading}>
              Save Findings
            </Button>
          </>
        }
      >
        <form onSubmit={handleFormSubmit} className="modal-form">
          {errors.api && <div className="form-error">{errors.api}</div>}
          <div className="usg-form-section-title">Case details</div>

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

          <div className="usg-form-section-title">Report findings</div>

          <Select
            label="USG Report Template"
            value={formData.templateName}
            onChange={handleTemplateChange}
            options={templates.map(t => ({ value: t.name, label: t.name }))}
            placeholder="No template (custom findings)"
          />

          {/* Selected template's API text, shown read-only until the user
              explicitly applies it — the editor's current findings are never
              swapped out behind the operator's back. */}
          {selectedTemplate && selectedTemplate.findings !== formData.findings ? (
            <div className="usg-template-preview">
              <div className="usg-template-preview-head">
                <span>Template: {selectedTemplate.name}</span>
                <Button variant="secondary" size="sm" onClick={applyTemplate}>
                  {formData.findings.trim() ? 'Replace findings' : 'Insert into findings'}
                </Button>
              </div>
              <pre>{selectedTemplate.findings}</pre>
            </div>
          ) : null}

          <div className="form-group">
            <label className="form-label" htmlFor="usg-findings">
              <span>Clinical USG Findings</span>
              <span className="form-required-star" aria-hidden="true">*</span>
            </label>
            <textarea
              id="usg-findings"
              value={formData.findings}
              onChange={(e) => setFormData(prev => ({ ...prev, findings: e.target.value }))}
              className="form-control"
              rows={8}
              placeholder="Record findings details..."
              required
            />
            {errors.findings && <p className="form-error">{errors.findings}</p>}
          </div>

          {editingCase ? (
            <div className="form-group">
              <label className="form-label">Case Images (upload runs in background — saving is never blocked)</label>
              <ImageUploader
                key={uploaderKey}
                uploadFn={(file, progress) => uploadUSGImage(editingCase._id, file, progress)}
                initialUrls={caseImages(editingCase)}
                onUploaded={setCaseImageUrls}
              />
            </div>
          ) : (
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Save the case first — images can be attached while editing.
            </p>
          )}

        </form>
      </Modal>

      {/* Print USG Findings Modal */}
      <Modal
        isOpen={printOpen}
        onClose={() => setPrintOpen(false)}
        title="USG Report Print Preview"
        footer={
          <>
            <Button variant="secondary" onClick={() => setPrintOpen(false)}>Close</Button>
            <Button variant="primary" onClick={() => window.print()}><Printer size={16} /> Print Report</Button>
          </>
        }
      >
        {profileError && (
          <div className="usg-banner usg-banner-error" role="alert">
            <AlertTriangle size={16} />
            <span>{profileError}</span>
            <Button
              variant="secondary"
              size="sm"
              icon={<RefreshCw size={14} />}
              onClick={() => loadPrintMeta()}
            >
              Retry
            </Button>
          </div>
        )}
        {printTarget && (
          <div className="printable-area" style={{ padding: '16px', color: '#000', fontSize: '0.9rem', lineHeight: '1.5' }}>
            {/* Dynamic lab letterhead (existing Phase 8 component, API profile
                data only) — replaces the previously hardcoded lab name/logo;
                on failure Letterhead renders nothing (never a fake header). */}
            <Letterhead part="header" profile={profile} loading={profileLoading} />
            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
              <p style={{ margin: '2px 0', fontWeight: '700' }}>ULTRASONOGRAPHY REPORT</p>
              <div style={{ borderBottom: '2px solid #000', margin: '10px 0', width: '100%' }}></div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', marginBottom: '1.5rem' }}>
              <div>
                <strong>Patient Name:</strong> {printTarget.patient?.name || '—'}<br />
                <strong>Age / Gender:</strong>{' '}
                {printTarget.patient?.age != null ? `${printTarget.patient.age} Yrs` : '—'} /{' '}
                {printTarget.patient?.gender || '—'}
              </div>
              <div style={{ textAlign: 'right' }}>
                <strong>Reg Code:</strong> {printTarget.patient?.registrationNumber || '—'}<br />
                <strong>Referring Doctor:</strong> {printTarget.referringDoctor?.name || 'Self'}<br />
                <strong>Date:</strong> {formatDate(printTarget.date).split(',')[0]}
              </div>
            </div>

            <div style={{ borderBottom: '1px solid #000', marginBottom: '1rem' }}></div>

            <div style={{ minHeight: '300px', whiteSpace: 'pre-wrap', fontFamily: 'sans-serif' }}>
              <strong>FINDINGS:</strong><br /><br />
              {printTarget.findings}
            </div>

            {printImages.length > 0 && (
              <div style={{ marginTop: '1rem' }}>
                <strong>ATTACHED IMAGES:</strong>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px', marginTop: '8px' }}>
                  {printImages.map((src, i) => (
                    <img
                      key={i}
                      src={String(src).startsWith('/') || String(src).startsWith('http') ? src : `/${src}`}
                      alt={`USG image ${i + 1}`}
                      style={{ width: '100%', maxHeight: 260, objectFit: 'contain', border: '1px solid #cbd5e1', borderRadius: 6, background: '#000' }}
                    />
                  ))}
                </div>
              </div>
            )}

            <div style={{ borderTop: '1px solid #000', marginTop: '2rem', paddingTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
              <div style={{ textAlign: 'center', width: '200px' }}>
                {showSignatureImg && (
                  <img
                    src={signatureSrc}
                    alt={sigMaster?.name ? `Signature of ${sigMaster.name}` : 'Signature'}
                    onError={() => setBrokenSignature(signatureSrc)}
                    style={{ height: '40px', objectFit: 'contain' }}
                  />
                )}
                <div style={{ height: showSignatureImg ? '4px' : '40px' }}></div>
                <strong>{sigMaster?.name || 'Authorised Signatory'}</strong><br />
                <span>{sigMaster?.title || 'Consultant Radiologist'}</span>
              </div>
            </div>

            {/* Lab contact footer (Phase 8 letterhead component, API data). */}
            <Letterhead part="footer" profile={profile} />
          </div>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        loading={deleteLoading}
        title="Delete USG case?"
        message={`Permanently delete USG case for ${deleteTarget?.patient?.name || 'this patient'}?`}
      />
    </div>
  );
};

export default TodaysUSGCases;
