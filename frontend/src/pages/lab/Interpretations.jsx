import React, { lazy, Suspense, useState, useEffect, useMemo } from 'react';
import { getInterpretations, createInterpretation, updateInterpretation, deleteInterpretation, getTests } from '../../services/testService';
import useClientPagination from '../../hooks/useClientPagination';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import { DataTable, PageHeader, Button, Modal, Input, Select, ConfirmDialog, StatusBadge, AdvancedFilterBar } from '../../components/common';
import useAuth from '../../hooks/useAuth';
import InterpretationText from '../../components/lab/InterpretationText';
import { copyInterpretation } from '../../utils/interpretationContent';
import { notify } from '../../components/common/Toast/toast';
import { useUiVersion } from '../../utils/uiVersion';
import { RowMenu } from '../../components/common';
import '../../components/business/business.css';
import './v2/labSetupV2.css';
const RichInterpretationEditor = lazy(() => import('../../components/lab/RichInterpretationEditor'));

const STATUS_OPTIONS = [
  { value: 'Active', label: 'Active' },
  { value: 'Inactive', label: 'Inactive' }
];

const Interpretations = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'Admin';
  const [interpretations, setInterpretations] = useState([]);
  const [catalogNotes, setCatalogNotes] = useState([]);
  const [copyMessage, setCopyMessage] = useState('');
  const copyText = async text => {
    try { await copyInterpretation(text); setCopyMessage('Complete interpretation copied.'); }
    catch { setCopyMessage('Clipboard unavailable. Expand the interpretation and select its text to copy.'); }
  };
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(false);

  // Form States
  const [formOpen, setFormOpen] = useState(false);
  const [editingInterpretation, setEditingInterpretation] = useState(null);
  const [formData, setFormData] = useState({ test: '', resultCondition: '', interpretationText: '', normalAbnormalGuidance: 'Normal', status: 'Active' });
  // New look: a new note being typed survives an accidental close.
  const isV2 = useUiVersion() === 'v2';
  const [createDraft, setCreateDraft] = useState(null);
  const closeForm = () => { if (isV2 && !editingInterpretation) setCreateDraft(formData); setFormOpen(false); };
  const [errors, setErrors] = useState({});
  const [submitLoading, setSubmitLoading] = useState(false);

  // Delete State
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Search + client-side pagination.
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const filteredInterpretations = useMemo(() => {
    const q = search.trim().toLowerCase();
    return interpretations.filter((r) => {
      if (statusFilter && r.status !== statusFilter) return false;
      if (!q) return true;
      return String(r.test?.name || '').toLowerCase().includes(q) ||
        String(r.resultCondition || '').toLowerCase().includes(q) ||
        String(r.interpretationText || '').toLowerCase().includes(q);
    });
  }, [interpretations, search, statusFilter]);
  const pg = useClientPagination(filteredInterpretations, 10);

  const fetchInterpretations = async () => {
    setLoading(true);
    try {
      const res = await getInterpretations();
      if (res.success) {
        setInterpretations(res.data);
      }
    } catch (err) {
      console.error('Failed to load interpretations list', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTestsList = async () => {
    try {
      const res = await getTests({ status: 'Active' });
      if (res.success) {
        setTests(res.data.map(t => ({ value: t._id, label: `${t.name} (${t.code})` })));
        setCatalogNotes(res.data.filter(test => test.interpretation?.trim()));
      }
    } catch (err) {
      console.error('Failed to load active tests', err);
    }
  };

  useEffect(() => {
    fetchInterpretations();
    fetchTestsList();
  }, []);

  const handleOpenCreate = () => {
    setEditingInterpretation(null);
    setFormData(isV2 && createDraft ? createDraft : { test: '', resultCondition: '', interpretationText: '', normalAbnormalGuidance: 'Normal', status: 'Active' });
    setErrors({});
    setFormOpen(true);
  };

  const handleOpenEdit = (interp) => {
    setEditingInterpretation(interp);
    setFormData({
      test: interp.test?._id || '',
      resultCondition: interp.resultCondition,
      interpretationText: interp.interpretationText,
      normalAbnormalGuidance: interp.normalAbnormalGuidance || 'Normal',
      status: interp.status
    });
    setErrors({});
    setFormOpen(true);
  };

  const validate = () => {
    const errs = {};
    if (!formData.resultCondition.trim()) errs.resultCondition = 'Result condition is required';
    if (!formData.interpretationText.trim()) errs.interpretationText = 'Guidance text is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitLoading(true);
    try {
      let res;
      if (editingInterpretation) {
        res = await updateInterpretation(editingInterpretation._id, formData);
      } else {
        res = await createInterpretation(formData);
      }

      if (res.success) {
        setFormOpen(false);
        if (!editingInterpretation) setCreateDraft(null);
        fetchInterpretations();
      }
    } catch (err) {
      setErrors({ api: err.response?.data?.message || 'Failed to save interpretation guidance' });
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      const res = await deleteInterpretation(deleteTarget._id);
      if (res.success) {
        setDeleteTarget(null);
        fetchInterpretations();
      }
    } catch (err) {
      notify(err.response?.data?.message || 'Failed to remove interpretation record');
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Interpretations Management"
        subtitle={isV2 ? 'Ready-made notes for reports: your own notes for a result, and the standard note stored with each test.' : 'Reusable complete interpretations: copy text or select it while editing a report'}
        action={
          isAdmin && <Button variant="primary" onClick={handleOpenCreate}>
            <Plus size={16} /> {isV2 ? 'Add note' : 'Add Advice'}
          </Button>
        }
      />

      <AdvancedFilterBar
        showSearchButton={false}
        showClearButton={!!(search || statusFilter)}
        onClear={() => { setSearch(''); setStatusFilter(''); pg.reset(); }}
        values={{ search, status: statusFilter }}
        onChange={(key, value) => {
          pg.reset();
          if (key === 'search') setSearch(value);
          else if (key === 'status') setStatusFilter(value);
        }}
        fields={[
          { key: 'search', label: 'Search', type: 'text', size: 'lg', placeholder: 'Search test, condition, text…' },
          { key: 'status', label: 'Status', type: 'select', options: STATUS_OPTIONS, placeholder: 'All statuses' }
        ]}
      />

      {isV2 ? (
        <>
          <section className="biz-section">
            <div className="biz-section-head"><h2>Your notes{interpretations.length ? ` (${filteredInterpretations.length})` : ''}</h2><p>Shown when a result matches the condition. Copy one into a report, or pick it while editing.</p></div>
            {!loading && interpretations.length === 0 ? (
              <div className="ls-interp"><p className="tu-empty" style={{ margin: 0, padding: '1rem', color: '#71717a' }}>No notes yet.{isAdmin ? ' Use "Add note" for results you comment on often.' : ''}</p></div>
            ) : (
              <DataTable
                headers={['Test', 'When the result is', 'Note', 'Type', '']}
                data={pg.paged}
                loading={loading}
                emptyMessage="No note matches your search."
                pagination={{ total: pg.total, page: pg.page, limit: pg.limit, pages: pg.pages, onPageChange: pg.goToPage, onLimitChange: pg.setLimit }}
                renderRow={(interp) => (
                  <tr key={interp._id}>
                    <td>{interp.test ? <><span className="strong">{interp.test.name}</span><div className="muted">{interp.test.code}</div></> : <span className="muted">Any test</span>}</td>
                    <td>{interp.resultCondition}</td>
                    <td style={{ maxWidth: '420px' }}><InterpretationText text={interp.interpretationText} title="View the full note" /></td>
                    <td><StatusBadge status={interp.normalAbnormalGuidance} />{interp.status !== 'Active' ? <> <StatusBadge status={interp.status} /></> : null}</td>
                    <td>
                      <div className="ls-actions">
                        <Button variant="secondary" size="sm" onClick={() => copyText(interp.interpretationText)}>Copy</Button>
                        {isAdmin && <RowMenu items={[
                          { label: 'Edit note', onClick: () => handleOpenEdit(interp) },
                          { label: 'Delete note', danger: true, onClick: () => setDeleteTarget(interp) },
                        ]} />}
                      </div>
                    </td>
                  </tr>
                )}
              />
            )}
          </section>
          {copyMessage && <p role="status" className="biz-note">{copyMessage}</p>}
          <section className="biz-section">
            {(() => {
              const notes = catalogNotes.filter((test) => !search || `${test.name} ${test.code} ${test.interpretation}`.toLowerCase().includes(search.toLowerCase()));
              return (
                <>
                  <div className="biz-section-head"><h2>Standard notes per test ({notes.length})</h2><p>Saved with the test; open one to read or copy it.</p></div>
                  <div className="ls-interp">
                    {notes.length === 0 && <p style={{ margin: 0, padding: '1rem', color: '#71717a' }}>No test has a standard note{search ? ' matching your search' : ''}.</p>}
                    {notes.map((test) => (
                      <details key={test._id}>
                        <summary><span><b>{test.name}</b> <small>{test.code}</small></span><small>Open</small></summary>
                        <div className="ls-interp-body">
                          <InterpretationText text={test.interpretation} />
                          <div style={{ marginTop: '0.6rem' }}><Button variant="secondary" size="sm" onClick={() => copyText(test.interpretation)}>Copy note</Button></div>
                        </div>
                      </details>
                    ))}
                  </div>
                </>
              );
            })()}
          </section>
        </>
      ) : (
        <>
      <DataTable
        headers={['Test Associated', 'Result Condition', 'Interpretation Text', 'Guidance Type', 'Status', 'Actions']}
        data={pg.paged}
        loading={loading}
        emptyMessage="No clinical interpretations registered."
        pagination={{
          total: pg.total,
          page: pg.page,
          limit: pg.limit,
          pages: pg.pages,
          onPageChange: pg.goToPage,
          onLimitChange: pg.setLimit,
        }}
        renderRow={(interp) => (
          <tr key={interp._id}>
            <td style={{ fontWeight: '600' }}>
              {interp.test ? `${interp.test.name} (${interp.test.code})` : 'General / Panel'}
            </td>
            <td style={{ fontWeight: '600', color: 'var(--primary-color)' }}>{interp.resultCondition}</td>
            <td style={{ maxWidth: '400px' }}>
              <InterpretationText text={interp.interpretationText} title="View complete interpretation" />
            </td>
            <td>
              <StatusBadge status={interp.normalAbnormalGuidance} />
            </td>
            <td>
              <StatusBadge status={interp.status} />
            </td>
            <td>
              <div style={{ display: 'flex', gap: '8px' }}>
                <Button variant="secondary" onClick={() => copyText(interp.interpretationText)}>Copy full text</Button>
                {isAdmin && <><button
                  className="btn btn-secondary"
                  style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                  onClick={() => handleOpenEdit(interp)}
                >
                  <Edit2 size={14} />
                </button>
                <button
                  className="btn btn-danger"
                  style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                  onClick={() => setDeleteTarget(interp)}
                >
                  <Trash2 size={14} />
                </button></>}
              </div>
            </td>
          </tr>
        )}
      />

      {copyMessage && <p role="status">{copyMessage}</p>}
      <h2>Catalog interpretations</h2>
      {catalogNotes.filter(test => !search || `${test.name} ${test.code} ${test.interpretation}`.toLowerCase().includes(search.toLowerCase())).map(test => <details key={test._id} style={{ margin: '12px 0', border: '1px solid var(--color-border)', padding: 12, borderRadius: 8 }}>
        <summary>{test.name} ({test.code})</summary>
        <InterpretationText text={test.interpretation} />
        <Button variant="secondary" onClick={() => copyText(test.interpretation)}>Copy full interpretation</Button>
      </details>)}
        </>
      )}

      {/* Form Modal */}
      <Modal
        isOpen={formOpen}
        onClose={closeForm}
        variant="drawer"
        title={isV2 ? (editingInterpretation ? 'Edit note' : 'New note') : editingInterpretation ? 'Edit Clinical Advice Guideline' : 'Record Diagnostic Advice'}
        footer={
          <>
            <Button variant="secondary" onClick={closeForm} disabled={submitLoading}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleFormSubmit} loading={submitLoading}>
              {isV2 ? 'Save note' : 'Save Advice'}
            </Button>
          </>
        }
      >
        <form onSubmit={handleFormSubmit} className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
          {errors.api && <div className="form-error">{errors.api}</div>}
          
          <Select
            label="Target Laboratory Test (optional)"
            id="library-target-test"
            value={formData.test}
            onChange={(e) => setFormData(prev => ({ ...prev, test: e.target.value }))}
            options={tests}
            error={errors.test}
            placeholder="General / Panel interpretation"
          />

          <Input
            label="Library title / Result condition"
            name="resultCondition"
            value={formData.resultCondition}
            onChange={(e) => setFormData(prev => ({ ...prev, resultCondition: e.target.value }))}
            error={errors.resultCondition}
            placeholder="e.g. Serum Creatinine > 1.3 mg/dL"
            required
          />

          <div className="form-group">
            <p className="form-label">Interpretation text advice *</p>
            <Suspense fallback={<p>Loading editor…</p>}><RichInterpretationEditor label="Library interpretation text" value={formData.interpretationText}
              onChange={value => setFormData(prev => ({ ...prev, interpretationText: value }))} disabled={submitLoading} /></Suspense>
            {errors.interpretationText && <p className="form-error">{errors.interpretationText}</p>}
          </div>

          <div style={{ display: 'flex', gap: '16px' }}>
            <Select
              label="Guidance Type"
              value={formData.normalAbnormalGuidance}
              onChange={(e) => setFormData(prev => ({ ...prev, normalAbnormalGuidance: e.target.value }))}
              options={[
                { value: 'Normal', label: 'Normal Reference Guidance' },
                { value: 'General', label: 'General Test Interpretation' },
                { value: 'Abnormal', label: 'Abnormal Flag Advice' }
              ]}
              required
              style={{ flex: 1 }}
            />
            <Select
              label="Status"
              value={formData.status}
              onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
              options={[
                { value: 'Active', label: 'Active' },
                { value: 'Inactive', label: 'Inactive' }
              ]}
              required
              style={{ flex: 1 }}
            />
          </div>

        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        loading={deleteLoading}
        title="Remove Diagnostic Guidance?"
        message={`Are you sure you want to permanently delete the advice for ${deleteTarget?.resultCondition}?`}
      />
    </div>
  );
};

export default Interpretations;
