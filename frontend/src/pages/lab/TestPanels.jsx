import React, { useState, useEffect } from 'react';
import { getPanels, createPanel, updatePanel, deletePanel } from '../../services/panelService';
import { getTests } from '../../services/testService';
import formatCurrency from '../../utils/formatCurrency';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import { DataTable, PageHeader, Button, Modal, Input, Select, ConfirmDialog, StatusBadge } from '../../components/common';

const TestPanels = () => {
  const [panels, setPanels] = useState([]);
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(false);

  // Form States
  const [formOpen, setFormOpen] = useState(false);
  const [editingPanel, setEditingPanel] = useState(null);
  const [formData, setFormData] = useState({ name: '', price: '', tests: [], description: '', status: 'Active' });
  const [errors, setErrors] = useState({});
  const [submitLoading, setSubmitLoading] = useState(false);

  // Delete State
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

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
    setFormData({ name: '', price: '', tests: [], description: '', status: 'Active' });
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
      alert(err.response?.data?.message || 'Failed to delete panel');
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Test Panels Setup"
        subtitle="Manage diagnostic panels (e.g. CBC Panel, Lipid Profile)"
        action={
          <Button variant="primary" onClick={handleOpenCreate}>
            <Plus size={16} /> Create Panel
          </Button>
        }
      />

      <DataTable
        headers={['Panel Name', 'Included Tests', 'Price', 'Status', 'Actions']}
        data={panels}
        loading={loading}
        emptyMessage="No test panels defined in the system."
        renderRow={(panel) => (
          <tr key={panel._id}>
            <td style={{ fontWeight: '600' }}>{panel.name}</td>
            <td>
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                {panel.tests?.map(t => (
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
        onClose={() => setFormOpen(false)}
        title={editingPanel ? 'Edit Panel details' : 'Build Custom Test Panel'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setFormOpen(false)} disabled={submitLoading}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleFormSubmit} loading={submitLoading}>
              Save panel
            </Button>
          </>
        }
      >
        <form onSubmit={handleFormSubmit} className="form-grid" style={{ gridTemplateColumns: '1fr', maxHeight: '70vh', overflowY: 'auto', paddingRight: '8px' }}>
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
