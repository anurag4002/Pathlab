import React, { useState, useEffect } from 'react';
import { getReports, uploadReport, deleteReport, createResultReport, saveReportResults, signReport, updateReportTat } from '../../services/reportService';
import { getPatients } from '../../services/patientService';
import { getBills } from '../../services/billService';
import { getTests } from '../../services/testService';
import { getSignatures } from '../../services/setupService';
import { sendMessage } from '../../services/notifyService';
import { downloadReportPdf, fetchReportQr } from '../../services/publicService';
import downloadFile from '../../utils/downloadFile';
import formatCurrency from '../../utils/formatCurrency';
import formatDate from '../../utils/formatDate';
import { Plus, Download, Trash2, FileEdit, FileDown, QrCode, Send, PenLine } from 'lucide-react';
import { DataTable, PageHeader, Button, Modal, Select, Input, FileUploader, ConfirmDialog } from '../../components/common';

const emptyRow = () => ({ test: '', value: '', unit: '' });

const TodaysReports = () => {
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
  const [sendForm, setSendForm] = useState({ channel: 'sms', phone: '' });
  const [sendLoading, setSendLoading] = useState(false);

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

  useEffect(() => {
    fetchReports();
    loadUploadOptions();
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

  const openEntry = async (report) => {
    setActiveReport(report);
    setRows(report.results?.length ? report.results.map((r) => ({ test: r.test?._id || r.test || '', value: r.value || '', unit: r.unit || '' })) : [emptyRow()]);
    setTat({ collected: report.tat?.collected ? String(report.tat.collected).slice(0, 10) : '', received: report.tat?.received ? String(report.tat.received).slice(0, 10) : '' });
    setSigId('');
    setVerifyUrl('');
    setEntryOpen(true);
    try {
      const qr = await fetchReportQr(report._id);
      if (qr?.success) setVerifyUrl(qr.data.verifyUrl);
    } catch { /* ignore */ }
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

  const handleSend = async () => {
    if (!sendForm.phone) { alert('Enter phone/email'); return; }
    setSendLoading(true);
    try {
      const templateKey = sendForm.channel === 'whatsapp' ? 'report-ready-wa' : 'report-ready';
      const res = await sendMessage({
        channel: sendForm.channel,
        templateKey,
        to: sendForm.phone,
        vars: { name: activeReport.patient?.name || '', regNo: activeReport.registrationNumber || '', url: verifyUrl, lab: 'Pure Path Lab' }
      });
      if (res.success) { setSendOpen(false); alert('Message sent'); }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to send message');
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
        headers={['Patient Reg No', 'Patient Name', 'Bill Number', 'Test', 'Completed Date', 'Uploader', 'Actions']}
        data={reports}
        loading={loading}
        emptyMessage="No laboratory reports recorded today."
        renderRow={(report) => (
          <tr key={report._id}>
            <td style={{ fontWeight: '600' }}>{report.registrationNumber}</td>
            <td style={{ fontWeight: '600' }}>{report.patient?.name || 'Walk-in Patient'}</td>
            <td>{report.bill?.billNumber || 'N/A'}</td>
            <td>{report.test ? `${report.test.name} (${report.test.code})` : 'General Findings'}</td>
            <td>{formatDate(report.reportDate)}</td>
            <td>{report.uploadedBy?.name || 'N/A'}</td>
            <td>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
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
            <Button variant="secondary" onClick={() => { setSendForm(f => ({ ...f, phone: activeReport?.patient?.phone || '' })); setSendOpen(true); }}><Send size={14} /> Send</Button>
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

      {/* Send modal */}
      <Modal
        isOpen={sendOpen}
        onClose={() => setSendOpen(false)}
        title="Send Report Notification"
        footer={
          <>
            <Button variant="secondary" onClick={() => setSendOpen(false)} disabled={sendLoading}>Cancel</Button>
            <Button variant="primary" onClick={handleSend} loading={sendLoading}><Send size={14} /> Send</Button>
          </>
        }
      >
        <div className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
          <Select
            label="Channel"
            value={sendForm.channel}
            onChange={(e) => setSendForm(p => ({ ...p, channel: e.target.value }))}
            options={[{ value: 'sms', label: 'SMS' }, { value: 'whatsapp', label: 'WhatsApp' }, { value: 'email', label: 'Email' }]}
            required
          />
          <Input label="Phone / Email" value={sendForm.phone} onChange={(e) => setSendForm(p => ({ ...p, phone: e.target.value }))} placeholder="98XXXXXXXX / user@mail.com" required />
        </div>
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
