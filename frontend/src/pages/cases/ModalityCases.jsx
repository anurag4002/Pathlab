import React, { useState, useEffect } from 'react';
import { getModalityCases, createModalityCase, updateModalityCase, deleteModalityCase } from '../../services/modalityService';
import { getPatients } from '../../services/patientService';
import { DataTable, PageHeader, Button, Modal, Select, Input, StatusBadge, ConfirmDialog } from '../../components/common';
import useAuth from '../../hooks/useAuth';
import { Plus, ArrowRight, Trash2 } from 'lucide-react';
import formatDate from '../../utils/formatDate';

const TABS = ['CT', 'MRI', 'ECG', 'OPG', 'EEG', 'MAMMOGRAPHY', 'CARDIOLOGY', 'EPS', 'OUTSOURCE'];
const NEXT = { Registered: 'InProgress', InProgress: 'Reported', Reported: 'Signed', Signed: 'Signed' };

const ModalityCases = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'Admin';
  const [modality, setModality] = useState('CT');
  const [cases, setCases] = useState([]);
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({ patient: '', procedure: '', findings: '', impression: '' });
  const [submitLoading, setSubmitLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchCases = async () => {
    setLoading(true);
    try {
      const res = await getModalityCases({ modality, limit: 50 });
      if (res.success) setCases(res.data.cases);
    } catch (err) {
      console.error('Failed to load modality cases', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getPatients({ limit: 100 }).then((r) => { if (r.success) setPatients(r.data.patients); }).catch(() => {});
  }, []);

  useEffect(() => { fetchCases(); }, [modality]);

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
          <Button key={m} variant={m === modality ? 'primary' : 'secondary'} size="sm" onClick={() => setModality(m)}>{m}</Button>
        ))}
      </div>
      <DataTable
        headers={['Date', 'Patient', 'Procedure', 'Findings', 'Impression', 'Status', 'Actions']}
        data={cases}
        loading={loading}
        emptyMessage={`No ${modality} cases found.`}
        renderRow={(c) => (
          <tr key={c._id}>
            <td>{formatDate(c.caseDate)}</td>
            <td style={{ fontWeight: 600 }}>{c.patient?.name} <span style={{ fontWeight: 400, fontSize: '0.75rem' }}>({c.patient?.registrationNumber})</span></td>
            <td style={{ maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={c.procedure || ''}>{c.procedure || '—'}</td>
            <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={c.findings || ''}>{c.findings || '—'}</td>
            <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={c.impression || ''}>{c.impression || '—'}</td>
            <td><StatusBadge status={c.status} /></td>
            <td>
              <div style={{ display: 'flex', gap: '8px' }}>
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
          <Select label="Patient" value={form.patient} onChange={(e) => setForm(p => ({ ...p, patient: e.target.value }))} options={patients.map(p => ({ value: p._id, label: `${p.name} (${p.registrationNumber})` }))} required />
          <Input label="Procedure" value={form.procedure} onChange={(e) => setForm(p => ({ ...p, procedure: e.target.value }))} placeholder="e.g. CT Brain Plain" />
          <div className="form-group"><label className="form-label">Findings</label><textarea className="form-control" rows={4} value={form.findings} onChange={(e) => setForm(p => ({ ...p, findings: e.target.value }))} placeholder="Record findings…" /></div>
          <div className="form-group"><label className="form-label">Impression</label><textarea className="form-control" rows={3} value={form.impression} onChange={(e) => setForm(p => ({ ...p, impression: e.target.value }))} placeholder="Final impression…" /></div>
        </div>
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
