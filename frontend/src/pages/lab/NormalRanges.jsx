import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Edit2, RefreshCw } from 'lucide-react';
import { getTests, getCategories, updateTest } from '../../services/testService';
import useAuth from '../../hooks/useAuth';
import useDebounce from '../../hooks/useDebounce';
import {
  PageHeader,
  Button,
  DataTable,
  Modal,
  Input,
  Select,
  StatusBadge
} from '../../components/common';
import '../../styles/NormalRanges.css';

/* Option lists mirror existing backend enums on the Test model — no business
   data lives here. sexApplicable: Any | Male | Female. status: Active | Inactive. */
const SEX_APPLICABLE_OPTIONS = [
  { value: 'Any', label: 'Any' },
  { value: 'Male', label: 'Male' },
  { value: 'Female', label: 'Female' }
];

const TEST_STATUS_OPTIONS = [
  { value: 'Active', label: 'Active' },
  { value: 'Inactive', label: 'Inactive' }
];

const EMPTY_FORM = {
  referenceRange: '',
  maleReferenceRange: '',
  femaleReferenceRange: '',
  normalLow: '',
  normalHigh: '',
  criticalLow: '',
  criticalHigh: '',
  ageMin: '',
  ageMax: '',
  sexApplicable: 'Any'
};

const NUMERIC_FIELDS = [
  { key: 'normalLow', label: 'Normal low' },
  { key: 'normalHigh', label: 'Normal high' },
  { key: 'criticalLow', label: 'Critical low' },
  { key: 'criticalHigh', label: 'Critical high' },
  { key: 'ageMin', label: 'Age from' },
  { key: 'ageMax', label: 'Age to' }
];

/* Surfaces only the backend's user-facing `message` field (never stack traces),
   with sensible fallbacks per failure type. */
const getApiErrorMessage = (err, fallback) => {
  if (err?.response) {
    const data = err.response.data;
    if (data && typeof data.message === 'string' && data.message.trim()) {
      return data.message;
    }
    const status = err.response.status;
    if (status === 401) return 'Your session has expired. Please log in again.';
    if (status === 403) return 'You do not have permission to perform this action.';
    if (status === 404) return 'The requested record was not found.';
    if (status === 409) return 'The record was changed elsewhere. Please refresh and try again.';
    if (status === 422) return 'The submitted data is invalid.';
    if (status >= 500) return 'Server error. Please try again.';
    return fallback;
  }
  if (err?.code === 'ECONNABORTED') return 'The request timed out. Please try again.';
  if (err?.request) return 'Network error. Please check your connection and try again.';
  return err?.message || fallback;
};

/* Range display — backend-provided strings/numbers only, never computed here. */
const formatTextRange = (test) => {
  if (test.referenceRange) return test.referenceRange;
  const parts = [];
  if (test.maleReferenceRange) parts.push(`Male: ${test.maleReferenceRange}`);
  if (test.femaleReferenceRange) parts.push(`Female: ${test.femaleReferenceRange}`);
  return parts.length ? parts.join(' / ') : '—';
};

const formatNumericRange = (low, high) => {
  if (low == null && high == null) return '—';
  if (low != null && high != null) return `${low} - ${high}`;
  if (low != null) return `>= ${low}`;
  return `<= ${high}`;
};

const NormalRanges = () => {
  const { hasRole } = useAuth();
  // Backend restricts test updates (and therefore range edits) to Admin.
  const canEdit = hasRole(['Admin']);

  // Server-backed list state
  const [tests, setTests] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [feedback, setFeedback] = useState(null); // { type, text }

  // Filters — search/category/status are server-side (GET /tests params);
  // gender is applied to the already-fetched list because the API exposes no
  // sex filter parameter.
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 400);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [genderFilter, setGenderFilter] = useState('');

  // Edit modal state — the server stays the source of truth
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState({});
  const [saving, setSaving] = useState(false);

  // Load the range list from the backend (server-side search/filter).
  useEffect(() => {
    let active = true;
    setLoading(true);
    const params = {};
    if (debouncedSearch.trim()) params.search = debouncedSearch.trim();
    if (categoryFilter) params.category = categoryFilter;
    if (statusFilter) params.status = statusFilter;

    getTests(params)
      .then((res) => {
        if (!active) return;
        setTests(Array.isArray(res?.data) ? res.data : []);
        setLoadError(null);
      })
      .catch((err) => {
        if (!active) return;
        setTests([]);
        setLoadError(getApiErrorMessage(err, 'Failed to load normal ranges.'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [debouncedSearch, categoryFilter, statusFilter, reloadKey]);

  // Category filter options (optional — the list works without them).
  useEffect(() => {
    let active = true;
    getCategories()
      .then((res) => {
        if (!active || !Array.isArray(res?.data)) return;
        setCategories(res.data.map((c) => ({ value: c._id, label: c.name })));
      })
      .catch(() => {
        // Filter options are non-critical; leave the select empty on failure.
      });
    return () => {
      active = false;
    };
  }, []);

  const refresh = () => {
    setFeedback(null);
    setReloadKey((key) => key + 1);
  };

  const openEdit = (test) => {
    setEditing(test);
    setFormData({
      referenceRange: test.referenceRange || '',
      maleReferenceRange: test.maleReferenceRange || '',
      femaleReferenceRange: test.femaleReferenceRange || '',
      normalLow: test.normalLow ?? '',
      normalHigh: test.normalHigh ?? '',
      criticalLow: test.criticalLow ?? '',
      criticalHigh: test.criticalHigh ?? '',
      ageMin: test.ageMin ?? '',
      ageMax: test.ageMax ?? '',
      sexApplicable: test.sexApplicable || 'Any'
    });
    setFormErrors({});
    setFeedback(null);
  };

  const closeEdit = () => {
    if (saving) return;
    setEditing(null);
    setFormErrors({});
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setFormErrors((prev) => {
      if (!prev[name]) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
  };

  /* Validation limited to field-level consistency rules the API contract
     implies (min <= max, age from <= age to). Backend validation remains
     authoritative. */
  const validate = () => {
    const errs = {};
    const numbers = {};
    NUMERIC_FIELDS.forEach(({ key, label }) => {
      const raw = String(formData[key]).trim();
      if (raw === '') {
        numbers[key] = null;
        return;
      }
      const value = Number(raw);
      if (Number.isNaN(value)) {
        errs[key] = `${label} must be a number.`;
        numbers[key] = null;
      } else {
        numbers[key] = value;
      }
    });

    if (
      numbers.normalLow != null &&
      numbers.normalHigh != null &&
      numbers.normalLow > numbers.normalHigh
    ) {
      errs.normalHigh = 'Normal low cannot be greater than normal high.';
    }
    if (
      numbers.criticalLow != null &&
      numbers.criticalHigh != null &&
      numbers.criticalLow > numbers.criticalHigh
    ) {
      errs.criticalHigh = 'Critical low cannot be greater than critical high.';
    }
    if (numbers.ageMin != null && numbers.ageMax != null && numbers.ageMin > numbers.ageMax) {
      errs.ageMax = 'Age from cannot be greater than age to.';
    }

    setFormErrors(errs);
    return { valid: Object.keys(errs).length === 0, numbers };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!editing || saving) return;
    const { valid, numbers } = validate();
    if (!valid) return;

    setSaving(true);
    setFormErrors({});

    // Identity fields are carried over unchanged (the backend's test
    // validation requires them); only the range fields below are edited.
    const payload = {
      name: editing.name,
      code: editing.code,
      category: editing.category?._id || editing.category || null,
      sampleType: editing.sampleType,
      price: editing.price,
      referenceRange: String(formData.referenceRange).trim(),
      maleReferenceRange: String(formData.maleReferenceRange).trim(),
      femaleReferenceRange: String(formData.femaleReferenceRange).trim(),
      normalLow: numbers.normalLow,
      normalHigh: numbers.normalHigh,
      criticalLow: numbers.criticalLow,
      criticalHigh: numbers.criticalHigh,
      ageMin: numbers.ageMin,
      ageMax: numbers.ageMax,
      sexApplicable: formData.sexApplicable
    };

    try {
      const res = await updateTest(editing._id, payload);
      if (res?.success) {
        const savedName = editing.name;
        setEditing(null);
        setFormData(EMPTY_FORM);
        setFeedback({
          type: 'success',
          text: res.message || `Normal ranges updated for ${savedName}.`
        });
        // Refetch — the backend response/list stays the source of truth.
        setReloadKey((key) => key + 1);
      } else {
        setFormErrors({ api: res?.message || 'Failed to save normal ranges.' });
      }
    } catch (err) {
      // Entered values are untouched — the user can correct and retry.
      const data = err?.response?.data;
      const fieldErrors = data?.errors;
      const nextErrors = {};
      let apiMessage = getApiErrorMessage(err, 'Failed to save normal ranges. Please try again.');
      if (fieldErrors && typeof fieldErrors === 'object') {
        const external = [];
        Object.entries(fieldErrors).forEach(([field, message]) => {
          if (Object.prototype.hasOwnProperty.call(EMPTY_FORM, field)) {
            nextErrors[field] = message;
          } else {
            external.push(message);
          }
        });
        if (external.length) apiMessage = `${apiMessage} ${external.join(' ')}`;
      }
      nextErrors.api = apiMessage;
      setFormErrors(nextErrors);
    } finally {
      setSaving(false);
    }
  };

  const hasFilters = Boolean(
    debouncedSearch.trim() || categoryFilter || statusFilter || genderFilter
  );

  // The API has no sex filter parameter, so this filter runs client-side on
  // the already-fetched (server-filtered) list.
  const visibleTests = genderFilter
    ? tests.filter((test) => (test.sexApplicable || 'Any') === genderFilter)
    : tests;

  const headers = [
    'Test',
    'Category',
    'Unit',
    'Reference Range',
    'Normal Range',
    'Critical Range',
    'Age Range',
    'Gender',
    'Status',
    ...(canEdit ? ['Actions'] : [])
  ];

  const renderRow = (test) => (
    <tr key={test._id}>
      <td>
        <div className="nr-test-name">{test.name}</div>
        <div className="nr-sub">{test.code}</div>
      </td>
      <td>{test.category?.name || 'Uncategorized'}</td>
      <td className="nr-range">{test.unit || '—'}</td>
      <td className="nr-range" title={formatTextRange(test)}>
        {formatTextRange(test)}
      </td>
      <td className="nr-range">{formatNumericRange(test.normalLow, test.normalHigh)}</td>
      <td className="nr-range">{formatNumericRange(test.criticalLow, test.criticalHigh)}</td>
      <td className="nr-range">{formatNumericRange(test.ageMin, test.ageMax)}</td>
      <td>{test.sexApplicable || '—'}</td>
      <td>
        <StatusBadge status={test.status} />
      </td>
      {canEdit && (
        <td>
          <Button
            size="sm"
            variant="secondary"
            icon={<Edit2 size={14} />}
            aria-label={`Edit normal ranges for ${test.name}`}
            onClick={() => openEdit(test)}
          >
            Edit
          </Button>
        </td>
      )}
    </tr>
  );

  return (
    <div className="normal-ranges-page">
      <PageHeader
        title="Normal Range Management"
        subtitle="View and manage laboratory reference ranges stored on test master records."
        action={
          <Button
            variant="secondary"
            size="sm"
            icon={<RefreshCw size={16} />}
            onClick={refresh}
            disabled={loading}
          >
            Refresh
          </Button>
        }
      />

      {feedback && (
        <div className="nr-banner nr-banner-success" role="status">
          <CheckCircle2 size={16} aria-hidden="true" />
          <span>{feedback.text}</span>
        </div>
      )}

      {loadError ? (
        <div className="nr-banner nr-banner-error" role="alert">
          <AlertTriangle size={16} aria-hidden="true" />
          <span>{loadError}</span>
          <Button variant="secondary" size="sm" onClick={refresh}>
            Retry
          </Button>
        </div>
      ) : (
        <>
          <div className="nr-filters">
            <Select
              label="Category"
              name="categoryFilter"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              options={categories}
              placeholder="All categories"
            />
            <Select
              label="Status"
              name="statusFilter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={TEST_STATUS_OPTIONS}
              placeholder="All statuses"
            />
            <Select
              label="Gender"
              name="genderFilter"
              value={genderFilter}
              onChange={(e) => setGenderFilter(e.target.value)}
              options={SEX_APPLICABLE_OPTIONS}
              placeholder="All genders"
            />
          </div>

          <DataTable
            headers={headers}
            data={visibleTests}
            loading={loading}
            emptyTitle={hasFilters ? 'No matching results' : 'No normal ranges found'}
            emptyMessage={
              hasFilters
                ? 'No normal ranges match your current search or filters.'
                : 'No laboratory normal ranges are available yet. Ranges are stored on test records in the Test Master.'
            }
            searchValue={search}
            onSearchChange={(e) => setSearch(e.target.value)}
            searchPlaceholder="Search by test name or code..."
            renderRow={renderRow}
          />
        </>
      )}

      <Modal
        isOpen={!!editing}
        onClose={closeEdit}
        title="Edit Normal Ranges"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={closeEdit} disabled={saving}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSubmit} loading={saving}>
              Save Changes
            </Button>
          </>
        }
      >
        {editing && (
          <form className="nr-form" onSubmit={handleSubmit} noValidate>
            <div className="nr-context">
              <div>
                <span className="nr-context-label">Test</span>
                <span className="nr-context-value">
                  {editing.name} ({editing.code})
                </span>
              </div>
              <div>
                <span className="nr-context-label">Category</span>
                <span className="nr-context-value">
                  {editing.category?.name || 'Uncategorized'}
                </span>
              </div>
              <div>
                <span className="nr-context-label">Unit</span>
                <span className="nr-context-value">{editing.unit || '—'}</span>
              </div>
              <div>
                <span className="nr-context-label">Status</span>
                <span className="nr-context-value">
                  {editing.status ? <StatusBadge status={editing.status} /> : '—'}
                </span>
              </div>
            </div>
            <p className="nr-hint">
              Test identity, category, unit, and status are managed in Test Master. This
              form edits reference ranges only.
            </p>

            {formErrors.api && (
              <div className="nr-banner nr-banner-error" role="alert">
                <AlertTriangle size={16} aria-hidden="true" />
                <span>{formErrors.api}</span>
              </div>
            )}

            <section className="nr-form-section" aria-labelledby="nr-text-ranges-heading">
              <h3 id="nr-text-ranges-heading" className="nr-form-section-title">
                Reference range (text)
              </h3>
              <div className="nr-form-grid">
                <Input
                  label="Default"
                  name="referenceRange"
                  value={formData.referenceRange}
                  onChange={handleChange}
                  error={formErrors.referenceRange}
                />
                <Input
                  label="Male"
                  name="maleReferenceRange"
                  value={formData.maleReferenceRange}
                  onChange={handleChange}
                  error={formErrors.maleReferenceRange}
                />
                <Input
                  label="Female"
                  name="femaleReferenceRange"
                  value={formData.femaleReferenceRange}
                  onChange={handleChange}
                  error={formErrors.femaleReferenceRange}
                />
              </div>
            </section>

            <section className="nr-form-section" aria-labelledby="nr-normal-heading">
              <h3 id="nr-normal-heading" className="nr-form-section-title">
                Normal range (numeric)
              </h3>
              <div className="nr-form-grid">
                <Input
                  label="Normal Low"
                  name="normalLow"
                  type="number"
                  step="any"
                  value={formData.normalLow}
                  onChange={handleChange}
                  error={formErrors.normalLow}
                />
                <Input
                  label="Normal High"
                  name="normalHigh"
                  type="number"
                  step="any"
                  value={formData.normalHigh}
                  onChange={handleChange}
                  error={formErrors.normalHigh}
                />
              </div>
            </section>

            <section className="nr-form-section" aria-labelledby="nr-critical-heading">
              <h3 id="nr-critical-heading" className="nr-form-section-title">
                Critical range (numeric)
              </h3>
              <div className="nr-form-grid">
                <Input
                  label="Critical Low"
                  name="criticalLow"
                  type="number"
                  step="any"
                  value={formData.criticalLow}
                  onChange={handleChange}
                  error={formErrors.criticalLow}
                />
                <Input
                  label="Critical High"
                  name="criticalHigh"
                  type="number"
                  step="any"
                  value={formData.criticalHigh}
                  onChange={handleChange}
                  error={formErrors.criticalHigh}
                />
              </div>
            </section>

            <section
              className="nr-form-section"
              aria-labelledby="nr-applicability-heading"
            >
              <h3 id="nr-applicability-heading" className="nr-form-section-title">
                Age &amp; gender applicability
              </h3>
              <div className="nr-form-grid">
                <Input
                  label="Age From"
                  name="ageMin"
                  type="number"
                  step="any"
                  value={formData.ageMin}
                  onChange={handleChange}
                  error={formErrors.ageMin}
                />
                <Input
                  label="Age To"
                  name="ageMax"
                  type="number"
                  step="any"
                  value={formData.ageMax}
                  onChange={handleChange}
                  error={formErrors.ageMax}
                />
                <Select
                  label="Gender"
                  name="sexApplicable"
                  value={formData.sexApplicable}
                  onChange={handleChange}
                  options={SEX_APPLICABLE_OPTIONS}
                  placeholder=""
                  error={formErrors.sexApplicable}
                />
              </div>
            </section>
          </form>
        )}
      </Modal>
    </div>
  );
};

export default NormalRanges;
