import React, { useState, useEffect, useMemo } from 'react';
import { getTests, createTest, updateTest, deleteTest, getCategories } from '../../services/testService';
import formatCurrency from '../../utils/formatCurrency';
import useClientPagination from '../../hooks/useClientPagination';
import { SAMPLE_TYPES } from '../../constants/labConstants';
import { TEST_UNITS } from '../../constants/testConstants';
import { Plus, Edit2, Trash2, FlaskConical, IndianRupee, Ruler, Sigma, Stethoscope } from 'lucide-react';
import { DataTable, PageHeader, Button, Modal, Input, Select, ConfirmDialog, StatusBadge, AdvancedFilterBar } from '../../components/common';
import RangeEditor, { validateRanges, normalizeRangePayload } from '../../components/lab/RangeEditor';
import DerivedTestEditor from '../../components/lab/DerivedTestEditor';
import AgeReferenceEditor from '../../components/lab/AgeReferenceEditor';
import { normalizeAgeRanges, formatAgeRanges } from '../../utils/ageReferenceRanges';
import RangeFlagBadge from '../../components/lab/RangeFlagBadge';
import './TestDatabase.css';

const TestDatabase = () => {
  const [tests, setTests] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);

  // Form States
  const [formOpen, setFormOpen] = useState(false);
  const [editingTest, setEditingTest] = useState(null);
  const EMPTY_FORM = { name: '', code: '', category: '', sampleType: '', unit: '', referenceRange: '', maleReferenceRange: '', femaleReferenceRange: '', price: '', description: '', interpretation: '', status: 'Active', normalLow: '', normalHigh: '', criticalLow: '', criticalHigh: '', ageMin: '', ageMax: '', sexApplicable: 'Any', isDerived: false, formula: '' };
  const [formData, setFormData] = useState({ ...EMPTY_FORM, referenceRanges: [], parameters: [] });
  const [errors, setErrors] = useState({});
  const [submitLoading, setSubmitLoading] = useState(false);

  // Filters (merged quick-find + table search)
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Client-side pagination (GET /api/tests returns the full list).
  const filteredTests = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tests.filter((t) => {
      if (categoryFilter) {
        const catId = t.category?._id || t.category || '';
        if (String(catId) !== String(categoryFilter)) return false;
      }
      if (statusFilter && String(t.status || '') !== statusFilter) return false;
      if (!q) return true;
      return (
        String(t.name || '').toLowerCase().includes(q) ||
        String(t.code || '').toLowerCase().includes(q)
      );
    });
  }, [tests, search, categoryFilter, statusFilter]);
  const pg = useClientPagination(filteredTests, 10);

  // Delete
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchTests = async () => {
    setLoading(true);
    try {
      const res = await getTests();
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleOpenCreate = () => {
    setEditingTest(null);
    setFormData({ ...EMPTY_FORM, referenceRanges: [], parameters: [], sampleType: 'Blood (EDTA)', unit: 'g/dL' });
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
      status: test.status,
      normalLow: test.normalLow ?? '',
      normalHigh: test.normalHigh ?? '',
      criticalLow: test.criticalLow ?? '',
      criticalHigh: test.criticalHigh ?? '',
      ageMin: test.ageMin ?? '',
      ageMax: test.ageMax ?? '',
      sexApplicable: test.sexApplicable || 'Any',
      isDerived: !!test.isDerived,
      formula: test.formula || '',
      referenceRanges: test.referenceRanges || [],
      parameters: test.parameters || [],
      resultOptions: test.resultOptions || []
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
    Object.assign(errs, validateRanges(formData));
    if (formData.isDerived && !String(formData.formula || '').trim()) {
      errs.formula = 'Derived tests require a formula';
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
        price: Number(formData.price),
        ...normalizeRangePayload(formData),
        referenceRanges: normalizeAgeRanges(formData.referenceRanges),
        referenceRange: formData.referenceRanges?.length ? formatAgeRanges(formData.referenceRanges) : formData.referenceRange,
        isDerived: !!formData.isDerived,
        formula: formData.isDerived ? String(formData.formula || '').trim() : '',
        resultOptions: (formData.resultOptions || []).map((choice) => choice.trim()).filter(Boolean),
        parameters: (formData.parameters || []).map((parameter) => ({ ...parameter,
          referenceRanges: normalizeAgeRanges(parameter.referenceRanges),
          referenceRange: parameter.referenceRanges?.length ? formatAgeRanges(parameter.referenceRanges) : parameter.referenceRange,
          resultOptions: (parameter.resultOptions || []).map((choice) => choice.trim()).filter(Boolean) }))
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
      setErrors({ ...err.response?.data?.errors, api: err.response?.data?.message || 'Failed to update test record' });
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

      <AdvancedFilterBar
        values={{ search, category: categoryFilter, status: statusFilter }}
        onChange={(key, value) => {
          if (key === 'search') setSearch(value);
          else if (key === 'category') setCategoryFilter(value);
          else if (key === 'status') setStatusFilter(value);
          pg.reset();
        }}
        onSearch={() => {
          fetchTests();
          pg.reset();
        }}
        onClear={() => {
          setSearch('');
          setCategoryFilter('');
          setStatusFilter('');
          pg.reset();
        }}
        fields={[
          {
            key: 'search',
            label: 'Find test',
            type: 'text',
            placeholder: 'Type to find by name or code…',
            size: 'lg'
          },
          {
            key: 'category',
            label: 'Category',
            type: 'select',
            options: [{ value: '', label: 'All categories' }, ...categories],
            placeholder: 'All categories'
          },
          {
            key: 'status',
            label: 'Status',
            type: 'select',
            options: [
              { value: '', label: 'All statuses' },
              { value: 'Active', label: 'Active' },
              { value: 'Inactive', label: 'Inactive' }
            ],
            placeholder: 'All statuses'
          }
        ]}
      />

      <DataTable
        headers={['Code', 'Name', 'Category', 'Sample Type', 'Unit', 'Price', 'Status', 'Actions']}
        data={pg.paged}
        loading={loading}
        emptyMessage="No tests match your query."
        pagination={{
          total: pg.total,
          page: pg.page,
          limit: pg.limit,
          pages: pg.pages,
          onPageChange: pg.goToPage,
          onLimitChange: pg.setLimit,
        }}
        renderRow={(test) => (
          <tr key={test._id}>
            <td style={{ fontWeight: '600', color: 'var(--color-primary)' }}>{test.code}</td>
            <td style={{ fontWeight: '600' }}>
              {test.name}
              {(test.isDerived || test.parameters?.some((p) => p.isDerived)) && (
                <span style={{ marginLeft: '6px', fontSize: '0.65rem', fontWeight: 700, backgroundColor: '#e0e7ff', color: '#3730a3', padding: '1px 6px', borderRadius: '999px' }}>
                  DERIVED
                </span>
              )}
              {(test.normalLow !== null && test.normalLow !== undefined && test.normalLow !== '') && (
                <span style={{ display: 'block', fontWeight: 400, fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                  Range: {String(test.normalLow)} – {String(test.normalHigh ?? '')} {test.unit || ''}
                </span>
              )}
            </td>
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
        size="lg"
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
        <form onSubmit={handleFormSubmit} className="test-form">
          {errors.api && <div className="test-form-alert" role="alert">{errors.api}</div>}

          <section className="test-form-section" aria-label="Basic details">
            <h4 className="test-form-section-title"><FlaskConical size={15} /> Basic Details</h4>
            <div className="test-form-grid">
              <Input
                label="Test Code"
                name="code"
                value={formData.code}
                onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                error={errors.code}
                placeholder="e.g. HB"
                required
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
              />
              <Select
                label="Test Category"
                name="category"
                value={formData.category}
                onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                options={categories}
                error={errors.category}
                required
              />
              <Select
                label="Sample Collection Type"
                name="sampleType"
                value={formData.sampleType}
                onChange={(e) => setFormData(prev => ({ ...prev, sampleType: e.target.value }))}
                options={SAMPLE_TYPES.map(s => ({ value: s, label: s }))}
                required
              />
            </div>
          </section>

          <section className="test-form-section" aria-label="Pricing and result unit">
            <h4 className="test-form-section-title"><IndianRupee size={15} /> Pricing & Unit</h4>
            <div className="test-form-grid">
              <Select
                label="Result Unit"
                name="unit"
                value={formData.unit}
                onChange={(e) => setFormData(prev => ({ ...prev, unit: e.target.value }))}
                options={TEST_UNITS.map(u => ({ value: u, label: u }))}
                placeholder="No Unit"
              />
              <Input
                label="Price (INR)"
                name="price"
                type="number"
                value={formData.price}
                onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
                error={errors.price}
                placeholder="e.g. 250"
                required
              />
              <div className="test-form-full">
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
              </div>
            </div>
          </section>

          <section className="test-form-section" aria-label="Reference ranges">
            <h4 className="test-form-section-title"><Ruler size={15} /> Reference Ranges</h4>
            <div className="test-form-grid cols-3">
              <Input
                label="Default Range"
                name="referenceRange"
                value={formData.referenceRange}
                onChange={(e) => setFormData(prev => ({ ...prev, referenceRange: e.target.value }))}
                placeholder="e.g. 12.0 - 16.0"
              />
              <Input
                label="Male Range"
                name="maleReferenceRange"
                value={formData.maleReferenceRange}
                onChange={(e) => setFormData(prev => ({ ...prev, maleReferenceRange: e.target.value }))}
                placeholder="e.g. 13.5 - 17.5"
              />
              <Input
                label="Female Range"
                name="femaleReferenceRange"
                value={formData.femaleReferenceRange}
                onChange={(e) => setFormData(prev => ({ ...prev, femaleReferenceRange: e.target.value }))}
                placeholder="e.g. 12.0 - 15.5"
              />
            </div>

            {/* Phase 2 — numeric ranges alongside legacy strings (strings kept for display templates) */}
            <RangeEditor
              value={formData}
              errors={errors}
              onChange={(patch) => setFormData(prev => ({ ...prev, ...patch }))}
            />
            {(formData.normalLow !== '' || formData.normalHigh !== '') && (
              <p className="test-form-hint">
                <span>Range check preview (high bound):</span>
                <RangeFlagBadge
                  value={formData.normalHigh}
                  test={{
                    normalLow: formData.normalLow === '' ? null : Number(formData.normalLow),
                    normalHigh: formData.normalHigh === '' ? null : Number(formData.normalHigh),
                    criticalLow: formData.criticalLow === '' ? null : Number(formData.criticalLow),
                    criticalHigh: formData.criticalHigh === '' ? null : Number(formData.criticalHigh)
                  }}
                />
              </p>
            )}
          </section>

          <section className="test-form-section" aria-label="Derived test">
            <h4 className="test-form-section-title"><Sigma size={15} /> Derived Test</h4>
            {!formData.parameters?.length && <DerivedTestEditor
              key={editingTest?._id || 'new-test'}
              isDerived={formData.isDerived}
              formula={formData.formula}
              tests={tests.filter((t) => !editingTest || t._id !== editingTest._id).flatMap((t) => t.parameters?.length ? t.parameters.map((p) => ({ ...p, _id: `${t._id}:${p.code}`, name: `${t.name}: ${p.name}` })) : [t])}
              error={errors.formula}
              onChange={(patch) => {
                setFormData(prev => ({ ...prev, ...patch }));
              }}
            />}
          </section>

          <section className="test-form-section" aria-label="Clinical notes">
            <Input label="Result dropdown choices (one per comma)" name="resultOptions"
              value={(formData.resultOptions || []).join(', ')} placeholder="e.g. Negative, Positive"
              helperText="Set choices for qualitative results. Other allows free-text entry; numeric tests use a value field."
              onChange={(e) => setFormData((prev) => ({ ...prev, resultOptions: e.target.value.split(',').map((choice) => choice.trim()) }))} />
            <AgeReferenceEditor ranges={formData.referenceRanges || []} error={errors.referenceRanges}
              onChange={(referenceRanges) => setFormData((prev) => ({ ...prev, referenceRanges,
                ...(referenceRanges.length || prev.referenceRanges.length ? { referenceRange: formatAgeRanges(referenceRanges) } : {}),
                ...(prev.referenceRanges.length && !referenceRanges.length ? { normalLow: '', normalHigh: '', criticalLow: '', criticalHigh: '', maleReferenceRange: '', femaleReferenceRange: '' } : {})
              }))} />
            {formData.parameters?.length > 0 && <div>
              <h4>Parameters and calculations</h4>
              {formData.parameters.map((parameter, index) => <div className="age-range-row" key={parameter.code}>
                <h5>{parameter.name} ({parameter.code})</h5>
                <Input label="Unit" name={`parameter-unit-${index}`} value={parameter.unit || ''}
                  onChange={(e) => setFormData((prev) => ({ ...prev, parameters: prev.parameters.map((p, i) => i === index ? { ...p, unit: e.target.value } : p) }))} />
                <Input label="Reference range" name={`parameter-range-${index}`} value={parameter.referenceRange || ''}
                  onChange={(e) => setFormData((prev) => ({ ...prev, parameters: prev.parameters.map((p, i) => i === index ? { ...p, referenceRange: e.target.value, normalLow: null, normalHigh: null } : p) }))} />
                <AgeReferenceEditor idPrefix={`parameter-${index}-range`} ranges={parameter.referenceRanges || []} error={errors.parameters}
                  onChange={(referenceRanges) => setFormData((prev) => ({ ...prev, parameters: prev.parameters.map((p, i) => i === index ? { ...p, referenceRanges,
                    ...(referenceRanges.length || p.referenceRanges?.length ? { referenceRange: formatAgeRanges(referenceRanges) } : {}),
                    ...(p.referenceRanges?.length && !referenceRanges.length ? { normalLow: null, normalHigh: null, criticalLow: null, criticalHigh: null } : {})
                  } : p) }))} />
                <Input label="Result dropdown choices (comma separated)" name={`parameter-options-${index}`} value={(parameter.resultOptions || []).join(', ')}
                  onChange={(e) => setFormData((prev) => ({ ...prev, parameters: prev.parameters.map((p, i) => i === index ? { ...p, resultOptions: e.target.value.split(',').map((choice) => choice.trim()) } : p) }))} />
                <label className="formula-toggle"><input type="checkbox" checked={!!parameter.isDerived}
                  onChange={(e) => setFormData((prev) => ({ ...prev, parameters: prev.parameters.map((p, i) => i === index ? { ...p, isDerived: e.target.checked } : p) }))} />Calculated parameter (fx)</label>
                {parameter.isDerived && <Input label="Parameter formula" name={`parameter-formula-${index}`} value={parameter.formula || ''}
                  onChange={(e) => setFormData((prev) => ({ ...prev, parameters: prev.parameters.map((p, i) => i === index ? { ...p, formula: e.target.value } : p) }))} />}
              </div>)}
            </div>}
            <h4 className="test-form-section-title"><Stethoscope size={15} /> Clinical Notes</h4>
            <Input
              label="Brief Description"
              name="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Short description shown in the catalog…"
            />
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Default Clinical Interpretation</label>
              <textarea
                value={formData.interpretation}
                onChange={(e) => setFormData(prev => ({ ...prev, interpretation: e.target.value }))}
                className="form-control"
                rows={4}
                placeholder="Write clinical advice guideline..."
              />
            </div>
          </section>

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
