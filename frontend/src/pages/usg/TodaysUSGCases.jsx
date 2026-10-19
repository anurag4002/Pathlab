import ServerPdfPreview from '../../components/lab/ServerPdfPreview';
import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getUSGCases, createUSGCase, updateUSGCase, getUSGTemplates, getUSGServices, uploadUSGReport, uploadUSGImage } from '../../services/usgService';
import { deleteUSGCase } from '../../services/modalityService';
import { getPatients } from '../../services/patientService';
import { getDoctors } from '../../services/doctorService';
import { getLabProfile, getSignatures } from '../../services/setupService';
import { printPdfPath, downloadBlob } from '../../services/publicService';
import formatDate from '../../utils/formatDate';
import assetSrc from '../../utils/assetSrc';
import useAuth from '../../hooks/useAuth';
import useDebounce from '../../hooks/useDebounce';
import usePagination from '../../hooks/usePagination';
import { Plus, Edit2, Printer, Trash2, AlertTriangle, RefreshCw, Upload, Download } from 'lucide-react';
import {
  DataTable,
  PageHeader,
  Button,
  Modal,
  Select,
  StatusBadge,
  ConfirmDialog,
  ImageUploader,
  FileUploader,
  PatientPicker,
  Letterhead,
  AdvancedFilterBar
} from '../../components/common';
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

const TodaysUSGCases = ({ reportsView = false }) => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'Admin';
  // Modal state is mirrored to the URL (?case=new|<id>&print=<id>) so a
  // reload mid-task restores the open pop-up instead of losing it.
  const [searchParams, setSearchParams] = useSearchParams();
  const [cases, setCases] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [services, setServices] = useState([]);
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
  const [dateScope, setDateScope] = useState(reportsView ? 'all' : 'today'); // 'today' | 'all'
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const debouncedSearch = useDebounce(searchFilter, 500);
  const { page, limit, goToPage, setLimit } = usePagination(1, 10);

  // Form States
  const [formOpen, setFormOpen] = useState(false);
  const [editingCase, setEditingCase] = useState(null);
  const [pickedPatient, setPickedPatient] = useState(null);
  const [formData, setFormData] = useState({ patient: '', referringDoctor: '', templateName: '', findings: '', serviceType: 'with-report', status: 'Pending' });
  const [reportFile, setReportFile] = useState(null);
  const [uploadTarget, setUploadTarget] = useState(null);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const validatePDF = file => {
    if (!file || !/\.pdf$/i.test(file.name)) return 'Choose a PDF report.';
    if (file.size > 10 * 1024 * 1024) return 'The PDF report must be 10 MB or smaller.';
    return '';
  };
  const handleUploadPDF = async () => {
    const error = validatePDF(uploadFile);
    if (error) { setUploadError(error); return; }
    setUploadBusy(true); setUploadError('');
    try {
      await uploadUSGReport(uploadTarget._id, uploadFile);
      setUploadTarget(null); setUploadFile(null); fetchCases();
    } catch (error) { setUploadError(getApiErrorMessage(error, 'Could not upload the USG report.')); }
    finally { setUploadBusy(false); }
  };
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
      const [patRes, docRes, tempRes, serviceRes] = await Promise.all([
        getPatients({ limit: 100 }),
        getDoctors({ status: 'Active' }),
        getUSGTemplates(), getUSGServices()
      ]);
      if (!patRes?.success) throw new Error(patRes?.message || 'Failed to load patients.');
      if (!docRes?.success) throw new Error(docRes?.message || 'Failed to load doctors.');
      if (!tempRes?.success) throw new Error(tempRes?.message || 'Failed to load templates.');
      if (!serviceRes?.success) throw new Error(serviceRes?.message || 'Failed to load USG services.');

      setPatients(
        Array.isArray(patRes.data?.patients)
          ? patRes.data.patients
          : Array.isArray(patRes.data)
            ? patRes.data
            : []
      );
      setDoctors(Array.isArray(docRes.data) ? docRes.data : []);
      setTemplates(Array.isArray(tempRes.data) ? tempRes.data : []);
      setServices(serviceRes.data || []);
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

  // Form catalogs only when creating/editing — not on every list visit.
  useEffect(() => {
    if (formOpen) loadOptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formOpen]);

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

  // Restore an open pop-up from the URL after reload (?case=new|<id>, ?print=<id>).
  // Runs once the case list is available so edit/print targets can resolve.
  // A deep-linked id may sit outside today's scope, so widen to All first.
  useEffect(() => {
    const caseParam = searchParams.get('case');
    const printParam = searchParams.get('print');
    if (!caseParam && !printParam) return;
    if ((caseParam && caseParam !== 'new') || printParam) {
      if (dateScope === 'today') { setDateScope('all'); return; }
    }
    if (!cases.length) return;
    if (caseParam === 'new' && !formOpen) {
      handleOpenCreate();
    } else if (caseParam && caseParam !== 'new' && !formOpen) {
      const found = cases.find((c) => String(c._id) === String(caseParam));
      if (found) handleOpenEdit(found);
    }
    if (printParam && !printOpen) {
      const found = cases.find((c) => String(c._id) === String(printParam));
      if (found) handlePrint(found);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cases, dateScope]);

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

  const closeForm = () => {
    setFormOpen(false);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('case');
      return next;
    }, { replace: true });
  };

  const closePrint = () => {
    setPrintOpen(false);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('print');
      return next;
    }, { replace: true });
  };

  const handleOpenCreate = () => {
    setEditingCase(null);
    setPickedPatient(null);
    setFormData({ patient: '', referringDoctor: '', templateName: '', findings: '', serviceType: 'with-report', status: 'Pending' });
    setReportFile(null);
    setCaseImageUrls([]);
    setErrors({});
    setFormOpen(true);
    setSearchParams({ case: 'new' }, { replace: true });
  };

  const handleOpenEdit = (c) => {
    setEditingCase(c);
    setPickedPatient(c.patient && typeof c.patient === 'object' ? c.patient : null);
    setFormData({
      patient: c.patient?._id || '',
      referringDoctor: c.referringDoctor?._id || '',
      templateName: c.templateName || '',
      findings: c.findings || '',
      serviceType: c.serviceType || '',
      status: c.status
    });
    setCaseImageUrls(caseImages(c));
    setReportFile(null);
    setUploaderKey((k) => k + 1);
    setErrors({});
    setFormOpen(true);
    if (c?._id) setSearchParams({ case: c._id }, { replace: true });
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
    if (!editingCase && !formData.serviceType) errs.serviceType = 'Choose a USG service';
    if (reportFile) { const error = validatePDF(reportFile); if (error) errs.reportFile = error; }
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
        referringDoctor: formData.referringDoctor || null,
        serviceType: formData.serviceType || undefined
      };

      if (editingCase) {
        res = await updateUSGCase(editingCase._id, payload);
      } else {
        res = await createUSGCase(payload);
      }

      if (res.success) {
        if (reportFile) {
          // Keep the saved id on upload failure so retry cannot create a duplicate case.
          setEditingCase(res.data);
          setSearchParams({ case: res.data._id }, { replace: true });
          await uploadUSGReport(res.data._id, reportFile);
        }
        closeForm();
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
    if (c?._id) {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set('print', c._id);
        return next;
      }, { replace: true });
    }
    // Letterhead profile + signature masters load lazily on the first print
    // open (print-only metadata — never blocks the list or the form).
    if (!c.reportFile?.size && !printMetaLoaded) loadPrintMeta();
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
    : caseImages(printTarget);

  const handleSigned = (updated) => {
    if (!updated) return fetchCases();
    setCases((prev) => prev.map((c) => (c._id === updated._id ? { ...c, ...updated } : c)));
  };

  return (
    <div>
      <PageHeader
        title={reportsView ? "USG Reports" : "USG Cases"}
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
      <AdvancedFilterBar
        showSearchButton={false}
        showClearButton={!!(deptFilter || assignedFilter || statusFilter || searchFilter || fromDate || toDate || dateScope !== 'today')}
        onClear={resetFilters}
        trailing={`${filteredCases.length} case${filteredCases.length === 1 ? '' : 's'}`}
        values={{
          dateScope,
          from: fromDate,
          to: toDate,
          search: searchFilter,
          assigned: assignedFilter,
          status: statusFilter
        }}
        onChange={(key, value) => {
          goToPage(1);
          if (key === 'dateScope') setDateScope(value);
          else if (key === 'from') setFromDate(value);
          else if (key === 'to') setToDate(value);
          else if (key === 'search') setSearchFilter(value);
          else if (key === 'assigned') setAssignedFilter(value);
          else if (key === 'status') setStatusFilter(value);
        }}
        fields={[
          {
            key: 'dateScope',
            type: 'segmented',
            options: [
              { value: 'today', label: "Today's Cases" },
              { value: 'all', label: 'All / Search' }
            ]
          },
          { key: 'from', label: 'From', type: 'date' },
          { key: 'to', label: 'To', type: 'date' },
          { key: 'search', label: 'Search', type: 'search', size: 'lg', placeholder: 'Patient name / reg no…' },
          {
            key: 'assigned',
            label: 'Assigned to',
            type: 'select',
            placeholder: 'Everyone',
            options: doctors.map((d) => ({ value: d._id, label: d.name }))
          },
          {
            key: 'status',
            label: 'Status',
            type: 'select',
            placeholder: 'All statuses',
            options: [
              { value: 'Pending', label: 'Pending Signature' },
              { value: 'Completed', label: 'Completed Report' }
            ]
          }
        ]}
      />

      <DataTable
        headers={['Registered Date', 'Patient Reg No', 'Patient Name', 'Referring Doctor', 'USG Service', 'PDF Report', 'Status', 'Actions']}
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
            <td>{services.find(service => service.value === c.serviceType)?.name || (c.serviceType ? `USG (${c.serviceType === 'with-report' ? 'With report' : 'Without report'})` : c.templateName || 'USG')}{c.price != null && <div className="form-helper">₹{c.price}</div>}</td>
            <td style={{ maxWidth: 160, overflowWrap: 'anywhere' }}>{c.reportFile?.name || (c.findings?.trim() ? 'Written findings' : c.serviceType === 'without-report' ? 'Not requested' : 'Awaiting PDF')}</td>
            <td>
              <StatusBadge status={c.status} />
            </td>
            <td style={{ minWidth: 210 }}>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <Button variant="secondary" size="sm" icon={<Upload size={14} />} onClick={() => { setUploadTarget(c); setUploadFile(null); setUploadError(''); }}>{c.reportFile?.size ? 'Replace PDF' : 'Upload PDF'}</Button>
                {!!c.reportFile?.size && <Button variant="secondary" size="sm" icon={<Download size={14} />} onClick={() => downloadBlob(`/usg/${c._id}/file`, c.reportFile.name || 'USG-report.pdf').catch(() => alert('Could not download the USG report.'))}>Download PDF</Button>}
                <button
                  className="btn btn-secondary"
                  style={{ padding: '4px 8px', fontSize: '0.75rem', whiteSpace: 'nowrap' }}
                  onClick={() => handleOpenEdit(c)}
                >
                  <Edit2 size={14} /> Edit case
                </button>
                {(!!c.reportFile?.size || !!c.findings?.trim()) && <button
                  className="btn btn-secondary"
                  style={{ padding: '4px 8px', fontSize: '0.75rem', whiteSpace: 'nowrap' }}
                  onClick={() => handlePrint(c)}
                >
                  <Printer size={14} /> Preview / Print
                </button>}
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
        onClose={closeForm}
        title={editingCase ? 'Edit USG Case' : 'Create USG Case'}
        footer={
          <>
            <Button variant="secondary" onClick={closeForm} disabled={submitLoading}>
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
          <div className="usg-form-section-title">Case details</div>
          <Select id="usg-service-type" label="USG service" value={formData.serviceType}
            onChange={event => setFormData(previous => ({ ...previous, serviceType: event.target.value, status: event.target.value === 'without-report' ? 'Completed' : 'Pending' }))}
            options={services.map(service => ({ value: service.value, label: `${service.name} — ₹${service.price}` }))}
            placeholder={editingCase && !editingCase.serviceType ? 'Existing USG case' : 'Choose USG service'}
            disabled={!!editingCase?.bill} error={errors.serviceType} required={!editingCase} />
          {editingCase?.bill && <p className="form-helper">Service and charges are linked to the bill. Edit the bill to change them.</p>}

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
              { value: 'Pending', label: 'Pending report' },
              { value: 'Completed', label: 'Completed Report' }
            ]}
            required
          />

          <div className="usg-form-section-title">PDF report</div>
          {editingCase?.reportFile?.name && <p>Uploaded: {editingCase.reportFile.name}</p>}
          <FileUploader label={editingCase?.reportFile?.size ? 'Replace PDF report' : 'Upload PDF report'}
            subtitle="Choose a PDF, up to 10 MB. You can also upload it after saving the case."
            accept=".pdf" value={reportFile} onChange={setReportFile} error={errors.reportFile} disabled={submitLoading} />
          <details open={!!editingCase?.findings}>
          <summary style={{ cursor: 'pointer', fontWeight: 600, margin: '16px 0' }}>Optional report findings</summary>

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
            </label>
            <textarea
              id="usg-findings"
              value={formData.findings}
              onChange={(e) => setFormData(prev => ({ ...prev, findings: e.target.value }))}
              className="form-control"
              rows={8}
              placeholder="Record findings details..."
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
          </details>

        </form>
      </Modal>

      <Modal isOpen={!!uploadTarget} onClose={() => !uploadBusy && setUploadTarget(null)} title={`Upload USG PDF — ${uploadTarget?.patient?.name || ''}`}
        footer={<><Button variant="secondary" disabled={uploadBusy} onClick={() => setUploadTarget(null)}>Cancel</Button><Button loading={uploadBusy} onClick={handleUploadPDF}>Upload PDF</Button></>}>
        <FileUploader label={uploadTarget?.reportFile?.size ? 'Replace PDF report' : 'Choose PDF report'} subtitle="PDF report, up to 10 MB"
          accept=".pdf" value={uploadFile} onChange={setUploadFile} error={uploadError} disabled={uploadBusy} />
      </Modal>

      {/* Print USG Findings Modal */}
      <Modal
        isOpen={printOpen}
        onClose={closePrint}
        title="USG Report Print Preview"
        footer={
          <>
            <Button variant="secondary" onClick={closePrint}>Close</Button>
            <Button variant="primary" onClick={() => printTarget?._id && printPdfPath(`/usg/${printTarget._id}/pdf`).catch(() => alert('Could not print the report. Please try again.'))}><Printer size={16} /> Print Report</Button>
          </>
        }
      >
        {profileError && !printTarget?.reportFile?.size && (
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
        {printTarget?._id && <ServerPdfPreview path={`/usg/${printTarget._id}/pdf`} />}
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
