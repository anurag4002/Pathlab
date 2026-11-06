import React, { useState, useEffect } from 'react';
import { getModalityCases, createModalityCase, updateModalityCase, deleteModalityCase, uploadModalityReport } from '../../services/modalityService';
import { useSearchParams } from 'react-router-dom';
import { downloadBlob, printPdfPath } from '../../services/publicService';
import ServerPdfPreview from '../../components/lab/ServerPdfPreview';
import { DataTable, PageHeader, Button, Modal, Input, StatusBadge, ConfirmDialog, PatientPicker, AdvancedFilterBar, FileUploader, IdentityCell, RowMenu } from '../../components/common';
import { useUiVersion } from '../../utils/uiVersion';
import './v2/casesV2.css';
import useAuth from '../../hooks/useAuth';
import useStickyState from '../../utils/useStickyState';
import useDebounce from '../../hooks/useDebounce';
import { Plus, ArrowRight, Trash2, Upload, Eye, Printer, Download } from 'lucide-react';
import formatDate from '../../utils/formatDate';
import { notify } from '../../components/common/Toast/toast';

const TABS = ['CT', 'MRI', 'ECG', 'OPG', 'EEG', 'MAMMOGRAPHY', 'CARDIOLOGY', 'EPS', 'OUTSOURCE'];
const NEXT = { Registered: 'InProgress', InProgress: 'Reported', Reported: 'Signed', Signed: 'Signed' };
// New look: plain names for scans and steps.
const TAB_LABEL = { MAMMOGRAPHY: 'Mammography', CARDIOLOGY: 'Cardiology', OUTSOURCE: 'Outsource' };
const tabLabel = (m) => TAB_LABEL[m] || m;
const STEP_LABEL = { Registered: 'Registered', InProgress: 'Being reported', Reported: 'Reported', Signed: 'Signed' };
const STEP_TONE = { Registered: 'is-new', InProgress: 'is-warn', Reported: 'is-done', Signed: 'is-done' };
const NEXT_ACTION = { Registered: 'Start report', InProgress: 'Mark reported', Reported: 'Sign off' };

const ModalityCases = () => {
  const isV2 = useUiVersion() === 'v2';
  const { user } = useAuth();
  const isAdmin = user?.role === 'Admin';
  const [searchParams, setSearchParams] = useSearchParams();
  // New look: tab, search, page and a half-made new case come back after a reload.
  const [modality, setModality] = useStickyState('modality', 'CT');
  useEffect(() => { const m = searchParams.get('modality'); if (TABS.includes(m)) setModality(m); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(false);
  const [formOpen, setFormOpen] = useStickyState('open', false);
  const [form, setForm] = useStickyState('form', { patient: '', procedure: '', findings: '', impression: '' });
  const [pickedPatient, setPickedPatient] = useStickyState('patient', null);
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
  const [search, setSearch] = useStickyState('search', '');
  const debouncedSearch = useDebounce(search, 500);
  const [page, goToPage] = useStickyState('page', 1);
  const [limit, setLimitRaw] = useStickyState('limit', 10);
  const setLimit = (n) => { setLimitRaw(Math.max(1, Number(n) || 10)); goToPage(1); };
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
    if (!form.patient) { notify('Select a patient'); return; }
    setSubmitLoading(true);
    try {
      const res = await createModalityCase({ ...form, modality });
      if (res.success) {
        setFormOpen(false);
        setForm({ patient: '', procedure: '', findings: '', impression: '' });
        fetchCases();
      }
    } catch (err) {
      notify(err.response?.data?.message || 'Failed to create case');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleAdvance = async (c) => {
    try {
      const res = await updateModalityCase(c._id, { status: NEXT[c.status] || 'InProgress' });
      if (res.success) fetchCases();
    } catch (err) {
      notify(err.response?.data?.message || 'Failed to update status');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      const res = await deleteModalityCase(deleteTarget._id);
      if (res.success) { setDeleteTarget(null); fetchCases(); }
    } catch (err) {
      notify(err.response?.data?.message || 'Failed to delete case');
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div>
      <PageHeader
        title={isV2 ? 'Other scans' : `${modality} Cases`}
        subtitle={isV2 ? 'CT, MRI, ECG and other scans: register the case, write findings, then sign off.' : 'Modality case registration, findings and status tracking'}
        action={<Button variant="primary" onClick={() => setFormOpen(true)}><Plus size={16} /> {isV2 ? `New ${tabLabel(modality)} case` : `New ${modality} Case`}</Button>}
      />
      {isV2 && (
        <div className="cases-tabs" role="tablist" aria-label="Scan type" style={{ marginBottom: '1rem' }}>
          {TABS.map((m) => (
            <button key={m} type="button" role="tab" aria-selected={m === modality} className={m === modality ? 'is-on' : ''}
              onClick={() => { setModality(m); setSearchParams({ modality: m }); setNotice(''); goToPage(1); }}>{tabLabel(m)}</button>
          ))}
        </div>
      )}
      {!isV2 && <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
        {TABS.map((m) => (
          <Button key={m} variant={m === modality ? 'primary' : 'secondary'} size="sm" onClick={() => { setModality(m); setSearchParams({ modality: m }); setNotice(''); goToPage(1); }}>{m}</Button>
        ))}
      </div>}
      {notice && <p role="status">{notice}</p>}
      {isV2 ? (
        <div className="form-group cases-search-wrap" style={{ marginBottom: '0.75rem' }}>
          <input type="search" data-page-search="" aria-label="Search patient or procedure" placeholder="Patient or procedure" value={search} onChange={(e) => { setSearch(e.target.value); goToPage(1); }} />
        </div>
      ) : (
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
      )}
      <DataTable
        headers={isV2 ? ['Patient', 'Procedure', 'Findings', 'Step', ''] : ['Date', 'Patient', 'Procedure', 'Findings', 'Impression', 'Status', 'Actions']}
        data={cases}
        loading={loading}
        emptyMessage={isV2 ? (search ? 'No case matches your search.' : `No ${tabLabel(modality)} cases yet.`) : `No ${modality} cases found.`}
        emptyAction={isV2 && !search ? <Button variant="secondary" size="sm" onClick={() => setFormOpen(true)}>Register a {tabLabel(modality)} case</Button> : null}
        pagination={{
          total: paginationInfo.total,
          page,
          limit,
          pages: paginationInfo.pages,
          onPageChange: goToPage,
          onLimitChange: setLimit,
        }}
        renderRow={(c) => isV2 ? (
          <tr key={c._id}>
            <td>
              <IdentityCell name={c.patient?.name || 'Patient'}
                clinical={c.patient ? { age: c.patient.age, ageUnit: c.patient.ageUnit, gender: c.patient.gender } : undefined}
                meta={[c.patient?.registrationNumber && `Reg ${c.patient.registrationNumber}`, formatDate(c.caseDate).split(',')[0]]} />
            </td>
            <td style={{ maxWidth: '180px' }}>{c.procedure || <span className="cell-empty">Not set</span>}</td>
            <td style={{ maxWidth: '260px', color: '#52525b' }} title={[c.findings, c.impression].filter(Boolean).join(' / ')}>
              {c.impression ? <><strong style={{ color: '#18181b', fontWeight: 500 }}>{c.impression}</strong></> : c.findings ? c.findings.slice(0, 90) : <span className="cell-empty">Not written yet</span>}
            </td>
            <td><span className={`cases-status ${STEP_TONE[c.status] || ''}`}>{STEP_LABEL[c.status] || c.status}</span></td>
            <td>
              <div className="row-actions-v2">
                {c.modality === 'ECG' && c.status !== 'Signed' && !c.reportFile?.size ? (
                  <Button variant="primary" size="sm" icon={<Upload size={14} />} onClick={() => { setUploadTarget(c); setUploadFile(null); setUploadError(''); }}>Upload report</Button>
                ) : c.status !== 'Signed' ? (
                  <Button variant="secondary" size="sm" icon={<ArrowRight size={14} />} onClick={() => handleAdvance(c)}>{NEXT_ACTION[c.status] || 'Next step'}</Button>
                ) : null}
                <RowMenu label={`More actions for ${c.patient?.name || 'this case'}`} items={[
                  c.modality === 'ECG' && c.status !== 'Signed' && !!c.reportFile?.size && { label: 'Replace report', onClick: () => { setUploadTarget(c); setUploadFile(null); setUploadError(''); } },
                  c.modality === 'ECG' && !!c.reportFile?.size && { label: 'Preview report', onClick: () => setPreviewTarget(c) },
                  c.modality === 'ECG' && !!c.reportFile?.size && { label: 'Print report', onClick: () => printEcg(c) },
                  c.modality === 'ECG' && !!c.reportFile?.size && { label: 'Download report', onClick: () => downloadBlob(`/modality/${c._id}/file`, c.reportFile.name || 'ECG-report.pdf').catch(() => setNotice('Could not download the ECG report.')) },
                  c.modality === 'ECG' && c.status !== 'Signed' && !!c.reportFile?.size && { label: NEXT_ACTION[c.status] || 'Next step', onClick: () => handleAdvance(c) },
                  isAdmin && { label: 'Delete case', onClick: () => setDeleteTarget(c), danger: true },
                ]} />
              </div>
            </td>
          </tr>
        ) : (
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
        title={isV2 ? `New ${tabLabel(modality)} case` : `New ${modality} Case`}
        variant="drawer"
        footer={<>{isV2 && <span className="cases-drawer-note">Closing keeps what you typed.</span>}<Button variant="secondary" onClick={() => setFormOpen(false)} disabled={submitLoading}>Cancel</Button><Button variant="primary" onClick={handleCreate} loading={submitLoading}>{isV2 ? 'Register case' : 'Register Case'}</Button></>}
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
        title={isV2 ? 'Delete this case?' : 'Delete modality case?'}
        message={isV2 ? `This ${tabLabel(modality)} case and its findings will be removed. This cannot be undone.` : `Permanently delete this ${modality} case?`}
      />
    </div>
  );
};

export default ModalityCases;
