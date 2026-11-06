import React, { useState, useEffect, useMemo } from 'react';
import useStickyState from '../../utils/useStickyState';
import { getPanels, createPanel, updatePanel, deletePanel } from '../../services/panelService';
import { getTests } from '../../services/testService';
import formatCurrency from '../../utils/formatCurrency';
import useClientPagination from '../../hooks/useClientPagination';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import { DataTable, PageHeader, Button, Modal, Input, Select, ConfirmDialog, StatusBadge, RowMenu, AdvancedFilterBar } from '../../components/common';
import { notify } from '../../components/common/Toast/toast';
import { useUiVersion } from '../../utils/uiVersion';
import TestChecklist from './v2/TestChecklist';
import './v2/labSetupV2.css';

const STATUS_OPTIONS = [
  { value: 'Active', label: 'Active' },
  { value: 'Inactive', label: 'Inactive' }
];

const TestPanels = () => {
  const [panels, setPanels] = useState([]);
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(false);

  // Form States
  const [formOpen, setFormOpen] = useStickyState('formOpen', false);
  const [editingPanel, setEditingPanel] = useStickyState('editingPanel', null);
  const [formData, setFormData] = useStickyState('formData', { name: '', price: '', tests: [], description: '', status: 'Active' });
  // New look: a new panel being built survives an accidental close.
  const isV2 = useUiVersion() === 'v2';
  const [createDraft, setCreateDraft] = useStickyState('createDraft', null);
  const closeForm = () => { if (isV2 && !editingPanel) setCreateDraft(formData); setFormOpen(false); };
  const [errors, setErrors] = useState({});
  const [submitLoading, setSubmitLoading] = useState(false);

  // Delete State
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Search + client-side pagination (GET /api/panels returns the full list).
  const [search, setSearch] = useStickyState('search', '');
  const [statusFilter, setStatusFilter] = useStickyState('statusFilter', '');
  const filteredPanels = useMemo(() => {
    const q = search.trim().toLowerCase();
    return panels.filter((p) => {
      if (statusFilter && p.status !== statusFilter) return false;
      if (!q) return true;
      return String(p.name || '').toLowerCase().includes(q);
    });
  }, [panels, search, statusFilter]);
  const pg = useClientPagination(filteredPanels, 10);

  const fetchPanels = async () => {
    setLoading(true);
    try {
      const res = await getPanels();
      if (res.success) {
        setPanels(res.data);
      }
    } catch (err) {
      console.error('Failed to load panels', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTestsList = async () => {
    try {
      const res = await getTests({ status: 'Active' });
      if (res.success) {
        setTests(res.data);
      }
    } catch (err) {
      console.error('Failed to load active tests', err);
    }
  };

  useEffect(() => {
    fetchPanels();
    fetchTestsList();
  }, []);

  const handleOpenCreate = () => {
    setEditingPanel(null);
    setFormData(isV2 && createDraft ? createDraft : { name: '', price: '', tests: [], description: '', status: 'Active' });
    setErrors({});
    setFormOpen(true);
  };

  const handleOpenEdit = (panel) => {
    setEditingPanel(panel);
    setFormData({
      name: panel.name,
      price: String(panel.price || 0),
      tests: panel.tests?.map(t => t._id) || [],
      description: panel.description || '',
      status: panel.status
    });
    setErrors({});
    setFormOpen(true);
  };

  const handleTestCheckboxChange = (testId) => {
    setFormData(prev => {
      const isChecked = prev.tests.includes(testId);
      if (isChecked) {
        return {
          ...prev,
          tests: prev.tests.filter(id => id !== testId)
        };
      } else {
        return {
          ...prev,
          tests: [...prev.tests, testId]
        };
      }
    });
  };

  const validate = () => {
    const errs = {};
    if (!formData.name.trim()) errs.name = 'Panel name is required';
    if (!formData.price || isNaN(formData.price) || Number(formData.price) < 0) {
      errs.price = 'Valid panel price is required';
    }
    if (formData.tests.length === 0) {
      errs.tests = 'Please select at least one test to include in the panel';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitLoading(true);
    try {
      let res;
      const payload = {
        ...formData,
        price: Number(formData.price)
      };

      if (editingPanel) {
        res = await updatePanel(editingPanel._id, payload);
      } else {
        res = await createPanel(payload);
      }

      if (res.success) {
        setFormOpen(false);
        if (!editingPanel) setCreateDraft(null);
        fetchPanels();
      }
    } catch (err) {
      setErrors({ api: err.response?.data?.message || 'Failed to save panel' });
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      const res = await deletePanel(deleteTarget._id);
      if (res.success) {
        setDeleteTarget(null);
        fetchPanels();
      }
    } catch (err) {
      notify(err.response?.data?.message || 'Failed to delete panel');
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Test Panels Setup"
        subtitle={isV2 ? 'Groups of tests billed together at one price, e.g. CBC or Lipid profile.' : 'Manage diagnostic panels (e.g. CBC Panel, Lipid Profile)'}
        action={
          <Button variant="primary" onClick={handleOpenCreate}>
            <Plus size={16} /> {isV2 ? 'New panel' : 'Create Panel'}
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
          { key: 'search', label: 'Search', type: 'text', size: 'lg', placeholder: 'Search panels…' },
          { key: 'status', label: 'Status', type: 'select', options: STATUS_OPTIONS, placeholder: 'All statuses' }
        ]}
      />

      <DataTable
        headers={isV2 ? ['Panel', 'Tests in it', 'Price', 'Status', ''] : ['Panel Name', 'Included Tests', 'Price', 'Status', 'Actions']}
        data={pg.paged}
        loading={loading}
        emptyMessage="No test panels defined in the system."
        pagination={{
          total: pg.total,
          page: pg.page,
          limit: pg.limit,
          pages: pg.pages,
          onPageChange: pg.goToPage,
          onLimitChange: pg.setLimit,
        }}
        renderRow={(panel) => isV2 ? (() => {
          const list = [...new Map((panel.tests || []).map((x) => [String(x?._id || x), x])).values()].filter((x) => x && x.name);
          const sepPrice = list.reduce((sum, t) => sum + (Number(t.price) || 0), 0);
          return (
          <tr key={panel._id}>
            <td><button type="button" className="ls-link" onClick={() => handleOpenEdit(panel)}>{panel.name}</button>{panel.description ? <div className="muted">{panel.description}</div> : null}</td>
            <td>
              <div className="ls-included"><b>{list.length} test{list.length === 1 ? '' : 's'}</b>{list.length ? ': ' : ''}{list.slice(0, 4).map((t) => t.name).join(', ')}{list.length > 4 ? ` and ${list.length - 4} more` : ''}</div>
            </td>
            <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
              <div className="strong">{formatCurrency(panel.price)}</div>
              {sepPrice > Number(panel.price) ? <div className="muted">{formatCurrency(sepPrice)} separately</div> : null}
            </td>
            <td><StatusBadge status={panel.status} /></td>
            <td>
              <div className="ls-actions">
                <Button variant="secondary" size="sm" onClick={() => handleOpenEdit(panel)}>Edit</Button>
                <RowMenu items={[{ label: 'Delete panel', danger: true, onClick: () => setDeleteTarget(panel) }]} />
              </div>
            </td>
          </tr>
          );
        })() : (
          <tr key={panel._id}>
            <td style={{ fontWeight: '600' }}>{panel.name}</td>
            <td>
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                {[...new Map((panel.tests || []).map((x) => [String(x?._id || x), x])).values()]?.map(t => (
                  <span key={t._id} style={{ fontSize: '0.75rem', backgroundColor: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>
                    {t.code}
                  </span>
                ))}
              </div>
            </td>
            <td style={{ fontWeight: '600', color: 'var(--primary-color)' }}>
              {formatCurrency(panel.price)}
            </td>
            <td>
              <StatusBadge status={panel.status} />
            </td>
            <td>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  className="btn btn-secondary"
                  style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                  onClick={() => handleOpenEdit(panel)}
                >
                  <Edit2 size={14} />
                </button>
                <button
                  className="btn btn-danger"
                  style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                  onClick={() => setDeleteTarget(panel)}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </td>
          </tr>
        )}
      />

      {/* Panel Creation Modal */}
      <Modal
        isOpen={formOpen}
        onClose={closeForm}
        variant="drawer"
        title={isV2 ? (editingPanel ? `Edit ${editingPanel.name}` : 'New panel') : editingPanel ? 'Edit Panel details' : 'Build Custom Test Panel'}
        footer={
          <>
            <Button variant="secondary" onClick={closeForm} disabled={submitLoading}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleFormSubmit} loading={submitLoading}>
              Save panel
            </Button>
          </>
        }
      >
        <form onSubmit={handleFormSubmit} className="modal-form">
          {errors.api && <div className="form-error">{errors.api}</div>}
          
          <Input
            label="Panel Name"
            name="name"
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            error={errors.name}
            placeholder="e.g. Lipid Profile"
            required
          />

          <Input
            label="Panel Price"
            name="price"
            type="number"
            value={formData.price}
            onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
            error={errors.price}
            required
          />

          {isV2 ? (
            <TestChecklist tests={tests} selected={formData.tests} onToggle={handleTestCheckboxChange} error={errors.tests} price={formData.price} />
          ) : (
          <>
          {/* Checklist of tests */}
          <div className="form-group">
            <label className="form-label" style={{ marginBottom: '8px' }}>
              Select Tests to Include {errors.tests && <span className="form-error"> - {errors.tests}</span>}
            </label>
            <div style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius-sm)', maxHeight: '180px', overflowY: 'auto', padding: '8px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              {tests.map(test => (
                <label key={test._id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.825rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={formData.tests.includes(test._id)}
                    onChange={() => handleTestCheckboxChange(test._id)}
                  />
                  <span>{test.name} ({test.code})</span>
                </label>
              ))}
            </div>
          </div>
          </>
          )}

          <Input
            label="Brief Description"
            name="description"
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
          />

          <Select
            label="Panel Status"
            name="status"
            value={formData.status}
            onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
            options={[
              { value: 'Active', label: 'Active' },
              { value: 'Inactive', label: 'Inactive' }
            ]}
            required
          />

        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        loading={deleteLoading}
        title="Delete Test Panel?"
        message={`Are you sure you want to permanently delete the panel ${deleteTarget?.name}?`}
      />
    </div>
  );
};

export default TestPanels;
