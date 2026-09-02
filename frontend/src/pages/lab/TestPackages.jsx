import React, { useState, useEffect } from 'react';
import { getPackages, createPackage, updatePackage, deletePackage } from '../../services/packageService';
import { getTests } from '../../services/testService';
import formatCurrency from '../../utils/formatCurrency';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import { DataTable, PageHeader, Button, Modal, Input, Select, ConfirmDialog, StatusBadge } from '../../components/common';

const TestPackages = () => {
  const [packages, setPackages] = useState([]);
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(false);

  // Form States
  const [formOpen, setFormOpen] = useState(false);
  const [editingPackage, setEditingPackage] = useState(null);
  const [formData, setFormData] = useState({ name: '', price: '', gender: 'All', includedTests: [], description: '', status: 'Active' });
  const [errors, setErrors] = useState({});
  const [submitLoading, setSubmitLoading] = useState(false);

  // Delete State
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchPackages = async () => {
    setLoading(true);
    try {
      const res = await getPackages();
      if (res.success) {
        setPackages(res.data);
      }
    } catch (err) {
      console.error('Failed to fetch packages list', err);
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
    fetchPackages();
    fetchTestsList();
  }, []);

  const handleOpenCreate = () => {
    setEditingPackage(null);
    setFormData({ name: '', price: '', gender: 'All', includedTests: [], description: '', status: 'Active' });
    setErrors({});
    setFormOpen(true);
  };

  const handleOpenEdit = (pkg) => {
    setEditingPackage(pkg);
    setFormData({
      name: pkg.name,
      price: String(pkg.price || 0),
      gender: pkg.gender || 'All',
      includedTests: pkg.includedTests?.map(t => t._id) || [],
      description: pkg.description || '',
      status: pkg.status
    });
    setErrors({});
    setFormOpen(true);
  };

  const handleTestCheckboxChange = (testId) => {
    setFormData(prev => {
      const isChecked = prev.includedTests.includes(testId);
      if (isChecked) {
        return {
          ...prev,
          includedTests: prev.includedTests.filter(id => id !== testId)
        };
      } else {
        return {
          ...prev,
          includedTests: [...prev.includedTests, testId]
        };
      }
    });
  };

  const validate = () => {
    const errs = {};
    if (!formData.name.trim()) errs.name = 'Package name is required';
    if (!formData.price || isNaN(formData.price) || Number(formData.price) < 0) {
      errs.price = 'Valid package price is required';
    }
    if (formData.includedTests.length === 0) {
      errs.includedTests = 'Please select at least one test to include in the package';
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

      if (editingPackage) {
        res = await updatePackage(editingPackage._id, payload);
      } else {
        res = await createPackage(payload);
      }

      if (res.success) {
        setFormOpen(false);
        fetchPackages();
      }
    } catch (err) {
      setErrors({ api: err.response?.data?.message || 'Failed to save package' });
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      const res = await deletePackage(deleteTarget._id);
      if (res.success) {
        setDeleteTarget(null);
        fetchPackages();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete package');
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Test Packages Setup"
        subtitle="Combine individual tests into discounted custom health profiles"
        action={
          <Button variant="primary" onClick={handleOpenCreate}>
            <Plus size={16} /> Create Package
          </Button>
        }
      />

      <DataTable
        headers={['Package Name', 'Included Tests', 'Price', 'Applicable Gender', 'Status', 'Actions']}
        data={packages}
        loading={loading}
        emptyMessage="No test packages defined in the system."
        renderRow={(pkg) => (
          <tr key={pkg._id}>
            <td style={{ fontWeight: '600' }}>{pkg.name}</td>
            <td>
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                {pkg.includedTests?.map(t => (
                  <span key={t._id} style={{ fontSize: '0.75rem', backgroundColor: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>
                    {t.code}
                  </span>
                ))}
              </div>
            </td>
            <td style={{ fontWeight: '600', color: 'var(--primary-color)' }}>
              {formatCurrency(pkg.price)}
            </td>
            <td>{pkg.gender}</td>
            <td>
              <StatusBadge status={pkg.status} />
            </td>
            <td>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  className="btn btn-secondary"
                  style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                  onClick={() => handleOpenEdit(pkg)}
                >
                  <Edit2 size={14} />
                </button>
                <button
                  className="btn btn-danger"
                  style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                  onClick={() => setDeleteTarget(pkg)}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </td>
          </tr>
        )}
      />

      {/* Package Creation Modal */}
      <Modal
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        title={editingPackage ? 'Edit Package details' : 'Build Custom Test Package'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setFormOpen(false)} disabled={submitLoading}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleFormSubmit} loading={submitLoading}>
              Save package
            </Button>
          </>
        }
      >
        <form onSubmit={handleFormSubmit} className="form-grid" style={{ gridTemplateColumns: '1fr', maxHeight: '70vh', overflowY: 'auto', paddingRight: '8px' }}>
          {errors.api && <div className="form-error">{errors.api}</div>}
          
          <Input
            label="Package Name"
            name="name"
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            error={errors.name}
            placeholder="e.g. Full Body Checkup"
            required
          />

          <div style={{ display: 'flex', gap: '16px' }}>
            <Input
              label="Package Cost Price"
              name="price"
              type="number"
              value={formData.price}
              onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
              error={errors.price}
              required
              style={{ flex: 1 }}
            />
            <Select
              label="Gender Restriction"
              name="gender"
              value={formData.gender}
              onChange={(e) => setFormData(prev => ({ ...prev, gender: e.target.value }))}
              options={[
                { value: 'All', label: 'All Genders' },
                { value: 'Male', label: 'Male Only' },
                { value: 'Female', label: 'Female Only' }
              ]}
              required
              style={{ flex: 1 }}
            />
          </div>

          {/* Checklist of tests */}
          <div className="form-group">
            <label className="form-label" style={{ marginBottom: '8px' }}>
              Select Tests to Include {errors.includedTests && <span className="form-error"> - {errors.includedTests}</span>}
            </label>
            <div style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius-sm)', maxHeight: '180px', overflowY: 'auto', padding: '8px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              {tests.map(test => (
                <label key={test._id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.825rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={formData.includedTests.includes(test._id)}
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
            label="Package Status"
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
        title="Delete Test Package?"
        message={`Are you sure you want to permanently delete the custom package ${deleteTarget?.name}?`}
      />
    </div>
  );
};

export default TestPackages;
