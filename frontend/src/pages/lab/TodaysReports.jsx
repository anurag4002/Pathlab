import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getReports, uploadReport, deleteReport, createResultReport, saveReportResults, signReport, updateReportTat } from '../../services/reportService';
import { getPatients } from '../../services/patientService';
import { getBills } from '../../services/billService';
import { getTests } from '../../services/testService';
import { getSignatures, getLabProfile } from '../../services/setupService';
import { sendMessage, getTemplates, getCredits } from '../../services/notifyService';
import { downloadReportPdf, fetchReportQr } from '../../services/publicService';
import downloadFile from '../../utils/downloadFile';
import formatCurrency from '../../utils/formatCurrency';
import formatDate from '../../utils/formatDate';
import { Plus, Download, Trash2, FileEdit, FileDown, QrCode, Send, PenLine, Eye, RefreshCw } from 'lucide-react';
import { DataTable, PageHeader, Button, Modal, Select, Input, FileUploader, ConfirmDialog, StatusBadge } from '../../components/common';
import { formatReportTat } from '../../utils/reportTat';

const emptyRow = () => ({ test: '', value: '', unit: '' });

/* Local API error mapper (same mapping as the other lab screens); the 402
   case covers the delivery endpoint's credit/provider failures. Surfaces
   only the backend's user-facing `message` field, never stack traces. */
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
    if (status === 402) return 'Message not sent — check delivery credits and Lab Profile channel settings.';
    if (status === 422) return 'The submitted data is invalid.';
    if (status >= 500) return 'Server error. Please try again.';
    return fallback;
  }
  if (err?.code === 'ECONNABORTED') return 'The request timed out. Please try again.';
  if (err?.request) return 'Network error. Please check your connection and try again.';
  return err?.message || fallback;
};

const TodaysReports = () => {
  const navigate = useNavigate();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);

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

  const fetchReports = async () => {
    setLoading(true);
    try {
      const res = await getReports({ registrationNumber: '' });
      if (res.success) setReports(res.data.reports);
    } catch (err) {
      console.error('Failed to fetch reports', err);
    } finally {
      setLoading(false);
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
    loadLabProfile();
    loadTemplates();
    loadCredits();
  }, []);

  const handleOpenUpload = () => {
    setFormData({ patient: '', bill: '', test: '', file: null });
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
        fetchReports();
        openEntry(res.data);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to register result entry');
    } finally {
      setResultLoading(false);
    }
  };

  const openEntry = (report) => {
    setActiveReport(report);
    setRows(report.results?.length ? report.results.map((r) => ({ test: r.test?._id || r.test || '', value: r.value || '', unit: r.unit || '' })) : [emptyRow()]);
    setTat({ collected: report.tat?.collected ? String(report.tat.collected).slice(0, 10) : '', received: report.tat?.received ? String(report.tat.received).slice(0, 10) : '' });
    setSigId('');
    setEntryOpen(true);
    loadVerifyUrl(report._id);
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

  const handleSign = async () => {
    if (!sigId) { alert('Select a signature'); return; }
    try {
      const res = await signReport(activeReport._id, sigId);
      if (res.success) { setActiveReport(res.data); fetchReports(); }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to sign report');
    }
  };

  // Opens the delivery modal for one specific report (row action or entry
  // modal), so a send can only ever target the report it was opened for.
  const openSend = (report) => {
    if (!report) return;
    setActiveReport(report);
    setSendForm({ channel: 'sms', phone: report?.patient?.phone || '' });
    setSendError(null);
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

  const handleSend = async () => {
    if (sendLoading) return;
    const to = sendForm.phone.trim();
    if (!to) { setSendError('Enter the patient phone number.'); return; }
    if (verifyLoading) return;
    if (!verifyUrl) { setSendError('Secure report link unavailable — retry loading it.'); return; }
    if (!labName) { setSendError('Lab profile not loaded — retry loading it.'); return; }
    if (!selectedTemplate) { setSendError('No active template for this channel can be filled with this report’s data.'); return; }
    setSendError(null);
    setSendLoading(true);
    try {
      // Channels are limited to what the backend can resolve for a patient:
      // the Patient API exposes only `phone` (no email field), so the Email
      // action stays visible but never functional.
      const res = await sendMessage({
        channel: sendForm.channel,
        templateKey: selectedTemplate.key,
        to,
        vars: availableVars
      });
      if (res.success) { setSendOpen(false); alert('Message sent'); loadCredits(); }
    } catch (err) {
      setSendError(getApiErrorMessage(err, 'Failed to send message.'));
    } finally {
      setSendLoading(false);
    }
  };

  const billOptions = (patientId) => bills.filter(b => !patientId || b.patient?._id === patientId || b.patient === patientId).map(b => ({ value: b._id, label: `${b.billNumber} (${formatCurrency(b.totalAmount)})` }));

  return (
    <div>
      <PageHeader
        title="Laboratory Reports Completed"
        subtitle="View diagnostic PDF findings completed today and upload clinical reports"
        action={
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button variant="secondary" onClick={() => { setResultForm({ patient: '', bill: '' }); setResultOpen(true); }}>
              <FileEdit size={16} /> New result entry
            </Button>
            <Button variant="primary" onClick={handleOpenUpload}>
              <Plus size={16} /> Upload Report
            </Button>
          </div>
        }
      />

      <DataTable
        headers={['Patient Reg No', 'Patient Name', 'Bill Number', 'Test', 'Status', 'Completed Date', 'TAT', 'Uploader', 'Actions']}
        data={reports}
        loading={loading}
        emptyMessage="No laboratory reports recorded today."
        renderRow={(report) => (
          <tr key={report._id}>
            <td style={{ fontWeight: '600' }}>{report.registrationNumber}</td>
            <td style={{ fontWeight: '600' }}>{report.patient?.name || 'Walk-in Patient'}</td>
            <td>{report.bill?.billNumber || 'N/A'}</td>
            <td>{report.test ? `${report.test.name} (${report.test.code})` : 'General Findings'}</td>
            <td>{report.status ? <StatusBadge status={report.status} /> : '—'}</td>
            <td>{formatDate(report.reportDate)}</td>
            <td>{formatReportTat(report)}</td>
            <td>{report.uploadedBy?.name || 'N/A'}</td>
            <td>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '0.75rem' }} onClick={() => navigate(`/lab/reports/${report._id}/preview`)}>
                  <Eye size={14} /> Preview
                </button>
                <button className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '0.75rem' }} onClick={() => openEntry(report)}>
                  <FileEdit size={14} /> Enter results
                </button>
                <button className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '0.75rem' }} onClick={() => downloadReportPdf(report._id, true)}>
                  <FileDown size={14} /> PDF
                </button>
                <button
                  className="btn btn-secondary"
                  style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                  onClick={() => downloadFile(`/${report.fileUrl}`, `report_${report.registrationNumber}.pdf`)}
                >
                  <Download size={14} /> Download
                </button>
                <button className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '0.75rem' }} onClick={() => openSend(report)}>
                  <Send size={14} /> Send
                </button>
                <button className="btn btn-danger" style={{ padding: '4px 8px', fontSize: '0.75rem' }} onClick={() => setDeleteTarget(report)}>
                  <Trash2 size={14} />
                </button>
              </div>
            </td>
          </tr>
        )}
      />

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
          <Select
            label="Patient Profile"
            value={formData.patient}
            onChange={(e) => setFormData(prev => ({ ...prev, patient: e.target.value }))}
            options={patients.map(p => ({ value: p._id, label: `${p.name} (${p.registrationNumber})` }))}
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
          <Select
            label="Patient Profile"
            value={resultForm.patient}
            onChange={(e) => setResultForm(prev => ({ ...prev, patient: e.target.value, bill: '' }))}
            options={patients.map(p => ({ value: p._id, label: `${p.name} (${p.registrationNumber})` }))}
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

        <div style={{ display: 'flex', gap: '8px', marginTop: '12px', alignItems: 'flex-end' }}>
          <Select
            label="Signature"
            value={sigId}
            onChange={(e) => setSigId(e.target.value)}
            options={signatures.map(s => ({ value: s._id, label: `${s.name}${s.title ? ` (${s.title})` : ''}` }))}
            placeholder="Select signature"
            style={{ flex: 1 }}
          />
          <Button variant="secondary" size="sm" onClick={handleSign}><PenLine size={14} /> Sign</Button>
        </div>
        {verifyUrl && <p style={{ fontSize: '0.75rem', marginTop: '8px', wordBreak: 'break-all' }}><QrCode size={12} /> Verify: {verifyUrl}</p>}
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
    </div>
  );
};

export default TodaysReports;
