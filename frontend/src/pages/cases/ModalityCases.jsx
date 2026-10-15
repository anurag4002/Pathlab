import React, { useState, useEffect } from 'react';
import { getModalityCases, createModalityCase, updateModalityCase, deleteModalityCase, uploadModalityReport } from '../../services/modalityService';
import { useSearchParams } from 'react-router-dom';
import { downloadBlob, printPdfPath } from '../../services/publicService';
import ServerPdfPreview from '../../components/lab/ServerPdfPreview';
import { DataTable, PageHeader, Button, Modal, Input, StatusBadge, ConfirmDialog, PatientPicker, AdvancedFilterBar, FileUploader } from '../../components/common';
import useAuth from '../../hooks/useAuth';
import usePagination from '../../hooks/usePagination';
import useDebounce from '../../hooks/useDebounce';
import { Plus, ArrowRight, Trash2, Upload, Eye, Printer, Download } from 'lucide-react';
import formatDate from '../../utils/formatDate';

const TABS = ['CT', 'MRI', 'ECG', 'OPG', 'EEG', 'MAMMOGRAPHY', 'CARDIOLOGY', 'EPS', 'OUTSOURCE'];
const NEXT = { Registered: 'InProgress', InProgress: 'Reported', Reported: 'Signed', Signed: 'Signed' };

const ModalityCases = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'Admin';
  const [searchParams, setSearchParams] = useSearchParams();
  const [modality, setModality] = useState(() => TABS.includes(searchParams.get('modality')) ? searchParams.get('modality') : 'CT');
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({ patient: '', procedure: '', findings: '', impression: '' });
  const [pickedPatient, setPickedPatient] = useState(null);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [uploadTarget, setUploadTarget] = useState(null);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [previewTarget, setPreviewTarget] = useState(null);
  const [printingId, setPrintingId] = useState('');
  const [notice, setNotice] = useState('');

  const handleUpload = async () => {
    if (!uploadFile) { setUploadError('Choose a PDF, JPG or PNG ECG report.'); return; }
    if (uploadFile.size > 10 * 1024 * 1024) { setUploadError('The ECG report must be 10 MB or smaller.'); return; }
    setUploadBusy(true); setUploadError('');
    try {
      await uploadModalityReport(uploadTarget._id, uploadFile);
      setUploadTarget(null); setUploadFile(null); setNotice('ECG report uploaded. Print uses the uploaded report without a letterhead.');
      fetchCases();
    } catch (error) { setUploadError(error.response?.data?.message || 'Could not upload the ECG report. Please try again.'); }
    finally { setUploadBusy(false); }
  };
  const printEcg = async target => {
    setPrintingId(target._id); setNotice('');
    try { await printPdfPath(`/modality/${target._id}/pdf`); }
    catch (error) { setNotice(error.response?.data?.message || 'Could not print the ECG report.'); }
    finally { setPrintingId(''); }
  };

  // Server-side search + pagination (GET /api/modality/cases).
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 500);
  const { page, limit, goToPage, setLimit } = usePagination(1, 10);
  const [paginationInfo, setPaginationInfo] = useState({ total: 0, pages: 0 });

  const fetchCases = async () => {
    setLoading(true);
    try {
      const res = await getModalityCases({
        modality,
        search: debouncedSearch.trim() || undefined,
        page,
        limit,
      });
      if (res.success) {
        setCases(res.data.cases);
        setPaginationInfo(res.data.pagination || { total: 0, pages: 0 });
      }
    } catch (err) {
      console.error('Failed to load modality cases', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCases(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modality, debouncedSearch, page, limit]);

  const handleCreate = async () => {
    if (!form.patient) { alert('Select a patient'); return; }
    setSubmitLoading(true);
    try {
      const res = await createModalityCase({ ...form, modality });
      if (res.success) {
        setFormOpen(false);
        setForm({ patient: '', procedure: '', findings: '', impression: '' });
        fetchCases();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to create case');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleAdvance = async (c) => {
    try {
      const res = await updateModalityCase(c._id, { status: NEXT[c.status] || 'InProgress' });
      if (res.success) fetchCases();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update status');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      const res = await deleteModalityCase(deleteTarget._id);
      if (res.success) { setDeleteTarget(null); fetchCases(); }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete case');
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div>
      <PageHeader
        title={`${modality} Cases`}
        subtitle="Modality case registration, findings and status tracking"
        action={<Button variant="primary" onClick={() => setFormOpen(true)}><Plus size={16} /> New {modality} Case</Button>}
      />
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
        {TABS.map((m) => (
          <Button key={m} variant={m === modality ? 'primary' : 'secondary'} size="sm" onClick={() => { setModality(m); setSearchParams({ modality: m }); setNotice(''); goToPage(1); }}>{m}</Button>
        ))}
      </div>
      {notice && <p role="status">{notice}</p>}
      <AdvancedFilterBar
        showSearchButton={false}
        showClearButton={!!search}
        onClear={() => { setSearch(''); goToPage(1); }}
        values={{ search }}
        onChange={(key, value) => {
          if (key === 'search') { setSearch(value); goToPage(1); }
        }}
        fields={[
          { key: 'search', label: 'Search', type: 'text', size: 'lg', placeholder: 'Search procedure…' }
        ]}
      />
      <DataTable
        headers={['Date', 'Patient', 'Procedure', 'Findings', 'Impression', 'Status', 'Actions']}
        data={cases}
        loading={loading}
        emptyMessage={`No ${modality} cases found.`}
        pagination={{
          total: paginationInfo.total,
          page,
          limit,
          pages: paginationInfo.pages,
          onPageChange: goToPage,
          onLimitChange: setLimit,
        }}
        renderRow={(c) => (
          <tr key={c._id}>
            <td>{formatDate(c.caseDate)}</td>
            <td style={{ fontWeight: 600 }}>{c.patient?.name} <span style={{ fontWeight: 400, fontSize: '0.75rem' }}>({c.patient?.registrationNumber})</span></td>
            <td style={{ maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={c.procedure || ''}>{c.procedure || '—'}</td>
            <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={c.findings || ''}>{c.findings || '—'}</td>
            <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={c.impression || ''}>{c.impression || '—'}</td>
            <td><StatusBadge status={c.status} /></td>
            <td>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {c.modality === 'ECG' && <>
                  {c.status !== 'Signed' && <Button variant="secondary" size="sm" icon={<Upload size={14} />}
                    onClick={() => { setUploadTarget(c); setUploadFile(null); setUploadError(''); }}>{c.reportFile?.size ? 'Replace report' : 'Upload report'}</Button>}
                  {!!c.reportFile?.size && <>
                    <Button variant="secondary" size="sm" icon={<Eye size={14} />} onClick={() => setPreviewTarget(c)}>Preview</Button>
                    <Button variant="secondary" size="sm" icon={<Printer size={14} />} disabled={!!printingId} onClick={() => printEcg(c)}>{printingId === c._id ? 'Printing…' : 'Print'}</Button>
                    <Button variant="secondary" size="sm" icon={<Download size={14} />} onClick={() => downloadBlob(`/modality/${c._id}/file`, c.reportFile.name || 'ECG-report.pdf').catch(() => setNotice('Could not download the ECG report.'))}>Download report</Button>
                  </>}
                </>}
                {c.status !== 'Signed' && (
                  <Button variant="secondary" size="sm" onClick={() => handleAdvance(c)} icon={<ArrowRight size={14} />}>{NEXT[c.status] || 'Advance'}</Button>
                )}
                {isAdmin && (
                  <Button variant="danger" size="sm" onClick={() => setDeleteTarget(c)} icon={<Trash2 size={14} />}>Delete</Button>
                )}
              </div>
            </td>
          </tr>
        )}
      />
      <Modal
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        title={`New ${modality} Case`}
        footer={<><Button variant="secondary" onClick={() => setFormOpen(false)} disabled={submitLoading}>Cancel</Button><Button variant="primary" onClick={handleCreate} loading={submitLoading}>Register Case</Button></>}
      >
        <div className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
          <PatientPicker label="Patient" value={pickedPatient} onSelect={(p) => { setPickedPatient(p); setForm((prev) => ({ ...prev, patient: p ? p._id : '' })); }} required />
          <Input label="Procedure" value={form.procedure} onChange={(e) => setForm(p => ({ ...p, procedure: e.target.value }))} placeholder="e.g. CT Brain Plain" />
          <div className="form-group"><label className="form-label">Findings</label><textarea className="form-control" rows={4} value={form.findings} onChange={(e) => setForm(p => ({ ...p, findings: e.target.value }))} placeholder="Record findings…" /></div>
          <div className="form-group"><label className="form-label">Impression</label><textarea className="form-control" rows={3} value={form.impression} onChange={(e) => setForm(p => ({ ...p, impression: e.target.value }))} placeholder="Final impression…" /></div>
        </div>
      </Modal>
      <Modal isOpen={!!uploadTarget} onClose={() => !uploadBusy && setUploadTarget(null)} title={`Upload ECG report — ${uploadTarget?.patient?.name || ''}`}
        footer={<><Button variant="secondary" disabled={uploadBusy} onClick={() => setUploadTarget(null)}>Cancel</Button><Button onClick={handleUpload} loading={uploadBusy}>Upload report</Button></>}>
        <FileUploader label="Choose ECG report" subtitle="PDF, JPG or PNG, up to 10 MB" value={uploadFile} onChange={setUploadFile} disabled={uploadBusy} error={uploadError} />
        <p className="form-helper">The uploaded report prints as supplied, without a lab letterhead or template.</p>
      </Modal>
      <Modal isOpen={!!previewTarget} onClose={() => setPreviewTarget(null)} title="ECG report preview" size="xl"
        footer={<><Button variant="secondary" onClick={() => setPreviewTarget(null)}>Close</Button><Button onClick={() => printEcg(previewTarget)} disabled={!!printingId}><Printer size={14} /> Print</Button></>}>
        {previewTarget && <ServerPdfPreview path={`/modality/${previewTarget._id}/pdf`} />}
      </Modal>
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        loading={deleteLoading}
        title="Delete modality case?"
        message={`Permanently delete this ${modality} case?`}
      />
    </div>
  );
};

export default ModalityCases;
