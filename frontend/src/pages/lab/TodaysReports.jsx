import React, { useState, useEffect } from 'react';
import { getReports, uploadReport, deleteReport } from '../../services/reportService';
import { getPatients } from '../../services/patientService';
import { getBills } from '../../services/billService';
import { getTests } from '../../services/testService';
import downloadFile from '../../utils/downloadFile';
import formatDate from '../../utils/formatDate';
import { Plus, Download, Trash2 } from 'lucide-react';
import { DataTable, PageHeader, Button, Modal, Select, FileUploader, ConfirmDialog } from '../../components/common';

const TodaysReports = () => {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);

  // Upload Form States
  const [uploadOpen, setUploadOpen] = useState(false);
  const [patients, setPatients] = useState([]);
  const [bills, setBills] = useState([]);
  const [tests, setTests] = useState([]);
  const [formData, setFormData] = useState({ patient: '', bill: '', test: '', file: null });
  const [formErrors, setFormErrors] = useState({});
  const [submitLoading, setSubmitLoading] = useState(false);

  // Delete State
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchReports = async () => {
    setLoading(true);
    try {
      // Fetch today's reports
      const res = await getReports({
        registrationNumber: '' // can search empty
      });
      if (res.success) {
        // filter today's reports in JS for simplicity or fetch via backend.
        // The backend returns reports sorted by date, which is fine
        setReports(res.data.reports);
      }
    } catch (err) {
      console.error('Failed to fetch reports', err);
    } finally {
      setLoading(false);
    }
  };

  const loadUploadOptions = async () => {
    try {
      const [patRes, billRes, testRes] = await Promise.all([
        getPatients({ limit: 100 }),
        getBills({ limit: 100 }),
        getTests({ status: 'Active' })
      ]);
      if (patRes.success) setPatients(patRes.data.patients);
      if (billRes.success) setBills(billRes.data.bills);
      if (testRes.success) setTests(testRes.data);
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

  return (
    <div>
      <PageHeader
        title="Laboratory Reports Completed"
        subtitle="View diagnostic PDF findings completed today and upload clinical reports"
        action={
          <Button variant="primary" onClick={handleOpenUpload}>
            <Plus size={16} /> Upload Report
          </Button>
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
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  className="btn btn-secondary"
                  style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                  onClick={() => downloadFile(`/${report.fileUrl}`, `report_${report.registrationNumber}.pdf`)}
                >
                  <Download size={14} /> Download
                </button>
                <button
                  className="btn btn-danger"
                  style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                  onClick={() => setDeleteTarget(report)}
                >
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
