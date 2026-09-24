import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import useClientPagination from '../../hooks/useClientPagination';
import {
  getTodaysReports,
  getPendingLabCases,
  getReportForEntry,
  uploadReport,
  deleteReport,
  createResultReport,
  saveReportResults,
  signReport,
  updateReportTat,
  verifyReport,
  resendReport
} from '../../services/reportService';
import { getPatients } from '../../services/patientService';
import { getBills } from '../../services/billService';
import { getTests } from '../../services/testService';
import { getSignatures, getLabProfile } from '../../services/setupService';
import { sendMessage, getTemplates, getCredits } from '../../services/notifyService';
import {
  getDeliveryHistory,
  getFailedDeliveries,
  getReportDeliveryStatus,
  recordDeliveryAttempt
} from '../../services/deliveryHistoryService';
import DeliveryStatusBadge from '../../components/delivery/DeliveryStatusBadge';
import ResendButton from '../../components/delivery/ResendButton';
import { downloadReportPdf, printReportPdf, fetchReportQr } from '../../services/publicService';
import downloadFile from '../../utils/downloadFile';
import formatCurrency from '../../utils/formatCurrency';
import formatDate from '../../utils/formatDate';
import { Plus, Download, Trash2, FileEdit, FileDown, QrCode, Send, PenLine, Eye, Printer, Tag, RefreshCw } from 'lucide-react';
import {
  DataTable,
  PageHeader,
  Button,
  Modal,
  Select,
  Input,
  FileUploader,
  ConfirmDialog,
  EmptyState,
  PatientPicker
} from '../../components/common';
import TatCountdown, { getTatInfo, loadTatSettings, isDoneStatus } from '../../components/lab/TatCountdown';
import WorklistTabs, { DepartmentFilterChips } from '../../components/lab/WorklistTabs';
import SignaturePicker from '../../components/lab/SignaturePicker';
import ReportPreviewModal from '../../components/lab/ReportPreviewModal';
import RejectDialog from '../../components/lab/RejectDialog';
import CommentThread from '../../components/lab/CommentThread';
import VerificationTimeline from '../../components/lab/VerificationTimeline';
import LabelPrintSheet from '../../components/lab/LabelPrintSheet';

const emptyRow = () => ({ test: '', value: '', unit: '' });

const getApiErrorMessage = (err, fallback) => {
  if (err?.response) {
    const data = err.response.data;
    if (data && typeof data.message === 'string' && data.message.trim()) return data.message;
    const status = err.response.status;
    if (status === 401) return 'Your session has expired. Please log in again.';
    if (status === 403) return 'You do not have permission to perform this action.';
    if (status === 404) return 'The requested record was not found.';
    if (status === 409) return 'The record was changed elsewhere. Please refresh and try again.';
    if (status === 402) return 'Message not sent — check delivery credits and Lab Profile channel settings.';
    if (status === 422) return 'The submitted data is invalid.';
    if (status >= 500) return 'Server error. Please try again.';
    return fallback;
  }
  if (err?.code === 'ECONNABORTED') return 'The request timed out. Please try again.';
  if (err?.request) return 'Network error. Please check your connection and try again.';
  return err?.message || fallback;
};

const inferDepartment = (report) => {
  const explicit = report?.bill?.department;
  if (typeof explicit === 'string' && explicit.trim()) return explicit.trim().toUpperCase();
  const hay = `${report?.test?.name || ''} ${report?.test?.code || ''}`.toLowerCase();
  if (/usg|ultrasound/.test(hay)) return 'USG';
  if (/x-?ray|radiograph/.test(hay)) return 'XRAY';
  return 'LAB';
};

const matchesSearch = (report, q) => {
  const query = String(q || '').trim().toLowerCase();
  if (!query) return true;
  const hay = [
    report?.registrationNumber,
    report?.patient?.name,
    report?.bill?.billNumber,
    report?.test?.name,
    report?.test?.code,
    report?.status
  ].filter(Boolean).join(' ').toLowerCase();
  return hay.includes(query);
};

const TodaysReports = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);

  // Phase 1 — worklist tabs + department filter (Phase 6 — TAT settings drive due logic).
  const [tab, setTab] = useState('today');
  const [dept, setDept] = useState('All');
  const [search, setSearch] = useState('');
  const [tatSettings] = useState(() => loadTatSettings());
  const [pendingCases, setPendingCases] = useState([]);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [pendingError, setPendingError] = useState(null);

  // Upload Form States
  const [uploadOpen, setUploadOpen] = useState(false);
  const [patients, setPatients] = useState([]);
  const [bills, setBills] = useState([]);
  const [tests, setTests] = useState([]);
  const [signatures, setSignatures] = useState([]);
  const [formData, setFormData] = useState({ patient: '', bill: '', test: '', file: null });
  const [formErrors, setFormErrors] = useState({});
  const [submitLoading, setSubmitLoading] = useState(false);

  // Delete State
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Result-entry states
  const [resultOpen, setResultOpen] = useState(false);
  const [resultForm, setResultForm] = useState({ patient: '', bill: '' });
  const [resultLoading, setResultLoading] = useState(false);
  const [entryOpen, setEntryOpen] = useState(false);
  const [activeReport, setActiveReport] = useState(null);
  const [rows, setRows] = useState([emptyRow()]);
  const [tat, setTat] = useState({ collected: '', received: '' });
  const [sigId, setSigId] = useState('');
  // Phase 3 — idempotent sign: guards double-click/double-submit.
  const [signing, setSigning] = useState(false);
  const [entryLoading, setEntryLoading] = useState(false);
  const [verifyUrl, setVerifyUrl] = useState('');
  const [sendOpen, setSendOpen] = useState(false);
  const [sendForm, setSendForm] = useState({ channel: 'sms', phone: '', templateKey: '' });
  const [sendLoading, setSendLoading] = useState(false);
  const [sendError, setSendError] = useState(null);
  const [verifyLoading, setVerifyLoading] = useState(false);
  // Message templates + credit balance from the existing /notify APIs —
  // templates: null = still loading, [] = loaded with nothing available.
  const [templates, setTemplates] = useState(null);
  const [templatesError, setTemplatesError] = useState(false);
  const [credits, setCredits] = useState(null);
  // Lab name for report message templates' {{lab}} variable — loaded from
  // the Lab Profile API (never hardcoded); empty until it arrives or on failure.
  const [labName, setLabName] = useState('');
  const [labNameError, setLabNameError] = useState(false);
  // Local failed-delivery cache; server delivery history remains authoritative.
  const [failedDeliveries, setFailedDeliveries] = useState([]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const [previewQr, setPreviewQr] = useState({ qrDataUrl: '', verifyUrl: '' });
  const [rejectOpen, setRejectOpen] = useState(false);
  const [labelTarget, setLabelTarget] = useState(null);
  const [sendResult, setSendResult] = useState(null);
  const [deliveryHistory, setDeliveryHistory] = useState([]);

  const [sortOrder, setSortOrder] = useState('Recent');
  const [statusFilter, setStatusFilter] = useState('');

  const fetchReports = async () => {
    setLoading(true);
    try {
      const res = await getTodaysReports({ status: statusFilter || undefined });
      if (res.success) {
        let list = res.data.reports;
        list = [...list].sort((a, b) => {
          if (sortOrder === 'Oldest') return new Date(a.createdAt) - new Date(b.createdAt);
          if (sortOrder === 'Due') {
            const da = getTatInfo(a, tatSettings).due?.getTime() ?? Infinity;
            const db = getTatInfo(b, tatSettings).due?.getTime() ?? Infinity;
            return da - db;
          }
          return new Date(b.createdAt) - new Date(a.createdAt);
        });
        setReports(list);
      }
    } catch (err) {
      console.error('Failed to fetch reports', err);
    } finally {
      setLoading(false);
    }
  };

  // Phase 1 — sample-wise pending list. Degrades gracefully: a 404 (or any
  // failure) leaves the today list usable with an explanatory empty state.
  const fetchPending = async () => {
    setPendingLoading(true);
    setPendingError(null);
    try {
      const res = await getPendingLabCases({ limit: 50 });
      if (res.success) {
        setPendingCases(res.data.cases || []);
      }
    } catch (err) {
      console.error('Failed to fetch pending lab cases', err);
      if (err.response?.status === 404) {
        setPendingError('unavailable');
      } else {
        setPendingError(err.response?.data?.message || 'Failed to load pending samples');
      }
      setPendingCases([]);
    } finally {
      setPendingLoading(false);
    }
  };

  const loadUploadOptions = async () => {
    try {
      const [patRes, billRes, testRes, sigRes] = await Promise.all([
        getPatients({ limit: 100 }),
        getBills({ limit: 100 }),
        getTests({ status: 'Active' }),
        getSignatures().catch(() => null)
      ]);
      if (patRes.success) setPatients(patRes.data.patients);
      if (billRes.success) setBills(billRes.data.bills);
      if (testRes.success) setTests(testRes.data);
      if (sigRes?.success) setSignatures(sigRes.data);
    } catch (err) {
      console.error('Failed to load selection options', err);
    }
  };

  // Lab name for report message templates' {{lab}} variable — server-owned
  // data from the existing Lab Profile API (Phase 8 primitive). All state
  // updates land after the await so the mount-effect call stays warning-free.
  const loadLabProfile = async () => {
    try {
      const res = await getLabProfile();
      const profile = res?.data?.profile || res?.data || null;
      setLabName(profile?.labName || '');
      setLabNameError(!profile?.labName);
    } catch {
      setLabName('');
      setLabNameError(true);
    }
  };

  // Secure report link — the server-issued verify URL from the existing QR
  // endpoint (Phase 10), used as-is as the message's {{url}} variable.
  const loadVerifyUrl = async (reportId) => {
    setVerifyUrl('');
    setVerifyLoading(true);
    try {
      const qr = await fetchReportQr(reportId);
      setVerifyUrl(qr?.success ? qr?.data?.verifyUrl || '' : '');
    } catch {
      setVerifyUrl('');
    } finally {
      setVerifyLoading(false);
    }
  };

  // Message templates from the existing /notify/templates API (the same data
  // the Message Templates screen manages) — no template keys are hardcoded.
  // All state updates land after the await so the mount-effect call is clean.
  const loadTemplates = async () => {
    try {
      const r = await getTemplates();
      setTemplates(r?.success ? r?.data?.templates || r?.data || [] : []);
      setTemplatesError(!r?.success);
    } catch {
      setTemplates(null);
      setTemplatesError(true);
    }
  };

  // Existing message-credit balance (GET /notify/credits) — informational
  // only; refreshed after a successful send (no polling).
  const loadCredits = async () => {
    try {
      const r = await getCredits();
      setCredits(r?.success && r?.data ? r.data.balance : null);
    } catch {
      setCredits(null);
    }
  };

  useEffect(() => {
    fetchReports();
    loadUploadOptions();
    setFailedDeliveries(getFailedDeliveries());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortOrder, statusFilter]);

  useEffect(() => {
    loadUploadOptions();
    loadLabProfile();
    loadTemplates();
    loadCredits();
    fetchPending();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Dashboard quick action links here with ?upload=true — open the upload modal directly.
  useEffect(() => {
    if (searchParams.get('upload') === 'true') {
      setUploadOpen(true);
      setFormErrors({});
      searchParams.delete('upload');
      setSearchParams(searchParams, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const deptOptions = useMemo(() => {
    const set = new Set(reports.map(inferDepartment));
    return ['All', ...[...set].sort()];
  }, [reports]);

  const filteredReports = useMemo(
    () => reports.filter((r) => (dept === 'All' || inferDepartment(r) === dept) && matchesSearch(r, search)),
    [reports, dept, search]
  );

  // Phase 6 — "Due" is derived client-side (no backend due-list endpoint):
  // open reports whose TAT expires within the configured urgent window.
  const dueReports = useMemo(() => {
    const windowMs = (Number(tatSettings.urgentHours) || 4) * 3600 * 1000;
    return filteredReports
      .map((r) => ({ report: r, info: getTatInfo(r, tatSettings) }))
      .filter(({ report, info }) => info.due && !isDoneStatus(report.status) && info.remainingMs <= windowMs)
      .sort((a, b) => a.info.due - b.info.due)
      .map(({ report }) => report);
  }, [filteredReports, tatSettings]);

  const visibleReports = tab === 'due' ? dueReports : filteredReports;

  // Client-side pagination over the filtered worklist (plus pending list).
  const pg = useClientPagination(visibleReports, 10);
  const pgPending = useClientPagination(pendingCases, 10);

  // Picked patient objects for the upload + result-entry pickers (may come
  // from server search beyond the preloaded list).
  const [uploadPatient, setUploadPatient] = useState(null);
  const [resultPatient, setResultPatient] = useState(null);

  const handleOpenUpload = () => {
    setFormData({ patient: '', bill: '', test: '', file: null });
    setUploadPatient(null);
    setFormErrors({});
    setUploadOpen(true);
  };

  const handleFileChange = (file) => {
    setFormData(prev => ({ ...prev, file }));
  };

  const validate = () => {
    const errs = {};
    if (!formData.patient) errs.patient = 'Please select a patient';
    if (!formData.bill) errs.bill = 'Please select an invoice';
    if (!formData.file) errs.file = 'Please upload a PDF/Image report file';
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitLoading(true);
    try {
      const payload = new FormData();
      payload.append('patient', formData.patient);
      payload.append('bill', formData.bill);
      if (formData.test) payload.append('test', formData.test);
      payload.append('file', formData.file);
      const res = await uploadReport(payload);
      if (res.success) {
        setUploadOpen(false);
        fetchReports();
      }
    } catch (err) {
      setFormErrors({ api: err.response?.data?.message || 'Failed to upload report file' });
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      const res = await deleteReport(deleteTarget._id);
      if (res.success) {
        setDeleteTarget(null);
        fetchReports();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete report');
    } finally {
      setDeleteLoading(false);
    }
  };

  // ---- Result entry flow ----
  const handleCreateResult = async () => {
    if (!resultForm.patient || !resultForm.bill) { alert('Select patient and bill'); return; }
    setResultLoading(true);
    try {
      const res = await createResultReport(resultForm);
      if (res.success) {
        setResultOpen(false);
        setResultForm({ patient: '', bill: '' });
        setResultPatient(null);
        fetchReports();
        fetchPending();
        openEntry(res.data);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to register result entry');
    } finally {
      setResultLoading(false);
    }
  };

  // Start result entry directly from a pending sample (bill without a report).
  const handleStartPendingEntry = async (pendingCase) => {
    const billId = pendingCase?.bill?._id || pendingCase?.bill;
    const patientId = pendingCase?.bill?.patient?._id || pendingCase?.bill?.patient;
    if (!billId || !patientId) { alert('Pending case is missing patient/bill linkage'); return; }
    setResultLoading(true);
    try {
      const res = await createResultReport({ patient: patientId, bill: billId });
      if (res.success) {
        fetchReports();
        fetchPending();
        setTab('today');
        openEntry(res.data);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to register result entry');
    } finally {
      setResultLoading(false);
    }
  };

  const openEntry = async (report) => {
    setActiveReport(report);
    setSendResult(null);
    setDeliveryHistory(getDeliveryHistory(report._id));
    setRows(report.results?.length ? report.results.map((r) => ({ test: r.test?._id || r.test || '', value: r.value || '', unit: r.unit || '' })) : [emptyRow()]);
    setTat({ collected: report.tat?.collected ? String(report.tat.collected).slice(0, 10) : '', received: report.tat?.received ? String(report.tat.received).slice(0, 10) : '' });
    setSigId('');
    setEntryOpen(true);
    setVerifyUrl('');
    loadVerifyUrl(report._id);
    // Enrich with the full entry payload (bill items -> tests with ranges).
    // Degrades gracefully: the shell report above is already usable.
    try {
      const entry = await getReportForEntry(report._id);
      const testEntries = entry?.data?.testEntries || [];
      if (testEntries.length) {
        setRows(testEntries.map((testEntry) => ({
          test: testEntry.testId || '',
          value: testEntry.existingValue || '',
          unit: testEntry.existingUnit || testEntry.unit || ''
        })));
      }
    } catch {
      // Keep the shell report usable when enrichment is unavailable.
    }
  };

  const handleSaveResults = async () => {
    const payload = rows.filter((r) => r.test && String(r.value) !== '').map((r) => ({ test: r.test, value: r.value, unit: r.unit }));
    if (!payload.length) { alert('Add at least one result row'); return; }
    setEntryLoading(true);
    try {
      const res = await saveReportResults(activeReport._id, payload);
      if (res.success) {
        setActiveReport(res.data);
        setRows(res.data.results.map((r) => ({ test: r.test || '', value: r.value || '', unit: r.unit || '' })));
        fetchReports();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to save results');
    } finally {
      setEntryLoading(false);
    }
  };

  const handleSaveTat = async () => {
    try {
      const res = await updateReportTat(activeReport._id, { ...(tat.collected ? { collected: tat.collected } : {}), ...(tat.received ? { received: tat.received } : {}) });
      if (res.success) { setActiveReport(res.data); fetchReports(); }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update TAT');
    }
  };

  // Phase 3+15 — idempotent sign: double-click/double-submit cannot
  // double-sign. Sources the signature id from /api/setup/signatures
  // (via SignaturePicker), never from lab-profile fields.
  const handleSign = async () => {
    if (signing) return;
    if (!sigId) { alert('Select a signature'); return; }
    if (!activeReport?.results?.length) { alert('Enter results before signing'); return; }
    setSigning(true);
    try {
      const res = await signReport(activeReport._id, sigId);
      if (res.success) { setActiveReport(res.data); fetchReports(); }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to sign report');
    } finally {
      setSigning(false);
    }
  };

  // Opens the delivery modal for one specific report (row action or entry
  // modal), so a send can only ever target the report it was opened for.
  const openSend = (report) => {
    if (!report) return;
    setActiveReport(report);
    setSendForm({ channel: 'sms', phone: report?.patient?.phone || '', templateKey: '' });
    setSendError(null);
    setSendResult(null);
    setSendOpen(true);
    loadVerifyUrl(report._id);
    if (!labName) loadLabProfile();
  };

  // Values this screen can fill into a template's {{variables}} — all from
  // the existing report / QR / Lab-Profile APIs, never hardcoded.
  const availableVars = {
    name: activeReport?.patient?.name || '',
    regNo: activeReport?.registrationNumber || '',
    url: verifyUrl,
    lab: labName
  };

  // Active templates for the selected channel. A template is only offered
  // when every placeholder it declares (variables + body) can be filled from
  // availableVars, so no literal {{placeholder}} can leak into a send.
  const channelTemplates = (templates || []).filter((t) => {
    if (t.status !== 'Active' || t.channel !== sendForm.channel) return false;
    const bodyVars = [...String(t.body || '').matchAll(/\{\{\s*([\w.]+)\s*\}\}/g)].map((m) => m[1]);
    const required = [...(t.variables || []), ...bodyVars];
    return required.every((v) => Object.prototype.hasOwnProperty.call(availableVars, v));
  });
  const selectedTemplate =
    channelTemplates.find((t) => t.key === sendForm.templateKey) || channelTemplates[0] || null;

  // Phase 4+10 — in-app PDF preview (shared print layout + QR), plus print
  // state: server PDF via GET /api/reports/:id/pdf with failure feedback
  // (previously an un-awaited fire-and-forget).
  const [printingId, setPrintingId] = useState('');
  const handlePrintPdf = async (id) => {
    if (!id || printingId) return;
    setPrintingId(id);
    try {
      await printReportPdf(id, true);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to print report — the server PDF could not be loaded.');
    } finally {
      setPrintingId('');
    }
  };
  const handleOpenPreview = async (report) => {
    const target = report || activeReport;
    if (!target?._id) return;
    if (report && report._id !== activeReport?._id) setActiveReport(report);
    setPreviewOpen(true);
    setPreviewLoading(true);
    setPreviewError('');
    try {
      const qr = await fetchReportQr(target._id);
      if (qr?.success) {
        setPreviewQr({ qrDataUrl: qr.data.qrDataUrl || '', verifyUrl: qr.data.verifyUrl || '' });
        if (!verifyUrl) setVerifyUrl(qr.data.verifyUrl || '');
      } else {
        setPreviewQr({ qrDataUrl: '', verifyUrl: verifyUrl || '' });
      }
    } catch (err) {
      // QR is enhancement-only: preview still renders with URL fallback text.
      setPreviewQr({ qrDataUrl: '', verifyUrl: verifyUrl || '' });
      setPreviewError(getApiErrorMessage(err, 'Failed to prepare the report preview.'));
    } finally {
      setPreviewLoading(false);
    }
  };

  const deliver = async (payload) => {
    // Phase 7 — capture POST /api/notify/send responses (no fire-and-forget)
    // and persist per-report history locally until the backend delivery-status
    // endpoint exists.
    setSendLoading(true);
    setSendResult(null);
    try {
      const res = await sendMessage(payload);
      const ok = res?.success !== false;
      recordDeliveryAttempt({
        reportId: activeReport._id,
        regNo: activeReport.registrationNumber,
        channel: payload.channel,
        to: payload.to,
        status: ok ? 'sent' : 'failed',
        error: ok ? '' : (res?.message || 'Send rejected by server'),
        response: res,
      });
      setDeliveryHistory(getDeliveryHistory(activeReport._id));
      setFailedDeliveries(getFailedDeliveries());
      setSendResult({ ok, message: ok ? 'Message sent' : (res?.message || 'Failed to send message') });
      if (ok) setSendOpen(false);
      return ok;
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to send message';
      recordDeliveryAttempt({
        reportId: activeReport._id,
        regNo: activeReport.registrationNumber,
        channel: payload.channel,
        to: payload.to,
        status: 'failed',
        error: message,
      });
      setDeliveryHistory(getDeliveryHistory(activeReport._id));
      setFailedDeliveries(getFailedDeliveries());
      setSendResult({ ok: false, message });
      return false;
    } finally {
      setSendLoading(false);
    }
  };

  const handleSend = async () => {
    if (sendLoading) return;
    const to = sendForm.phone.trim();
    if (!to) {
      setSendError('Enter the patient phone number.');
      return;
    }
    if (verifyLoading) return;
    if (!verifyUrl) {
      setSendError('Secure report link unavailable — retry loading it.');
      return;
    }
    if (!labName) {
      setSendError('Lab profile not loaded — retry loading it.');
      return;
    }
    if (!selectedTemplate) {
      setSendError('No active template for this channel can be filled with this report’s data.');
      return;
    }
    setSendError(null);
    await deliver({
      channel: sendForm.channel,
      templateKey: selectedTemplate.key,
      to,
      reportId: activeReport?._id,
      vars: availableVars
    });
  };

  const handleResend = async (entry) => {
    if (!activeReport?._id) return;
    await deliver({
      channel: entry.channel,
      templateKey: entry.templateKey || (entry.channel === 'whatsapp' ? 'report-ready-wa' : 'report-ready'),
      to: entry.to,
      reportId: activeReport._id,
      vars: {
        name: activeReport.patient?.name || '',
        regNo: activeReport.registrationNumber || entry.regNo || '',
        url: verifyUrl,
        lab: labName
      }
    });
  };

  const billOptions = (patientId) => bills.filter(b => !patientId || b.patient?._id === patientId || b.patient === patientId).map(b => ({ value: b._id, label: `${b.billNumber} (${formatCurrency(b.totalAmount)})` }));

  const pendingItemsLabel = (pendingCase) => {
    const items = pendingCase?.bill?.items;
    if (!Array.isArray(items) || !items.length) return '—';
    const names = items.map((i) => (typeof i === 'object' ? i.name || i.testName || 'Item' : 'Item'));
    const label = names.join(', ');
    return label.length > 60 ? `${label.slice(0, 60)}…` : label;
  };

  return (
    <div>
      <PageHeader
        title="Laboratory Reports Completed"
        subtitle="View diagnostic PDF findings completed today and upload clinical reports"
        action={
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button variant="secondary" onClick={() => { setResultForm({ patient: '', bill: '' }); setResultPatient(null); setResultOpen(true); }}>
              <FileEdit size={16} /> New result entry
            </Button>
            <Button variant="primary" onClick={handleOpenUpload}>
              <Plus size={16} /> Upload Report
            </Button>
          </div>
        }
      />

      {(() => {
        const count = (s) => reports.filter((r) => r.status === s).length;
        const stats = [
          ['All', reports.length], ['Registered', count('Registered')], ['Received', count('Received')],
          ['Reported', count('Reported')], ['Signed', count('Signed')], ['Completed', count('Completed')],
        ];
        return (
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '1rem', alignItems: 'center' }}>
            {stats.map(([k, v]) => (
              <button key={k} onClick={() => { setStatusFilter(k === 'All' ? '' : k); pg.reset(); }} className={`btn ${statusFilter === (k === 'All' ? '' : k) ? 'btn-primary' : 'btn-secondary'}`} style={{ padding: '4px 10px', fontSize: '0.75rem' }}>{k} {v}</button>
            ))}
            <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} className="select-control" style={{ maxWidth: '160px', padding: '4px 8px', fontSize: '0.8rem' }}>
              <option value="Recent">Sort: Recent</option>
              <option value="Oldest">Sort: Oldest</option>
              <option value="Due">Sort: Due first</option>
            </select>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Reports for today • Go to <a href="/lab/search">Search</a> • Recent changes auto-refresh on save</span>
          </div>
        );
      })()}

      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '1rem' }}>
        <WorklistTabs
          active={tab}
          onChange={(t) => { setTab(t); pg.reset(); pgPending.reset(); }}
          counts={{ today: filteredReports.length, due: dueReports.length, pending: pendingCases.length }}
        />
        <DepartmentFilterChips options={deptOptions} value={dept} onChange={(d) => { setDept(d); pg.reset(); }} />
        <input
          type="text"
          placeholder="Search patient / reg no / bill / test…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); pg.reset(); }}
          className="select-control"
          style={{ maxWidth: '260px', padding: '4px 8px', fontSize: '0.8rem' }}
        />
      </div>

      {tab === 'pending' ? (
        pendingError ? (
            <EmptyState
              title="Pending samples unavailable"
              message={pendingError === 'unavailable'
                ? 'The pending-samples feed is not reachable right now. Showing today\u2019s reports instead — no data was lost.'
                : pendingError}
            action={<Button variant="secondary" size="sm" onClick={() => setTab('today')}>Back to Today</Button>}
          />
        ) : (
          <DataTable
            headers={['Patient', 'Reg No', 'Bill Number', 'Items', 'Report Status', 'Actions']}
            data={pgPending.paged}
            loading={pendingLoading}
            emptyMessage="No pending samples — every lab bill already has a report."
            maxHeight={440}
            pagination={{
              total: pgPending.total,
              page: pgPending.page,
              limit: pgPending.limit,
              pages: pgPending.pages,
              onPageChange: pgPending.goToPage,
              onLimitChange: pgPending.setLimit,
            }}
            renderRow={(pendingCase) => {
              const bill = pendingCase?.bill || {};
              const patient = bill?.patient || {};
              return (
                <tr key={bill._id || pendingCase?.report?._id}>
                  <td style={{ fontWeight: '600' }}>{patient?.name || 'Walk-in Patient'}</td>
                  <td>{patient?.registrationNumber || '—'}</td>
                  <td>{bill?.billNumber || 'N/A'}</td>
                  <td style={{ maxWidth: '240px' }}>{pendingItemsLabel(pendingCase)}</td>
                  <td>{pendingCase?.report?.status || 'Pending'}</td>
                  <td>
                    <button
                      className="btn btn-secondary"
                      style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                      onClick={() => handleStartPendingEntry(pendingCase)}
                      disabled={resultLoading}
                    >
                      <FileEdit size={14} /> Start entry
                    </button>
                  </td>
                </tr>
              );
            }}
          />
        )
      ) : (
        <DataTable
          headers={['Patient Reg No', 'Patient Name', 'Bill Number', 'Test', 'Completed Date', 'TAT', 'Status', 'Uploader', 'Actions']}
          data={pg.paged}
          loading={loading}
          emptyMessage={tab === 'due'
            ? 'Nothing due within the urgent window — all open reports are on time.'
            : 'No laboratory reports recorded today.'}
          maxHeight={480}
          dense
          stickyActions
          pagination={{
            total: pg.total,
            page: pg.page,
            limit: pg.limit,
            pages: pg.pages,
            onPageChange: pg.goToPage,
            onLimitChange: pg.setLimit,
          }}
        renderRow={(report) => (
          <tr key={report._id}>
            <td style={{ fontWeight: '600', whiteSpace: 'nowrap' }}>{report.registrationNumber}</td>
            <td style={{ fontWeight: '600' }}>{report.patient?.name || 'Walk-in Patient'}</td>
            <td style={{ whiteSpace: 'nowrap' }}>{report.bill?.billNumber || 'N/A'}</td>
            <td>{report.test ? `${report.test.name} (${report.test.code})` : 'General Findings'}</td>
            <td style={{ whiteSpace: 'nowrap' }} title={formatDate(report.reportDate)}>{formatDate(report.reportDate).split(',')[0]}</td>
              <td style={{ maxWidth: 190 }}><span className="tat-wrap"><TatCountdown report={report} settings={tatSettings} /></span></td>
              <td>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span>{report.status}</span>
                  <DeliveryStatusBadge status={getReportDeliveryStatus(report._id)} />
                </div>
              </td>
              <td>{report.uploadedBy?.name || 'N/A'}</td>
              <td style={{ minWidth: 150 }}>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <button className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '0.75rem', whiteSpace: 'nowrap' }} onClick={() => openEntry(report)}>
                    <FileEdit size={14} /> Enter results
                  </button>
                  {/* Phase 4 — in-app preview (shared print layout); PDF/Print
                      inside the modal use printReportPdf/downloadReportPdf. */}
                  <button className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '0.75rem' }} onClick={() => handleOpenPreview(report)} title="Preview">
                    <Eye size={14} />
                  </button>
                  <button className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '0.75rem' }} onClick={() => handlePrintPdf(report._id)} disabled={printingId === report._id} title={printingId === report._id ? 'Printing…' : 'Print the server-rendered PDF'}>
                    <Printer size={14} />
                  </button>
                  <button className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '0.75rem' }} onClick={() => downloadReportPdf(report._id, true)} title="Download PDF">
                    <FileDown size={14} />
                  </button>
                  {report.fileUrl && (
                    <button
                      className="btn btn-secondary"
                      style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                      onClick={() => downloadFile(`/${report.fileUrl}`, `report_${report.registrationNumber}.pdf`)}
                      title="Download uploaded file"
                    >
                      <Download size={14} />
                    </button>
                  )}
                  <button className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '0.75rem' }} onClick={() => openSend(report)} title="Send report notification">
                    <Send size={14} />
                  </button>
                  <button className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '0.75rem' }} onClick={() => setLabelTarget(report)} title="Print barcode labels on the label printer (bill / case / sample)">
                    <Tag size={14} />
                  </button>
                  <button className="btn btn-danger" style={{ padding: '4px 8px', fontSize: '0.75rem' }} onClick={() => setDeleteTarget(report)} title="Delete report">
                    <Trash2 size={14} />
                  </button>
                </div>
              </td>
            </tr>
          )}
        />
      )}

      {/* Phase 7 — failed sends (local history until backend delivery-status exists) */}
      {failedDeliveries.length > 0 && (
        <div className="card" style={{ marginTop: '1rem', borderLeft: '4px solid var(--color-danger, #dc2626)' }}>
          <h4 style={{ fontWeight: '700', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
            Failed deliveries ({failedDeliveries.length})
          </h4>
          <table style={{ width: '100%', fontSize: '0.8rem' }}>
            <thead><tr><th style={{ textAlign: 'left' }}>Reg No</th><th>Channel</th><th>To</th><th style={{ textAlign: 'left' }}>Error</th><th>Time</th></tr></thead>
            <tbody>
              {failedDeliveries.slice(0, 10).map((h) => (
                <tr key={h.id}>
                  <td style={{ fontWeight: '600' }}>{h.regNo || '—'}</td>
                  <td style={{ textAlign: 'center' }}>{h.channel}</td>
                  <td style={{ textAlign: 'center' }}>{h.to}</td>
                  <td>{h.error || '—'}</td>
                  <td style={{ textAlign: 'center' }}>{new Date(h.at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '6px' }}>
            Retry from the report detail (Enter results → Delivery) or the <a href="/settings/jobs">job queue</a>.
          </p>
        </div>
      )}

      {/* Upload Modal */}
      <Modal
        isOpen={uploadOpen}
        onClose={() => setUploadOpen(false)}
        title="Upload Diagnostic Findings Report"
        footer={
          <>
            <Button variant="secondary" onClick={() => setUploadOpen(false)} disabled={submitLoading}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleUploadSubmit} loading={submitLoading}>
              Upload File
            </Button>
          </>
        }
      >
        <form onSubmit={handleUploadSubmit} className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
          {formErrors.api && <div className="form-error">{formErrors.api}</div>}
          <PatientPicker
            label="Patient Profile"
            value={uploadPatient || patients.find((p) => p._id === formData.patient) || null}
            onSelect={(p) => { setUploadPatient(p); setFormData((prev) => ({ ...prev, patient: p ? p._id : '', bill: '' })); }}
            error={formErrors.patient}
            required
          />
          <Select
            label="Related Bill Invoice"
            value={formData.bill}
            onChange={(e) => setFormData(prev => ({ ...prev, bill: e.target.value }))}
            options={bills.filter(b => b.patient?._id === formData.patient).map(b => ({ value: b._id, label: `${b.billNumber} (${formatCurrency(b.totalAmount)})` }))}
            error={formErrors.bill}
            required
            placeholder="Select Bill (Choose patient first)"
            disabled={!formData.patient}
          />
          <Select
            label="Specific Test (Optional)"
            value={formData.test}
            onChange={(e) => setFormData(prev => ({ ...prev, test: e.target.value }))}
            options={tests.map(t => ({ value: t._id, label: `${t.name} (${t.code})` }))}
            placeholder="Link to generic invoice total"
          />
          <div style={{ marginTop: '0.5rem' }}>
            <FileUploader
              onChange={handleFileChange}
              value={formData.file}
              label="Select PDF Report or Scan findings file"
            />
            {formErrors.file && <p className="form-error">{formErrors.file}</p>}
          </div>
        </form>
      </Modal>

      {/* New result entry modal */}
      <Modal
        isOpen={resultOpen}
        onClose={() => setResultOpen(false)}
        title="New Result Entry"
        footer={
          <>
            <Button variant="secondary" onClick={() => setResultOpen(false)} disabled={resultLoading}>Cancel</Button>
            <Button variant="primary" onClick={handleCreateResult} loading={resultLoading}>Register Entry</Button>
          </>
        }
      >
        <div className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
          <PatientPicker
            label="Patient Profile"
            value={resultPatient || patients.find((p) => p._id === resultForm.patient) || null}
            onSelect={(p) => { setResultPatient(p); setResultForm((prev) => ({ ...prev, patient: p ? p._id : '', bill: '' })); }}
            required
          />
          <Select
            label="Related Bill Invoice"
            value={resultForm.bill}
            onChange={(e) => setResultForm(prev => ({ ...prev, bill: e.target.value }))}
            options={billOptions(resultForm.patient)}
            required
            placeholder="Select Bill (Choose patient first)"
            disabled={!resultForm.patient}
          />
        </div>
      </Modal>

      {/* Enter results modal */}
      <Modal
        isOpen={entryOpen}
        onClose={() => setEntryOpen(false)}
        title={`Enter Results — ${activeReport?.registrationNumber || ''}`}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEntryOpen(false)}>Close</Button>
            <Button variant="secondary" onClick={() => handleOpenPreview()} disabled={!activeReport?._id || previewLoading}><Eye size={14} /> Preview</Button>
            <Button variant="secondary" onClick={() => activeReport && handlePrintPdf(activeReport._id)} disabled={!activeReport?._id || !!printingId} title="Print the server-rendered PDF (GET /api/reports/:id/pdf)"><Printer size={14} /> {printingId ? 'Printing…' : 'Print'}</Button>
            <Button variant="secondary" onClick={() => activeReport && downloadReportPdf(activeReport._id, true)}><FileDown size={14} /> PDF</Button>
            <Button variant="secondary" onClick={() => openSend(activeReport)}><Send size={14} /> Send</Button>
            <Button variant="primary" onClick={handleSaveResults} loading={entryLoading}>Save Results</Button>
          </>
        }
      >
        {rows.map((row, i) => (
          <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
            <Select
              value={row.test}
              onChange={(e) => setRows(prev => prev.map((r, j) => j === i ? { ...r, test: e.target.value, unit: tests.find(t => t._id === e.target.value)?.unit || r.unit } : r))}
              options={tests.map(t => ({ value: t._id, label: `${t.name} (${t.code})` }))}
              placeholder="Select test"
              style={{ flex: 2 }}
            />
            <Input value={row.value} onChange={(e) => setRows(prev => prev.map((r, j) => j === i ? { ...r, value: e.target.value } : r))} placeholder="Value" style={{ flex: 1 }} />
            <Input value={row.unit} onChange={(e) => setRows(prev => prev.map((r, j) => j === i ? { ...r, unit: e.target.value } : r))} placeholder="Unit" style={{ flex: 1 }} />
            <Button variant="secondary" size="sm" onClick={() => setRows(prev => prev.filter((_, j) => j !== i))}>×</Button>
          </div>
        ))}
        <Button variant="secondary" size="sm" onClick={() => setRows(prev => [...prev, emptyRow()])}><Plus size={14} /> Add row</Button>

        {(activeReport?.results?.length > 0) && (
          <div style={{ marginTop: '12px' }}>
            <strong style={{ fontSize: '0.8rem' }}>Saved rows (with flags):</strong>
            <table style={{ width: '100%', fontSize: '0.8rem', marginTop: '4px' }}>
              <thead><tr><th style={{ textAlign: 'left' }}>Test</th><th>Value</th><th>Unit</th><th>Flag</th></tr></thead>
              <tbody>
                {activeReport.results.map((r, i) => (
                  <tr key={i}>
                    <td>{r.testName || r.test?.name || '—'}{r.derived ? ' (derived)' : ''}</td>
                    <td style={{ textAlign: 'center' }}>{r.value}</td>
                    <td style={{ textAlign: 'center' }}>{r.unit}</td>
                    <td style={{ textAlign: 'center', fontWeight: 700, color: r.flag === 'N' ? 'green' : 'red' }}>{r.flag}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
          <Input type="date" label="Collected (TAT)" value={tat.collected} onChange={(e) => setTat(p => ({ ...p, collected: e.target.value }))} style={{ flex: 1 }} />
          <Input type="date" label="Received (TAT)" value={tat.received} onChange={(e) => setTat(p => ({ ...p, received: e.target.value }))} style={{ flex: 1 }} />
          <div style={{ alignSelf: 'flex-end' }}><Button variant="secondary" size="sm" onClick={handleSaveTat}>Save TAT</Button></div>
        </div>

        {/* Phase 15 — sign from /api/setup/signatures with department
            auto-select (never lab-profile fields). Idempotent: the button
            disables while a sign request is in flight. */}
        <div style={{ display: 'flex', gap: '8px', marginTop: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <SignaturePicker
            signatures={signatures}
            value={sigId}
            onChange={(e) => setSigId(e.target.value)}
            department={activeReport ? inferDepartment(activeReport) : ''}
            disabled={signing}
          />
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <Button variant="secondary" size="sm" onClick={handleSign} loading={signing} disabled={signing}>
              <PenLine size={14} /> {signing ? 'Signing…' : 'Sign'}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => handleOpenPreview()} disabled={previewLoading}>
              <Eye size={14} /> Preview
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setRejectOpen(true)}>
              Reject…
            </Button>
          </div>
        </div>
        {verifyUrl && <p style={{ fontSize: '0.75rem', marginTop: '8px', wordBreak: 'break-all' }}><QrCode size={12} /> Verify: {verifyUrl}</p>}
        {!verifyUrl && previewQr.verifyUrl && (
          <p style={{ fontSize: '0.75rem', marginTop: '8px', wordBreak: 'break-all' }}>
            <QrCode size={12} /> Verify: {previewQr.verifyUrl}
          </p>
        )}

        {/* Phase 7 — delivery status + per-report history (local until backend endpoint exists) */}
        <div style={{ marginTop: '12px', borderTop: '1px solid var(--color-border, #e2e8f0)', paddingTop: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <strong style={{ fontSize: '0.8rem' }}>Delivery</strong>
            {activeReport && <DeliveryStatusBadge status={sendLoading ? 'sending' : getReportDeliveryStatus(activeReport._id)} />}
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>via {labName}</span>
          </div>
          {deliveryHistory.length === 0 ? (
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>No delivery attempts recorded for this report yet.</p>
          ) : (
            <table style={{ width: '100%', fontSize: '0.78rem' }}>
              <thead><tr><th style={{ textAlign: 'left' }}>Time</th><th>Channel</th><th>To</th><th>Status</th><th style={{ textAlign: 'left' }}>Error</th><th></th></tr></thead>
              <tbody>
                {deliveryHistory.map((h) => (
                  <tr key={h.id}>
                    <td>{new Date(h.at).toLocaleString()}</td>
                    <td style={{ textAlign: 'center' }}>{h.channel}</td>
                    <td style={{ textAlign: 'center' }}>{h.to}</td>
                    <td style={{ textAlign: 'center' }}><DeliveryStatusBadge status={h.status} /></td>
                    <td style={{ maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{h.error || '—'}</td>
                    <td>{h.status === 'failed' && <ResendButton onResend={() => handleResend(h)} loading={sendLoading} />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '6px' }}>
            History loads from GET /api/reports/:id/delivery-status with on-device fallback.
          </p>
        </div>

        {/* Phase 3+9 — verification + rejection (gated: verify/reject/comments/
            resend endpoints + Verified/Rejected enum do NOT exist on the
            backend). Timeline renders real lifecycle data; Verified/Rejected
            steps stay display-only. Reject confirm + comment composer stay
            disabled with an explicit "backend pending" note — never faked. */}
        {activeReport && <VerificationTimeline report={activeReport} />}
        <CommentThread
          comments={activeReport?.comments || []}
          reportId={activeReport?._id}
          onPosted={(r) => { const rep = r?.report || r; if (rep?._id) { setActiveReport(rep); fetchReports(); } }}
        />
        <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
          <Button variant="secondary" size="sm" onClick={async () => { try { const r = await verifyReport(activeReport._id); const rep = r?.data || r; if (rep?._id) { setActiveReport(rep); fetchReports(); } } catch (e) { alert(e.response?.data?.message || 'Verify failed'); } }}>Verify</Button>
          <Button variant="secondary" size="sm" onClick={() => setRejectOpen(true)}>Reject…</Button>
          {activeReport?.status === 'Rejected' && (
            <Button variant="secondary" size="sm" onClick={async () => { try { const r = await resendReport(activeReport._id); const rep = r?.data || r; if (rep?._id) { setActiveReport(rep); fetchReports(); } } catch (e) { alert(e.response?.data?.message || 'Resend failed'); } }}>Resend for correction</Button>
          )}
        </div>
      </Modal>

      {/* Send modal — targets exactly the report it was opened for; contact
          is prefilled from the patient record, templates come from the
          /notify API (filtered by channel + fillable placeholders), and the
          message variables come from server APIs (secure QR verify link +
          Lab Profile name). Email is shown but never functional: the backend
          Patient record has no email field and no report email template. */}
      <Modal
        isOpen={sendOpen}
        onClose={() => setSendOpen(false)}
        title="Send Report Notification"
        footer={
          <>
            <Button variant="secondary" onClick={() => setSendOpen(false)} disabled={sendLoading}>Cancel</Button>
            <Button
              variant="primary"
              onClick={handleSend}
              loading={sendLoading}
              disabled={!sendForm.phone.trim() || !verifyUrl || !labName || !selectedTemplate}
            >
              <Send size={14} /> {sendForm.channel === 'whatsapp' ? 'Send WhatsApp' : 'Send SMS'}
            </Button>
          </>
        }
      >
        <p style={{ fontSize: '0.875rem', fontWeight: '600', marginBottom: '8px' }}>
          {activeReport?.patient?.name || '—'} · {activeReport?.registrationNumber || '—'}
        </p>
        <div className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
          <div>
            <span className="form-label" style={{ display: 'block' }}>Channel</span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <Button variant={sendForm.channel === 'sms' ? 'primary' : 'secondary'} size="sm" onClick={() => setSendForm(p => ({ ...p, channel: 'sms' }))}>SMS</Button>
              <Button variant={sendForm.channel === 'whatsapp' ? 'primary' : 'secondary'} size="sm" onClick={() => setSendForm(p => ({ ...p, channel: 'whatsapp' }))}>WhatsApp</Button>
              <span title="Email is unavailable: the backend Patient record has no email field and no report email template exists.">
                <Button variant="secondary" size="sm" disabled>Email</Button>
              </span>
            </div>
          </div>
          {sendResult && (
            <div style={{ fontSize: '0.82rem', color: sendResult.ok ? 'green' : 'var(--color-danger, #dc2626)' }} role="status">
              {sendResult.message}
            </div>
          )}
          <Select
            label="Message template"
            value={selectedTemplate?.key || ''}
            onChange={(e) => setSendForm(p => ({ ...p, templateKey: e.target.value }))}
            options={channelTemplates.map((t) => ({ value: t.key, label: t.key }))}
            placeholder={channelTemplates.length ? 'Select a template' : 'No template available'}
            disabled={!channelTemplates.length}
            required
          />
          <Input label="Patient phone number" value={sendForm.phone} onChange={(e) => setSendForm(p => ({ ...p, phone: e.target.value }))} required />
        </div>
        {templates !== null && !templatesError && channelTemplates.length === 0 && (
          <div className="form-error" style={{ marginTop: '8px' }}>
            No active template for this channel can be filled with this report’s data.
          </div>
        )}
        {templates === null && !templatesError && (
          <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '8px' }}>
            Preparing message templates…
          </p>
        )}
        {templatesError && (
          <div className="form-error" style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>Message templates unavailable.</span>
            <Button variant="secondary" size="sm" onClick={loadTemplates}>
              <RefreshCw size={14} /> Retry
            </Button>
          </div>
        )}
        {credits !== null && (
          <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '8px' }}>
            Message credits: {credits}
          </p>
        )}
        {sendError && <div className="form-error" style={{ marginTop: '8px' }}>{sendError}</div>}
        {verifyLoading && !verifyUrl && (
          <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '8px' }}>
            Preparing secure report link…
          </p>
        )}
        {!verifyLoading && !verifyUrl && (
          <div className="form-error" style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>Secure report link unavailable.</span>
            <Button variant="secondary" size="sm" onClick={() => activeReport && loadVerifyUrl(activeReport._id)}>
              <RefreshCw size={14} /> Retry
            </Button>
          </div>
        )}
        {!labName && !labNameError && (
          <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '8px' }}>
            Preparing lab profile…
          </p>
        )}
        {!labName && labNameError && (
          <div className="form-error" style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>Lab name unavailable from Lab Profile.</span>
            <Button variant="secondary" size="sm" onClick={loadLabProfile}>
              <RefreshCw size={14} /> Retry
            </Button>
          </div>
        )}
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        loading={deleteLoading}
        title="Delete Diagnostic Report?"
        message={`Are you sure you want to permanently delete the report file for ${deleteTarget?.patient?.name}?`}
      />

      {/* Phase 4+10 — preview == print markup (ReportPrintView) with unsigned
          banner and QrBlock (qrDataUrl + URL fallback text). */}
      <ReportPreviewModal
        isOpen={previewOpen}
        onClose={() => setPreviewOpen(false)}
        report={activeReport}
        qrDataUrl={previewQr.qrDataUrl}
        verifyUrl={previewQr.verifyUrl || verifyUrl}
        signatures={signatures}
        loading={previewLoading}
        error={previewError}
      />

      <RejectDialog
        isOpen={rejectOpen}
        onClose={() => setRejectOpen(false)}
        report={activeReport}
        onRejected={(rep) => { if (rep?._id) { setActiveReport(rep); fetchReports(); } }}
      />

      {/* Labels from the report screen: bill / case / sample tabs with
          thermal-printer stock sizes and public Code39 barcode endpoints. */}
      <LabelPrintSheet
        isOpen={!!labelTarget}
        onClose={() => setLabelTarget(null)}
        patient={labelTarget?.patient}
        bill={labelTarget?.bill}
        testName={labelTarget?.test ? `${labelTarget.test.name || ''}${labelTarget.test.code ? ` (${labelTarget.test.code})` : ''}` : 'General Findings'}
        caseId={labelTarget?._id || ''}
        caseLabel={labelTarget?.registrationNumber || ''}
        sampleId={labelTarget?.registrationNumber || ''}
      />
    </div>
  );
};

export default TodaysReports;
