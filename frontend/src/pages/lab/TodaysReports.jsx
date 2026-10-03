import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import useClientPagination from '../../hooks/useClientPagination';
import {
  getTodaysReports,
  getPendingLabCases,
  getReportForEntry,
  uploadReport,
  attachReportFile,
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
  PatientPicker,
  AdvancedFilterBar
} from '../../components/common';
import TatCountdown, { getTatInfo, loadTatSettings, isDoneStatus } from '../../components/lab/TatCountdown';
import SignaturePicker from '../../components/lab/SignaturePicker';
import ReportPreviewModal from '../../components/lab/ReportPreviewModal';
import RejectDialog from '../../components/lab/RejectDialog';
import CommentThread from '../../components/lab/CommentThread';
import VerificationTimeline from '../../components/lab/VerificationTimeline';
import LabelPrintSheet from '../../components/lab/LabelPrintSheet';

const emptyRow = () => ({ test: '', testName: '', value: '', unit: '' });

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
  if (report?.bill?.caseType === 'OutsourceLabCase') return 'OUTSOURCE LAB';
  const hay = `${report?.test?.name || ''} ${report?.test?.code || ''}`.toLowerCase();
  if (/usg|ultrasound/.test(hay)) return 'USG';
  if (/x-?ray|radiograph/.test(hay)) return 'XRAY';
  return 'LAB';
};

const isOutsourceBill = (bill) => (
  bill?.caseType === 'OutsourceLabCase'
  || String(bill?.department || '').toUpperCase().includes('OUTSOURCE')
);

/** Prefer report.entryMode (mixed bills); fall back to bill-level modality. */
const isOutsourceWork = (reportOrPending, bill) => {
  const mode = reportOrPending?.entryMode || reportOrPending?.report?.entryMode;
  if (mode === 'outsource') return true;
  if (mode === 'inhouse') return false;
  const b = bill || reportOrPending?.bill || reportOrPending;
  return isOutsourceBill(b);
};

const isOutsourceReport = (report) => isOutsourceWork(report, report?.bill);

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
  // Every pop-up stays React state for rendering but is mirrored to the URL
  // (?upload, ?result, ?entry=<id>, ?send=<id>, ?preview=<id>, ?reject=<id>,
  // ?label=<id>, ?del=<id>) so refresh / share reopens the same view.
  const mirrorModal = (key, isOpen, id) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (isOpen) next.set(key, id ? String(id) : 'open');
        else next.delete(key);
        return next;
      },
      { replace: true }
    );
  };
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
  // 'values' = numeric grid; 'upload' = outsource PDF/image (no Enter value fields)
  const [entryMode, setEntryMode] = useState('values');
  const [entryUploadFile, setEntryUploadFile] = useState(null);
  const [entryUploadError, setEntryUploadError] = useState(null);
  // Tests from getReportForEntry — ensures Edit results shows names even before catalog loads
  const [entryTestOptions, setEntryTestOptions] = useState([]);
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
  const [labProfile, setLabProfile] = useState(null);
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
      if (billRes.success) {
        const incoming = billRes.data.bills || [];
        // Keep bills prefilled from Pending (outsource) that may fall outside last-100.
        setBills((prev) => {
          const extras = (prev || []).filter(
            (b) => !incoming.some((x) => String(x._id) === String(b._id))
          );
          return extras.length ? [...extras, ...incoming] : incoming;
        });
      }
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
      setLabProfile(profile);
      setLabName(profile?.labName || '');
      setLabNameError(!profile?.labName);
    } catch {
      setLabProfile(null);
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
    setFailedDeliveries(getFailedDeliveries());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortOrder, statusFilter]);

  // Heavy catalogs when a modal needs them — not on every worklist filter change.
  useEffect(() => {
    if (uploadOpen || entryOpen || resultOpen) loadUploadOptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uploadOpen, entryOpen, resultOpen]);

  useEffect(() => {
    loadLabProfile();
    loadTemplates();
    loadCredits();
    fetchPending();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pop-up ↔ URL mirror: React state renders; the query string preserves.
  // Each open pop-up sets its param, each close clears it.
  useEffect(() => { mirrorModal('upload', uploadOpen); }, [uploadOpen]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { mirrorModal('result', resultOpen); }, [resultOpen]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { mirrorModal('entry', entryOpen, activeReport?._id); }, [entryOpen, activeReport?._id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { mirrorModal('send', sendOpen, activeReport?._id); }, [sendOpen, activeReport?._id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { mirrorModal('preview', previewOpen, activeReport?._id); }, [previewOpen, activeReport?._id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { mirrorModal('reject', rejectOpen, activeReport?._id); }, [rejectOpen, activeReport?._id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { mirrorModal('label', !!labelTarget, labelTarget?._id); }, [labelTarget]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { mirrorModal('del', !!deleteTarget, deleteTarget?._id); }, [deleteTarget]); // eslint-disable-line react-hooks/exhaustive-deps

  // Dashboard quick action links here with ?upload=true — open the upload modal directly.
  useEffect(() => {
    if (searchParams.get('upload')) {
      setUploadOpen(true);
      setFormErrors({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reopen pop-ups from a shared/reloaded URL once the worklist is loaded.
  useEffect(() => {
    if (!reports.length) return;
    const find = (id) => reports.find((r) => String(r._id) === String(id));
    if (searchParams.get('result') && !resultOpen) setResultOpen(true);
    const entryId = searchParams.get('entry');
    if (entryId && entryId !== 'open' && !entryOpen) { const r = find(entryId); if (r) openEntry(r); }
    const sendId = searchParams.get('send');
    if (sendId && sendId !== 'open' && !sendOpen) { const r = find(sendId); if (r) openSend(r); }
    const previewId = searchParams.get('preview');
    if (previewId && previewId !== 'open' && !previewOpen) { const r = find(previewId); if (r) handleOpenPreview(r); }
    const rejectId = searchParams.get('reject');
    if (rejectId && rejectId !== 'open' && !rejectOpen) { const r = find(rejectId); if (r) { setActiveReport(r); setRejectOpen(true); } }
    const labelId = searchParams.get('label');
    if (labelId && labelId !== 'open' && !labelTarget) { const r = find(labelId); if (r) setLabelTarget(r); }
    const delId = searchParams.get('del');
    if (delId && delId !== 'open' && !deleteTarget) { const r = find(delId); if (r) setDeleteTarget(r); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reports]);

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
        fetchPending();
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
    const pickedBill = bills.find((b) => String(b._id) === String(resultForm.bill));
    if (isOutsourceBill(pickedBill)) {
      setResultOpen(false);
      setFormData({ patient: resultForm.patient, bill: resultForm.bill, test: '', file: null });
      setUploadPatient(resultPatient);
      setFormErrors({});
      setUploadOpen(true);
      return;
    }
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
    if (isOutsourceWork(pendingCase?.report, pendingCase?.bill)) {
      handleUploadPendingOutsource(pendingCase);
      return;
    }
    const billId = pendingCase?.bill?._id || pendingCase?.bill;
    const patientId = pendingCase?.bill?.patient?._id || pendingCase?.bill?.patient;
    if (!billId || !patientId) { alert('Pending case is missing patient/bill linkage'); return; }
    // Existing Registered shell from bill create — open it directly.
    if (pendingCase?.report?._id) {
      setTab('today');
      openEntry({
        ...pendingCase.report,
        patient: pendingCase.bill?.patient,
        bill: pendingCase.bill
      });
      return;
    }
    setResultLoading(true);
    try {
      const entryMode = pendingCase?.report?.entryMode === 'outsource' ? 'outsource' : 'inhouse';
      const res = await createResultReport({ patient: patientId, bill: billId, entryMode });
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

  // Outsource pending → upload PDF/image (no numeric result entry).
  const handleUploadPendingOutsource = (pendingCase) => {
    const bill = pendingCase?.bill || {};
    const patient = bill.patient && typeof bill.patient === 'object' ? bill.patient : null;
    const patientId = patient?._id || bill.patient;
    const reportId = pendingCase?.report?._id;
    if (!bill._id || !patientId) {
      alert('Pending case is missing patient/bill linkage');
      return;
    }
    // Prefer attaching to the Registered outsource shell when present.
    if (reportId) {
      openEntry({
        ...pendingCase.report,
        patient,
        bill,
        entryMode: pendingCase.report?.entryMode || 'outsource'
      });
      return;
    }
    setFormData({ patient: patientId, bill: bill._id, test: '', file: null });
    setUploadPatient(patient);
    setFormErrors({});
    setBills((prev) => {
      const list = Array.isArray(prev) ? prev : [];
      if (list.some((b) => String(b._id) === String(bill._id))) return list;
      return [{ ...bill, patient: patient || bill.patient }, ...list];
    });
    setUploadOpen(true);
  };

  const openEntry = async (report) => {
    setSendResult(null);
    setDeliveryHistory(getDeliveryHistory(report._id));
    setEntryTestOptions([]);
    setEntryUploadFile(null);
    setEntryUploadError(null);
    setSigId('');
    setVerifyUrl('');
    setEntryLoading(true);

    // Resolve bill/tests BEFORE opening the modal so outsource never flashes value fields.
    let nextReport = report;
    let testEntries = [];
    let entryPayload = null;
    try {
      const entry = await getReportForEntry(report._id);
      entryPayload = entry?.data || null;
      const billFromEntry = entryPayload?.bill;
      const patientFromEntry = entryPayload?.patient;
      testEntries = entryPayload?.testEntries || [];
      nextReport = {
        ...report,
        ...(entryPayload?.report || {}),
        bill: billFromEntry || report.bill,
        patient: patientFromEntry || report.patient
      };
    } catch {
      /* list payload only */
    }

    // entryMode from API wins for mixed bills; only fall back to bill-level heuristics.
    const mode = nextReport.entryMode || entryPayload?.entryMode || report.entryMode;
    const outsource = mode === 'outsource'
      || (mode !== 'inhouse' && (
        isOutsourceWork(nextReport, nextReport?.bill)
        || (Array.isArray(nextReport?.bill?.items) && nextReport.bill.items.length > 0
          && nextReport.bill.items.every((it) => it?.itemType === 'Custom' || (!it?.itemId && it?.name)))
        || (testEntries.length > 0 && testEntries.every((t) => !t.testId))
      ));

    setActiveReport(nextReport);
    setTat({
      collected: nextReport.tat?.collected ? String(nextReport.tat.collected).slice(0, 10) : '',
      received: nextReport.tat?.received ? String(nextReport.tat.received).slice(0, 10) : ''
    });
    loadVerifyUrl(nextReport._id);

    if (outsource) {
      setEntryMode('upload');
      setRows([]);
      setEntryOpen(true);
      setEntryLoading(false);
      return;
    }

    setEntryMode('values');
    if (testEntries.length) {
      setEntryTestOptions(testEntries.map((te) => ({
        _id: te.testId ? String(te.testId) : `custom:${te.testName}`,
        name: te.testName || 'Test',
        code: te.testCode || '',
        unit: te.unit || ''
      })));
      setRows(testEntries.map((testEntry) => ({
        test: testEntry.testId ? String(testEntry.testId) : `custom:${testEntry.testName}`,
        testName: testEntry.testName || '',
        value: testEntry.existingValue || '',
        unit: testEntry.existingUnit || testEntry.unit || ''
      })));
    } else if (report.results?.length) {
      setEntryTestOptions(report.results.map((r, i) => ({
        _id: String(r.test?._id || r.test || `saved:${i}`),
        name: r.testName || r.test?.name || `Test ${i + 1}`,
        code: r.test?.code || '',
        unit: r.unit || ''
      })));
      setRows(report.results.map((r) => ({
        test: r.test?._id || r.test || '',
        testName: r.testName || r.test?.name || '',
        value: r.value || '',
        unit: r.unit || ''
      })));
    } else {
      setRows([emptyRow()]);
    }
    setEntryOpen(true);
    setEntryLoading(false);
  };

  const handleEntryUploadSubmit = async () => {
    if (!activeReport?._id) return;
    if (!entryUploadFile) {
      setEntryUploadError('Please select a PDF or image report file.');
      return;
    }
    setEntryLoading(true);
    setEntryUploadError(null);
    try {
      const payload = new FormData();
      payload.append('file', entryUploadFile);
      const res = await attachReportFile(activeReport._id, payload);
      if (res?.success) {
        setEntryOpen(false);
        setEntryUploadFile(null);
        fetchReports();
        fetchPending();
      } else {
        setEntryUploadError(res?.message || 'Upload failed.');
      }
    } catch (err) {
      setEntryUploadError(getApiErrorMessage(err, 'Failed to upload report file.'));
    } finally {
      setEntryLoading(false);
    }
  };

  // Merge entry-resolved tests with catalog so Select always has labels for row IDs.
  const entrySelectOptions = (() => {
    const byId = new Map();
    for (const t of entryTestOptions) {
      if (t?._id) byId.set(String(t._id), { value: String(t._id), label: t.code ? `${t.name} (${t.code})` : t.name });
    }
    for (const t of tests) {
      const id = String(t._id);
      if (!byId.has(id)) byId.set(id, { value: id, label: `${t.name}${t.code ? ` (${t.code})` : ''}` });
    }
    // Ensure every row's current value appears even if missing from both lists
    for (const row of rows) {
      const id = row.test != null && row.test !== '' ? String(row.test) : '';
      if (id && !byId.has(id)) {
        byId.set(id, { value: id, label: row.testName || id });
      }
    }
    return [...byId.values()];
  })();

  const handleSaveResults = async () => {
    const payload = rows
      .filter((r) => r.test && String(r.value) !== '')
      .map((r) => {
        const isCustom = String(r.test).startsWith('custom:');
        return {
          ...(isCustom ? {} : { test: r.test }),
          testName: r.testName || (isCustom ? String(r.test).slice('custom:'.length) : undefined),
          value: r.value,
          unit: r.unit
        };
      });
    if (!payload.length) { alert('Add at least one result row'); return; }
    setEntryLoading(true);
    try {
      const res = await saveReportResults(activeReport._id, payload);
      if (res.success) {
        setActiveReport(res.data);
        setRows(res.data.results.map((r) => ({
          test: r.test?._id || r.test || (r.testName ? `custom:${r.testName}` : ''),
          testName: r.testName || r.test?.name || '',
          value: r.value || '',
          unit: r.unit || ''
        })));
        fetchReports();
        fetchPending();
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
      if (res.success) { setActiveReport(res.data); fetchReports(); fetchPending(); }
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
      await printReportPdf(id);
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
    let items = pendingCase?.bill?.items;
    if (!Array.isArray(items) || !items.length) return '—';
    const mode = pendingCase?.report?.entryMode;
    if (mode === 'inhouse') {
      items = items.filter((i) => ['Test', 'TestPackage', 'TestPanel'].includes(i?.itemType) && i?.itemId);
    } else if (mode === 'outsource') {
      items = items.filter((i) => i?.itemType === 'Custom' || (!i?.itemId && i?.name));
    }
    if (!items.length) {
      return mode === 'outsource' ? 'Outsource report' : mode === 'inhouse' ? 'In-house tests' : '—';
    }
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
        return (
          <AdvancedFilterBar
            showSearchButton={false}
            showClearButton={!!(statusFilter || search || dept !== 'All' || tab !== 'today' || sortOrder !== 'Recent')}
            onClear={() => {
              setStatusFilter('');
              setSearch('');
              setDept('All');
              setTab('today');
              setSortOrder('Recent');
              pg.reset();
              pgPending.reset();
            }}
            trailing={<span>Reports for today · <a href="/lab/search">Search</a></span>}
            values={{ status: statusFilter || 'All', sort: sortOrder, tab, dept, search }}
            onChange={(key, value) => {
              if (key === 'status') { setStatusFilter(value === 'All' ? '' : value); pg.reset(); }
              else if (key === 'sort') setSortOrder(value);
              else if (key === 'tab') { setTab(value); pg.reset(); pgPending.reset(); }
              else if (key === 'dept') { setDept(value); pg.reset(); }
              else if (key === 'search') { setSearch(value); pg.reset(); }
            }}
            fields={[
              {
                key: 'status',
                type: 'segmented',
                options: [
                  { value: 'All', label: `All ${reports.length}` },
                  { value: 'Registered', label: `Registered ${count('Registered')}` },
                  { value: 'Received', label: `Received ${count('Received')}` },
                  { value: 'Reported', label: `Reported ${count('Reported')}` },
                  { value: 'Signed', label: `Signed ${count('Signed')}` },
                  { value: 'Completed', label: `Completed ${count('Completed')}` }
                ]
              },
              {
                key: 'tab',
                type: 'segmented',
                options: [
                  { value: 'today', label: `Today (${filteredReports.length})` },
                  { value: 'due', label: `Due (${dueReports.length})` },
                  { value: 'pending', label: `Pending (${pendingCases.length})` }
                ]
              },
              {
                key: 'dept',
                label: 'Department',
                type: 'select',
                placeholder: '',
                options: (deptOptions || []).map((d) => ({ value: d, label: d }))
              },
              {
                key: 'sort',
                label: 'Sort',
                type: 'select',
                size: 'sm',
                placeholder: '',
                options: [
                  { value: 'Recent', label: 'Recent' },
                  { value: 'Oldest', label: 'Oldest' },
                  { value: 'Due', label: 'Due first' }
                ]
              },
              { key: 'search', label: 'Search', type: 'search', size: 'lg', placeholder: 'Patient / reg no / bill / test…' }
            ]}
          />
        );
      })()}

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
            headers={['Patient', 'Reg No', 'Bill Number', 'Type', 'Items', 'Report Status', 'Actions']}
            data={pgPending.paged}
            loading={pendingLoading}
            emptyMessage="No pending samples — every lab / outsource bill already has a report."
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
              const outsource = isOutsourceWork(pendingCase?.report, bill);
              const modeLabel = pendingCase?.report?.entryMode === 'outsource'
                ? 'Outsource'
                : pendingCase?.report?.entryMode === 'inhouse'
                  ? 'In-house'
                  : (outsource ? 'Outsource' : 'In-house');
              const rowKey = pendingCase?.report?._id
                ? `${bill._id}-${pendingCase.report._id}`
                : `${bill._id}-${modeLabel}`;
              return (
                <tr key={rowKey}>
                  <td style={{ fontWeight: '600' }}>{patient?.name || 'Walk-in Patient'}</td>
                  <td>{patient?.registrationNumber || '—'}</td>
                  <td>{bill?.billNumber || 'N/A'}</td>
                  <td>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: outsource ? 'var(--color-primary)' : 'var(--color-text-muted)' }}>
                      {modeLabel}
                    </span>
                  </td>
                  <td style={{ maxWidth: '220px' }}>{pendingItemsLabel(pendingCase)}</td>
                  <td>{pendingCase?.report?.status || 'Pending'}</td>
                  <td>
                    {outsource ? (
                      <button
                        className="btn btn-primary"
                        style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                        onClick={() => handleUploadPendingOutsource(pendingCase)}
                        disabled={submitLoading || entryLoading}
                      >
                        <Plus size={14} /> Upload report
                      </button>
                    ) : (
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                        onClick={() => handleStartPendingEntry(pendingCase)}
                        disabled={resultLoading || entryLoading}
                      >
                        <FileEdit size={14} /> Enter values
                      </button>
                    )}
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
                  {['Signed', 'Verified', 'Completed'].includes(report.status) ? (
                    <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>Submitted</span>
                  ) : isOutsourceReport(report) ? (
                    <button className="btn btn-primary" style={{ padding: '4px 8px', fontSize: '0.75rem', whiteSpace: 'nowrap' }} onClick={() => openEntry(report)}>
                      <Plus size={14} /> Upload report
                    </button>
                  ) : (
                    <button className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '0.75rem', whiteSpace: 'nowrap' }} onClick={() => openEntry(report)}>
                      <FileEdit size={14} /> {report.status === 'Reported' ? 'Edit results' : 'Enter results'}
                    </button>
                  )}
                  {/* Phase 4 — in-app preview (shared print layout); PDF/Print
                      inside the modal use printReportPdf/downloadReportPdf. */}
                  <button className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '0.75rem' }} onClick={() => handleOpenPreview(report)} title="Preview">
                    <Eye size={14} />
                  </button>
                  <button className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '0.75rem' }} onClick={() => handlePrintPdf(report._id)} disabled={printingId === report._id} title={printingId === report._id ? 'Printing…' : 'Print the server-rendered PDF'}>
                    <Printer size={14} />
                  </button>
                  <button className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '0.75rem' }} onClick={() => downloadReportPdf(report._id)} title="Download PDF">
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
            onChange={(e) => setFormData(prev => ({ ...prev, bill: e.target.value, test: '' }))}
            options={bills.filter(b => b.patient?._id === formData.patient || String(b.patient) === String(formData.patient)).map(b => ({
              value: b._id,
              label: `${b.billNumber} · ${isOutsourceBill(b) ? 'Outsource' : (b.department || 'LAB')}${b.totalAmount != null ? ` (${formatCurrency(b.totalAmount)})` : ''}`
            }))}
            error={formErrors.bill}
            required
            placeholder="Select Bill (Choose patient first)"
            disabled={!formData.patient}
          />
          {(() => {
            const selectedBill = bills.find((b) => String(b._id) === String(formData.bill));
            if (isOutsourceBill(selectedBill)) {
              return (
                <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
                  Outsource bill — upload the external lab PDF or image below. No in-lab result entry is required.
                </p>
              );
            }
            return (
              <Select
                label="Specific Test (Optional)"
                value={formData.test}
                onChange={(e) => setFormData(prev => ({ ...prev, test: e.target.value }))}
                options={tests.map(t => ({ value: t._id, label: `${t.name} (${t.code})` }))}
                placeholder="Link to generic invoice total"
              />
            );
          })()}
          <div style={{ marginTop: '0.5rem' }}>
            <FileUploader
              onChange={handleFileChange}
              value={formData.file}
              label="Select PDF Report or Scan / Image file"
              accept=".pdf,.jpg,.jpeg,.png"
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

      {/* Enter results / outsource upload modal */}
      <Modal
        isOpen={entryOpen}
        onClose={() => !entryLoading && setEntryOpen(false)}
        title={
          entryMode === 'upload'
            ? `Upload Report — ${activeReport?.registrationNumber || ''}`
            : `Enter Results — ${activeReport?.registrationNumber || ''}`
        }
        size="lg"
        footer={
          entryMode === 'upload' ? (
            <>
              <Button variant="secondary" onClick={() => setEntryOpen(false)} disabled={entryLoading}>Close</Button>
              <Button variant="primary" onClick={handleEntryUploadSubmit} loading={entryLoading}>
                <Plus size={14} /> Upload File
              </Button>
            </>
          ) : (
            <>
              <Button variant="secondary" onClick={() => setEntryOpen(false)}>Close</Button>
              <Button variant="secondary" onClick={() => handleOpenPreview()} disabled={!activeReport?._id || previewLoading}><Eye size={14} /> Preview</Button>
              <Button variant="secondary" onClick={() => activeReport && handlePrintPdf(activeReport._id)} disabled={!activeReport?._id || !!printingId} title="Print the server-rendered PDF (GET /api/reports/:id/pdf)"><Printer size={14} /> {printingId ? 'Printing…' : 'Print'}</Button>
              <Button variant="secondary" onClick={() => activeReport && downloadReportPdf(activeReport._id)}><FileDown size={14} /> PDF</Button>
              <Button variant="secondary" onClick={() => openSend(activeReport)}><Send size={14} /> Send</Button>
              {['Signed', 'Verified', 'Completed'].includes(activeReport?.status) ? (
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', alignSelf: 'center' }}>Submitted — no further edits</span>
              ) : (
                <Button variant="primary" onClick={handleSaveResults} loading={entryLoading}>Save Results</Button>
              )}
            </>
          )
        }
      >
        {entryMode === 'upload' ? (
          <div className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
            {entryUploadError ? <div className="form-error">{entryUploadError}</div> : null}
            <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
              Outsource case — upload the external lab PDF or scan/image. No numeric values are required.
            </p>
            {(activeReport?.bill?.items || []).length > 0 && (
              <p style={{ margin: 0, fontSize: 'var(--font-size-sm)' }}>
                <strong>Tests:</strong>{' '}
                {(activeReport.bill.items || []).map((i) => i.name).filter(Boolean).join(', ') || '—'}
              </p>
            )}
            {activeReport?.fileUrl ? (
              <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--color-success, #166534)' }}>
                A file is already attached. Uploading again will replace it.
              </p>
            ) : null}
            <FileUploader
              onChange={(file) => { setEntryUploadFile(file); setEntryUploadError(null); }}
              value={entryUploadFile}
              label="Select PDF Report or Scan / Image file"
              accept=".pdf,.jpg,.jpeg,.png"
            />
          </div>
        ) : (
          <>
        {rows.map((row, i) => (
          <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
            <Select
              value={row.test != null ? String(row.test) : ''}
              onChange={(e) => {
                const v = e.target.value;
                const fromEntry = entryTestOptions.find((t) => String(t._id) === v);
                const fromCatalog = tests.find((t) => String(t._id) === v);
                setRows((prev) => prev.map((r, j) => (j === i ? {
                  ...r,
                  test: v,
                  testName: fromEntry?.name || fromCatalog?.name || r.testName || '',
                  unit: fromEntry?.unit || fromCatalog?.unit || r.unit
                } : r)));
              }}
              options={entrySelectOptions}
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
          </>
        )}
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
        profile={labProfile}
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
