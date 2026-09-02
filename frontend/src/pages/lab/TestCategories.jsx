import React, { useState, useEffect } from 'react';
import { getCategories, createCategory, updateCategory, deleteCategory } from '../../services/testService';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import { DataTable, PageHeader, Button, Modal, Input, ConfirmDialog } from '../../components/common';

const TestCategories = () => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);

  // Form States
  const [formOpen, setFormOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [formData, setFormData] = useState({ name: '', description: '' });
  const [errors, setErrors] = useState({});
  const [submitLoading, setSubmitLoading] = useState(false);

  // Delete State
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const res = await getCategories();
      if (res.success) {
        setCategories(res.data);
      }
    } catch (err) {
      console.error('Failed to load categories', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleOpenCreate = () => {
    setEditingCategory(null);
    setFormData({ name: '', description: '' });
    setErrors({});
    setFormOpen(true);
  };

  const handleOpenEdit = (category) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      description: category.description || ''
    });
    setErrors({});
    setFormOpen(true);
  };

  const validate = () => {
    const errs = {};
    if (!formData.name.trim()) errs.name = 'Category name is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitLoading(true);
    try {
      let res;
      if (editingCategory) {
        res = await updateCategory(editingCategory._id, formData);
      } else {
        res = await createCategory(formData);
      }

      if (res.success) {
        setFormOpen(false);
        fetchCategories();
      }
    } catch (err) {
      setErrors({ api: err.response?.data?.message || 'Failed to save category' });
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      const res = await deleteCategory(deleteTarget._id);
      if (res.success) {
        setDeleteTarget(null);
        fetchCategories();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete category');
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Test Categories Setup"
        subtitle="Manage diagnostic clinical groups (e.g. Hematology, Biochemistry)"
        action={
          <Button variant="primary" onClick={handleOpenCreate}>
            <Plus size={16} /> Add Category
          </Button>
        }
      />

      <DataTable
        headers={['Category Name', 'Description', 'Actions']}
        data={categories}
        loading={loading}
        emptyMessage="No clinical categories defined."
        renderRow={(category) => (
          <tr key={category._id}>
            <td style={{ fontWeight: '600' }}>{category.name}</td>
            <td>{category.description || 'N/A'}</td>
            <td>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  className="btn btn-secondary"
                  style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                  onClick={() => handleOpenEdit(category)}
                >
                  <Edit2 size={14} />
                </button>
                <button
                  className="btn btn-danger"
                  style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                  onClick={() => setDeleteTarget(category)}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </td>
          </tr>
        )}
      />

      {/* Category Creation Modal */}
      <Modal
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        title={editingCategory ? 'Edit Category' : 'Create Test Category'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setFormOpen(false)} disabled={submitLoading}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleFormSubmit} loading={submitLoading}>
              Save Category
            </Button>
          </>
        }
      >
        <form onSubmit={handleFormSubmit} className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
          {errors.api && <div className="form-error">{errors.api}</div>}
          <Input
            label="Category Name"
            name="name"
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            error={errors.name}
            placeholder="e.g. Immunology"
            required
          />
          <Input
            label="Description"
            name="description"
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
          />
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        loading={deleteLoading}
        title="Delete Test Category?"
        message={`Are you sure you want to delete category ${deleteTarget?.name}? Tests in this category will become uncategorized.`}
      />
    </div>
  );
};

export default TestCategories;
