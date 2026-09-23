import React, { useState, useEffect, useMemo } from 'react';
import { getTests, updateTest } from '../../services/testService';
import { PageHeader, Button, Input, DataTable } from '../../components/common';
import useClientPagination from '../../hooks/useClientPagination';
import { TAT_CONFIG_KEY, DEFAULT_TAT_SETTINGS, loadTatSettings } from '../../components/lab/TatCountdown';

// Phase 16 — TAT Configuration Screen.
//
// Persistence note: there is NO backend default-TAT config endpoint, so lab
// defaults + thresholds below are stored in localStorage (key `ppl.tatConfig`)
// and consumed by TatCountdown / the report worklist on this machine.
// Per-test TAT IS persisted server-side via PUT /api/tests/:id (`tatHours`
// on the Test model) and applies to every client immediately.

const NUMBER_FIELDS = [
  { key: 'defaultTatHours', label: 'Default TAT (hours)', hint: 'Used for new reports when the test has no per-test TAT.' },
  { key: 'emergencyTatHours', label: 'Emergency TAT (hours)', hint: 'Reference for urgent orders (stored for future use).' },
  { key: 'dueSoonHours', label: 'Due-soon threshold (hours)', hint: 'Countdown shows “Due soon” when this much time is left.' },
  { key: 'urgentHours', label: 'Urgent window (hours)', hint: '“Due” worklist tab lists reports due within this window.' },
];

const TatConfig = () => {
  const [form, setForm] = useState({ ...DEFAULT_TAT_SETTINGS });
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [formError, setFormError] = useState('');

  const [tests, setTests] = useState([]);
  const [testsLoading, setTestsLoading] = useState(false);
  const [testsError, setTestsError] = useState('');
  const [testSearch, setTestSearch] = useState('');
  const [tatDrafts, setTatDrafts] = useState({});
  const [savingTestId, setSavingTestId] = useState(null);

  useEffect(() => {
    setForm(loadTatSettings());
  }, []);

  const fetchTests = async () => {
    setTestsLoading(true);
    setTestsError('');
    try {
      const res = await getTests({ status: 'Active' });
      if (res.success) setTests(res.data || []);
    } catch (err) {
      setTestsError(err.response?.data?.message || 'Failed to load tests');
    } finally {
      setTestsLoading(false);
    }
  };

  useEffect(() => { fetchTests(); }, []);

  const set = (key, value) => {
    setForm((s) => ({ ...s, [key]: value }));
    setDirty(true);
    setMsg('');
  };

  const validate = () => {
    for (const { key, label } of NUMBER_FIELDS) {
      const n = Number(form[key]);
      if (!Number.isFinite(n) || n <= 0) return `${label} must be a positive number`;
    }
    if (Number(form.dueSoonHours) > Number(form.urgentHours)) {
      return 'Due-soon threshold must be ≤ the urgent window (due-soon < urgent ordering)';
    }
    return '';
  };

  const save = (e) => {
    e.preventDefault();
    const err = validate();
    setFormError(err);
    if (err) return;
    setSaving(true);
    try {
      const payload = {
        defaultTatHours: Number(form.defaultTatHours),
        emergencyTatHours: Number(form.emergencyTatHours),
        dueSoonHours: Number(form.dueSoonHours),
        urgentHours: Number(form.urgentHours),
      };
      localStorage.setItem(TAT_CONFIG_KEY, JSON.stringify(payload));
      setForm(payload);
      setDirty(false);
      setMsg('TAT defaults saved on this device. They apply to new countdowns immediately; existing reports keep their own TAT.');
    } catch {
      setFormError('Could not persist settings in this browser');
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    setForm({ ...DEFAULT_TAT_SETTINGS });
    setFormError('');
    setDirty(true);
    setMsg('');
  };

  const filteredTests = useMemo(() => {
    const q = testSearch.trim().toLowerCase();
    if (!q) return tests;
    return tests.filter((t) => `${t.name || ''} ${t.code || ''}`.toLowerCase().includes(q));
  }, [tests, testSearch]);

  // Client-side pagination over the filtered test list.
  const pg = useClientPagination(filteredTests, 10);

  const draftFor = (test) => tatDrafts[test._id] ?? (test.tatHours ?? '');

  // Inline per-test TAT save. The update endpoint validates the full test
  // payload, so required fields travel along with the new tatHours.
  const saveTestTat = async (test) => {
    const raw = draftFor(test);
    const tatHours = raw === '' || raw === null ? null : Number(raw);
    if (tatHours !== null && (!Number.isFinite(tatHours) || tatHours <= 0)) {
      alert('TAT must be a positive number of hours (or empty to use the lab default)');
      return;
    }
    setSavingTestId(test._id);
    try {
      const payload = {
        name: test.name,
        code: test.code,
        category: test.category?._id || test.category,
        sampleType: test.sampleType,
        price: test.price,
        tatHours,
      };
      const res = await updateTest(test._id, payload);
      if (res.success) {
        setTests((prev) => prev.map((t) => (t._id === test._id ? { ...t, tatHours } : t)));
        setTatDrafts((prev) => {
          const next = { ...prev };
          delete next[test._id];
          return next;
        });
        setMsg(`TAT saved for ${test.name} (${tatHours === null ? 'lab default' : `${tatHours}h`}). Applies to new reports only.`);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to save per-test TAT');
    } finally {
      setSavingTestId(null);
    }
  };

  return (
    <div>
      <PageHeader
        title="TAT Configuration"
        subtitle="Default turnaround time, urgency thresholds and per-test TAT"
      />
      {msg && <p style={{ fontSize: '0.85rem', color: 'green' }}>{msg}</p>}
      {formError && <p style={{ fontSize: '0.85rem', color: 'red' }}>{formError}</p>}

      <form onSubmit={save} className="form-grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12, marginBottom: '1rem' }}>
        {NUMBER_FIELDS.map(({ key, label, hint }) => (
          <div key={key}>
            <Input
              label={label}
              type="number"
              min="0"
              step="0.5"
              value={form[key] ?? ''}
              onChange={(e) => set(key, e.target.value)}
            />
            <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>{hint}</p>
          </div>
        ))}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
          <Button type="submit" loading={saving} disabled={!dirty}>Save Defaults</Button>
          <Button variant="secondary" onClick={reset}>Reset</Button>
        </div>
      </form>
      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
        Defaults below are kept on this device. Per-test values are saved centrally and take precedence.
      </p>

      <h3 style={{ fontSize: '0.95rem', marginBottom: '0.5rem' }}>Per-test TAT (hours)</h3>
      {testsError && <p style={{ fontSize: '0.85rem', color: 'red' }}>{testsError}</p>}
      <DataTable
        headers={['Test', 'Code', 'TAT (h)', 'Effective', 'Actions']}
        data={pg.paged}
        loading={testsLoading}
        emptyMessage="No active tests found."
        searchValue={testSearch}
        onSearchChange={(e) => { setTestSearch(e.target.value); pg.reset(); }}
        searchPlaceholder="Search tests…"
        pagination={{
          total: pg.total,
          page: pg.page,
          limit: pg.limit,
          pages: pg.pages,
          onPageChange: pg.goToPage,
          onLimitChange: pg.setLimit,
        }}
        renderRow={(test) => {
          const effective = test.tatHours ?? form.defaultTatHours;
          return (
            <tr key={test._id}>
              <td style={{ fontWeight: '600' }}>{test.name}</td>
              <td>{test.code}</td>
              <td style={{ maxWidth: '120px' }}>
                <Input
                  type="number"
                  min="0"
                  step="0.5"
                  placeholder={`Default (${form.defaultTatHours}h)`}
                  value={draftFor(test)}
                  onChange={(e) => setTatDrafts((prev) => ({ ...prev, [test._id]: e.target.value }))}
                />
              </td>
              <td style={{ fontSize: '0.8rem' }}>{effective}h{test.tatHours == null ? ' (default)' : ''}</td>
              <td>
                <Button
                  variant="secondary"
                  size="sm"
                  loading={savingTestId === test._id}
                  onClick={() => saveTestTat(test)}
                >
                  Save
                </Button>
              </td>
            </tr>
          );
        }}
      />
    </div>
  );
};

export default TatConfig;
