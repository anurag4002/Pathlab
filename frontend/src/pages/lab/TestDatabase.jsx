import React, { useState, useEffect } from 'react';
import { getTests, createTest, updateTest, deleteTest, getCategories } from '../../services/testService';
import formatCurrency from '../../utils/formatCurrency';
import { SAMPLE_TYPES } from '../../constants/labConstants';
import { TEST_UNITS } from '../../constants/testConstants';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import { DataTable, PageHeader, Button, Modal, Input, Select, ConfirmDialog, StatusBadge } from '../../components/common';

const TestDatabase = () => {
  const [tests, setTests] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);

  // Form States
  const [formOpen, setFormOpen] = useState(false);
  const [editingTest, setEditingTest] = useState(null);
  const [formData, setFormData] = useState({ name: '', code: '', category: '', sampleType: '', unit: '', referenceRange: '', maleReferenceRange: '', femaleReferenceRange: '', price: '', description: '', interpretation: '', status: 'Active' });
  const [errors, setErrors] = useState({});
  const [submitLoading, setSubmitLoading] = useState(false);

  // Search
  const [search, setSearch] = useState('');

  // Delete
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchTests = async () => {
    setLoading(true);
    try {
      const res = await getTests({ search });
      if (res.success) {
        setTests(res.data);
      }
    } catch (err) {
      console.error('Failed to query tests database', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await getCategories();
      if (res.success) {
        setCategories(res.data.map(c => ({ value: c._id, label: c.name })));
      }
    } catch (err) {
      console.error('Failed to load categories options', err);
    }
  };

  useEffect(() => {
    fetchTests();
    fetchCategories();
  }, [search]);

  const handleOpenCreate = () => {
    setEditingTest(null);
    setFormData({ name: '', code: '', category: '', sampleType: 'Blood (EDTA)', unit: 'g/dL', referenceRange: '', maleReferenceRange: '', femaleReferenceRange: '', price: '', description: '', interpretation: '', status: 'Active' });
    setErrors({});
    setFormOpen(true);
  };

  const handleOpenEdit = (test) => {
    setEditingTest(test);
    setFormData({
      name: test.name,
      code: test.code,
      category: test.category?._id || '',
      sampleType: test.sampleType,
      unit: test.unit || '',
      referenceRange: test.referenceRange || '',
      maleReferenceRange: test.maleReferenceRange || '',
      femaleReferenceRange: test.femaleReferenceRange || '',
      price: String(test.price || 0),
      description: test.description || '',
      interpretation: test.interpretation || '',
      status: test.status
    });
    setErrors({});
    setFormOpen(true);
  };

  const validate = () => {
    const errs = {};
    if (!formData.name.trim()) errs.name = 'Test name is required';
    if (!formData.code.trim()) errs.code = 'Test code identifier is required';
    if (!formData.category) errs.category = 'Please select a category';
    if (!formData.sampleType) errs.sampleType = 'Sample type is required';
    if (!formData.price || isNaN(formData.price) || Number(formData.price) < 0) {
      errs.price = 'Valid test charge price is required';
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

      if (editingTest) {
        res = await updateTest(editingTest._id, payload);
      } else {
        res = await createTest(payload);
      }

      if (res.success) {
        setFormOpen(false);
        fetchTests();
      }
    } catch (err) {
      setErrors({ api: err.response?.data?.message || 'Failed to update test record' });
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      const res = await deleteTest(deleteTarget._id);
      if (res.success) {
        setDeleteTarget(null);
        fetchTests();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete test');
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Tests Configuration Database"
        subtitle="Configure individual laboratory tests, reference ranges, and unit measurements"
        action={
          <Button variant="primary" onClick={handleOpenCreate}>
            <Plus size={16} /> Add New Test
          </Button>
        }
      />

      <DataTable
        headers={['Code', 'Name', 'Category', 'Sample Type', 'Unit', 'Price', 'Status', 'Actions']}
        data={tests}
        loading={loading}
        emptyMessage="No tests match your query."
        searchValue={search}
        onSearchChange={(e) => setSearch(e.target.value)}
        searchPlaceholder="Search by test name or code..."
        renderRow={(test) => (
          <tr key={test._id}>
            <td style={{ fontWeight: '600', color: 'var(--primary-color)' }}>{test.code}</td>
            <td style={{ fontWeight: '600' }}>{test.name}</td>
            <td>{test.category?.name || 'Uncategorized'}</td>
            <td>{test.sampleType}</td>
            <td>{test.unit || 'N/A'}</td>
            <td style={{ fontWeight: '600' }}>{formatCurrency(test.price)}</td>
            <td>
              <StatusBadge status={test.status} />
            </td>
            <td>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  className="btn btn-secondary"
                  style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                  onClick={() => handleOpenEdit(test)}
                >
                  <Edit2 size={14} />
                </button>
                <button
                  className="btn btn-danger"
                  style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                  onClick={() => setDeleteTarget(test)}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </td>
          </tr>
        )}
      />

      {/* Test Creation Modal */}
      <Modal
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        title={editingTest ? 'Edit Test Record' : 'Record New Diagnostic Test'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setFormOpen(false)} disabled={submitLoading}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleFormSubmit} loading={submitLoading}>
              Save Test
            </Button>
          </>
        }
      >
        <form onSubmit={handleFormSubmit} className="form-grid" style={{ gridTemplateColumns: '1fr', maxHeight: '70vh', overflowY: 'auto', paddingRight: '8px' }}>
          {errors.api && <div className="form-error">{errors.api}</div>}
          
          <div style={{ display: 'flex', gap: '16px' }}>
            <Input
              label="Test Code"
              name="code"
              value={formData.code}
              onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
              error={errors.code}
              placeholder="e.g. HB"
              required
              style={{ flex: 1 }}
              disabled={!!editingTest}
            />
            <Input
              label="Test Name"
              name="name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              error={errors.name}
              placeholder="e.g. Hemoglobin"
              required
              style={{ flex: 2 }}
            />
          </div>

          <div style={{ display: 'flex', gap: '16px' }}>
            <Select
              label="Test Category"
              name="category"
              value={formData.category}
              onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
              options={categories}
              error={errors.category}
              required
              style={{ flex: 1 }}
            />
            <Select
              label="Sample Collection Type"
              name="sampleType"
              value={formData.sampleType}
              onChange={(e) => setFormData(prev => ({ ...prev, sampleType: e.target.value }))}
              options={SAMPLE_TYPES.map(s => ({ value: s, label: s }))}
              required
              style={{ flex: 1 }}
            />
          </div>

          <div style={{ display: 'flex', gap: '16px' }}>
            <Select
              label="Result Unit"
              name="unit"
              value={formData.unit}
              onChange={(e) => setFormData(prev => ({ ...prev, unit: e.target.value }))}
              options={TEST_UNITS.map(u => ({ value: u, label: u }))}
              placeholder="No Unit"
              style={{ flex: 1 }}
            />
            <Input
              label="Price (INR)"
              name="price"
              type="number"
              value={formData.price}
              onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
              error={errors.price}
              required
              style={{ flex: 1 }}
            />
          </div>

          <div style={{ display: 'flex', gap: '16px' }}>
            <Input
              label="Default Reference Range"
              name="referenceRange"
              value={formData.referenceRange}
              onChange={(e) => setFormData(prev => ({ ...prev, referenceRange: e.target.value }))}
              placeholder="e.g. 12.0 - 16.0"
              style={{ flex: 1 }}
            />
            <Input
              label="Male Reference Range"
              name="maleReferenceRange"
              value={formData.maleReferenceRange}
              onChange={(e) => setFormData(prev => ({ ...prev, maleReferenceRange: e.target.value }))}
              placeholder="e.g. 13.5 - 17.5"
              style={{ flex: 1 }}
            />
            <Input
              label="Female Reference Range"
              name="femaleReferenceRange"
              value={formData.femaleReferenceRange}
              onChange={(e) => setFormData(prev => ({ ...prev, femaleReferenceRange: e.target.value }))}
              placeholder="e.g. 12.0 - 15.5"
              style={{ flex: 1 }}
            />
          </div>

          <Input
            label="Brief Description"
            name="description"
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
          />

          <div className="form-group">
            <label className="form-label">Default Clinical Interpretation</label>
            <textarea
              value={formData.interpretation}
              onChange={(e) => setFormData(prev => ({ ...prev, interpretation: e.target.value }))}
              className="form-control"
              rows={4}
              placeholder="Write clinical advice guideline..."
            />
          </div>

          <Select
            label="Status"
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
        title="Delete Test Definition?"
        message={`Are you sure you want to permanently delete the test configuration for ${deleteTarget?.name}?`}
      />
    </div>
  );
};

export default TestDatabase;
