import React, { useState, useEffect, useMemo } from 'react';
import { getInterpretations, createInterpretation, updateInterpretation, deleteInterpretation, getTests } from '../../services/testService';
import useClientPagination from '../../hooks/useClientPagination';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import { DataTable, PageHeader, Button, Modal, Input, Select, ConfirmDialog, StatusBadge } from '../../components/common';

const Interpretations = () => {
  const [interpretations, setInterpretations] = useState([]);
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(false);

  // Form States
  const [formOpen, setFormOpen] = useState(false);
  const [editingInterpretation, setEditingInterpretation] = useState(null);
  const [formData, setFormData] = useState({ test: '', resultCondition: '', interpretationText: '', normalAbnormalGuidance: 'Normal', status: 'Active' });
  const [errors, setErrors] = useState({});
  const [submitLoading, setSubmitLoading] = useState(false);

  // Delete State
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Search + client-side pagination.
  const [search, setSearch] = useState('');
  const filteredInterpretations = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return interpretations;
    return interpretations.filter((r) =>
      String(r.test?.name || '').toLowerCase().includes(q) ||
      String(r.resultCondition || '').toLowerCase().includes(q) ||
      String(r.interpretationText || '').toLowerCase().includes(q)
    );
  }, [interpretations, search]);
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
    setFormData({ test: '', resultCondition: '', interpretationText: '', normalAbnormalGuidance: 'Normal', status: 'Active' });
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
    if (!formData.test) errs.test = 'Please select a laboratory test';
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
      alert(err.response?.data?.message || 'Failed to remove interpretation record');
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Interpretations Management"
        subtitle="Manage advisory guidelines triggered by laboratory values findings"
        action={
          <Button variant="primary" onClick={handleOpenCreate}>
            <Plus size={16} /> Add Advice
          </Button>
        }
      />

      <DataTable
        headers={['Test Associated', 'Result Condition', 'Interpretation Text', 'Guidance Type', 'Status', 'Actions']}
        data={pg.paged}
        loading={loading}
        emptyMessage="No clinical interpretations registered."
        searchValue={search}
        onSearchChange={(e) => { setSearch(e.target.value); pg.reset(); }}
        searchPlaceholder="Search test, condition, text…"
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
              {interp.test ? `${interp.test.name} (${interp.test.code})` : 'Unlinked Test'}
            </td>
            <td style={{ fontWeight: '600', color: 'var(--primary-color)' }}>{interp.resultCondition}</td>
            <td style={{ maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {interp.interpretationText}
            </td>
            <td>
              <StatusBadge status={interp.normalAbnormalGuidance} />
            </td>
            <td>
              <StatusBadge status={interp.status} />
            </td>
            <td>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
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
                </button>
              </div>
            </td>
          </tr>
        )}
      />

      {/* Form Modal */}
      <Modal
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        title={editingInterpretation ? 'Edit Clinical Advice Guideline' : 'Record Diagnostic Advice'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setFormOpen(false)} disabled={submitLoading}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleFormSubmit} loading={submitLoading}>
              Save Advice
            </Button>
          </>
        }
      >
        <form onSubmit={handleFormSubmit} className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
          {errors.api && <div className="form-error">{errors.api}</div>}
          
          <Select
            label="Target Laboratory Test"
            value={formData.test}
            onChange={(e) => setFormData(prev => ({ ...prev, test: e.target.value }))}
            options={tests}
            error={errors.test}
            required
            placeholder="Select Test"
          />

          <Input
            label="Result Value Condition description"
            name="resultCondition"
            value={formData.resultCondition}
            onChange={(e) => setFormData(prev => ({ ...prev, resultCondition: e.target.value }))}
            error={errors.resultCondition}
            placeholder="e.g. Serum Creatinine > 1.3 mg/dL"
            required
          />

          <div className="form-group">
            <label className="form-label" htmlFor="interpretationText">Interpretation text advice *</label>
            <textarea
              id="interpretationText"
              value={formData.interpretationText}
              onChange={(e) => setFormData(prev => ({ ...prev, interpretationText: e.target.value }))}
              className="form-control"
              rows={4}
              placeholder="Advice to print: Patient exhibits elevated creatinine levels which may indicate acute kidney injury or chronic renal dysfunction..."
              required
            />
            {errors.interpretationText && <p className="form-error">{errors.interpretationText}</p>}
          </div>

          <div style={{ display: 'flex', gap: '16px' }}>
            <Select
              label="Guidance Type"
              value={formData.normalAbnormalGuidance}
              onChange={(e) => setFormData(prev => ({ ...prev, normalAbnormalGuidance: e.target.value }))}
              options={[
                { value: 'Normal', label: 'Normal Reference Guidance' },
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
