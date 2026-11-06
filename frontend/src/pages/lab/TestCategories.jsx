import React, { useState, useEffect, useMemo } from 'react';
import { getCategories, createCategory, updateCategory, deleteCategory, getTests } from '../../services/testService';
import { useUiVersion } from '../../utils/uiVersion';
import useClientPagination from '../../hooks/useClientPagination';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import { DataTable, PageHeader, Button, Modal, Input, ConfirmDialog, AdvancedFilterBar, RowMenu } from '../../components/common';
import { notify } from '../../components/common/Toast/toast';
import './v2/labSetupV2.css';

const TestCategories = () => {
  const isV2 = useUiVersion() === 'v2';
  // New look: how many tests sit in each category, and a new category being
  // typed survives an accidental close of the panel.
  const [testCounts, setTestCounts] = useState({});
  const [createDraft, setCreateDraft] = useState(null);
  useEffect(() => {
    if (!isV2) return;
    getTests({}).then((res) => {
      const counts = {};
      (Array.isArray(res?.data) ? res.data : []).filter((t) => !t.isDeleted).forEach((t) => {
        const id = String(t.category?._id || t.category || '');
        if (id) counts[id] = (counts[id] || 0) + 1;
      });
      setTestCounts(counts);
    }).catch(() => {});
  }, [isV2]);
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

  // Search + client-side pagination.
  const [search, setSearch] = useState('');
  const filteredCategories = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return categories;
    return categories.filter((c) => String(c.name || '').toLowerCase().includes(q));
  }, [categories, search]);
  const pg = useClientPagination(filteredCategories, 10);

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
    setFormData(isV2 && createDraft ? createDraft : { name: '', description: '' });
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
        if (!editingCategory) setCreateDraft(null);
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
      notify(err.response?.data?.message || 'Failed to delete category');
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Test Categories Setup"
        subtitle={isV2 ? 'Departments that group your tests, e.g. Haematology or Biochemistry.' : 'Manage diagnostic clinical groups (e.g. Hematology, Biochemistry)'}
        action={
          <Button variant="primary" onClick={handleOpenCreate}>
            <Plus size={16} /> {isV2 ? 'Add category' : 'Add Category'}
          </Button>
        }
      />

      <AdvancedFilterBar
        showSearchButton={false}
        showClearButton={!!search}
        onClear={() => { setSearch(''); pg.reset(); }}
        values={{ search }}
        onChange={(key, value) => {
          if (key === 'search') { setSearch(value); pg.reset(); }
        }}
        fields={[
          { key: 'search', label: 'Search', type: 'text', size: 'lg', placeholder: 'Search categories…' }
        ]}
      />

      <DataTable
        headers={isV2 ? ['Category', 'Tests', 'Note', ''] : ['Category Name', 'Description', 'Actions']}
        data={pg.paged}
        loading={loading}
        emptyMessage="No clinical categories defined."
        pagination={{
          total: pg.total,
          page: pg.page,
          limit: pg.limit,
          pages: pg.pages,
          onPageChange: pg.goToPage,
          onLimitChange: pg.setLimit,
        }}
        renderRow={(category) => isV2 ? (
          <tr key={category._id}>
            <td><button type="button" className="ls-link" onClick={() => handleOpenEdit(category)}>{category.name}</button></td>
            <td>{testCounts[String(category._id)] ? <span className="strong">{testCounts[String(category._id)]}</span> : <span className="muted">None yet</span>}</td>
            <td className="muted">{category.description && !/migrated from labsmart/i.test(category.description) ? category.description : ''}</td>
            <td>
              <div className="ls-actions">
                <Button variant="secondary" size="sm" onClick={() => handleOpenEdit(category)}>Edit</Button>
                <RowMenu items={[{ label: 'Delete category', danger: true, onClick: () => setDeleteTarget(category) }]} />
              </div>
            </td>
          </tr>
        ) : (
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
        onClose={() => { if (isV2 && !editingCategory) setCreateDraft(formData); setFormOpen(false); }}
        variant="drawer"
        title={isV2 ? (editingCategory ? `Edit ${editingCategory.name}` : 'New category') : editingCategory ? 'Edit Category' : 'Create Test Category'}
        footer={
          <>
            <Button variant="secondary" onClick={() => { if (isV2 && !editingCategory) setCreateDraft(formData); setFormOpen(false); }} disabled={submitLoading}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleFormSubmit} loading={submitLoading}>
              {isV2 ? 'Save' : 'Save Category'}
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
            label={isV2 ? 'Note (optional)' : 'Description'}
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
        title={isV2 ? `Delete ${deleteTarget?.name || 'category'}?` : 'Delete Test Category?'}
        message={isV2 ? `${testCounts[String(deleteTarget?._id)] || 'Any'} test${testCounts[String(deleteTarget?._id)] === 1 ? '' : 's'} in it will have no category until you move them.` : `Are you sure you want to delete category ${deleteTarget?.name}? Tests in this category will become uncategorized.`}
      />
    </div>
  );
};

export default TestCategories;
