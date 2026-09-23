import React, { useState, useEffect, useMemo } from 'react';
import { getTests, updateTestRate, bulkUpdateTestRates } from '../../services/testService';
import formatCurrency from '../../utils/formatCurrency';
import { DataTable, PageHeader, Button, Input, Select, ConfirmDialog } from '../../components/common';
import { usePermissions } from '../../hooks/usePermission';

const RateRevision = () => {
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState([]);
  const [mode, setMode] = useState('percent'); // 'percent' | 'absolute'
  const [amount, setAmount] = useState('');
  const [effectiveDate, setEffectiveDate] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [applying, setApplying] = useState(false);
  const [singleUpdating, setSingleUpdating] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const { can } = usePermissions();
  const canRates = can('rates') || can('settings');

  const fetchTests = async () => {
    setLoading(true);
    try {
      const res = await getTests({ status: 'Active' });
      if (res.success) setTests(res.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load tests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTests(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tests;
    return tests.filter((t) =>
      t.name?.toLowerCase().includes(q) || t.code?.toLowerCase().includes(q) ||
      String(t.price).includes(q) || t.category?.name?.toLowerCase().includes(q));
  }, [tests, search]);

  const newPriceFor = (price) => {
    const base = Number(price);
    const delta = Number(amount);
    if (isNaN(delta)) return null;
    const next = mode === 'percent' ? base * (1 + delta / 100) : base + delta;
    return Math.max(0, Math.round(next * 100) / 100);
  };

  const preview = useMemo(() => {
    if (amount === '' || isNaN(Number(amount))) return [];
    return tests
      .filter((t) => selected.includes(t._id))
      .map((t) => ({ ...t, newPrice: newPriceFor(t.price) }))
      .filter((t) => t.newPrice !== null);
  }, [tests, selected, amount, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (id) => setSelected((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  const toggleAll = () => setSelected((prev) => (filtered.length > 0 && filtered.every((t) => prev.includes(t._id)) ? prev.filter((id) => !filtered.some((t) => t._id === id)) : [...new Set([...prev, ...filtered.map((t) => t._id)])]));

  const validate = () => {
    if (selected.length === 0) return 'Select at least one test';
    if (amount === '' || isNaN(Number(amount))) return 'Enter a valid revision amount';
    if (mode === 'percent' && Number(amount) <= -100) return 'Percent change must be greater than -100%';
    if (preview.some((t) => t.newPrice < 0)) return 'Revision would make a price negative';
    return '';
  };

  const handleBulkApply = async () => {
    const err = validate();
    if (err) { setError(err); return; }
    setApplying(true);
    setError('');
    try {
      const res = await bulkUpdateTestRates(preview.map((t) => ({ id: t._id, price: t.newPrice })));
      // Atomic result counts from PUT /api/tests/bulk-rate-update
      const counts = res.data || {};
      setResult({
        ok: counts.ok ?? 0,
        failed: counts.failed ?? 0,
        errors: counts.errors || [],
        effectiveDate: effectiveDate || null
      });
      setConfirmOpen(false);
      setSelected([]);
      fetchTests();
    } catch (err) {
      setError(err.response?.data?.message || 'Bulk rate update failed');
      setConfirmOpen(false);
    } finally {
      setApplying(false);
    }
  };

  const handleSingleApply = async (test, price) => {
    const next = Number(price);
    if (isNaN(next) || next < 0) { setError(`Invalid price for ${test.code}`); return; }
    setSingleUpdating(test._id);
    try {
      const res = await updateTestRate(test._id, next);
      if (res.success) fetchTests();
    } catch (err) {
      setError(err.response?.data?.message || `Failed to update ${test.code}`);
    } finally {
      setSingleUpdating(null);
    }
  };

  return (
    <div>
      <PageHeader
        title="Rate Revision"
        subtitle="Bulk revise test rates with preview — effective date is display-only"
      />
      {!canRates && (
        <p style={{ fontSize: '0.82rem', color: 'var(--color-warning, #a16207)', marginBottom: '1rem' }}>
          Your role has no rates permission — preview is visible but applying is hidden (server still enforces).
        </p>
      )}

      {error && (
        <div style={{ padding: '12px', backgroundColor: 'var(--color-danger-bg)', color: 'var(--color-danger)', borderRadius: '8px', marginBottom: '16px' }}>
          {error}
        </div>
      )}

      {result && (
        <div style={{ padding: '12px', backgroundColor: '#dcfce7', color: '#166534', borderRadius: '8px', marginBottom: '16px' }}>
          <strong>Bulk apply complete:</strong> {result.ok} updated, {result.failed} failed.
          {result.effectiveDate && <span> Display effective date: {result.effectiveDate}.</span>}
          {result.errors.length > 0 && (
            <ul style={{ margin: '8px 0 0', paddingLeft: '18px' }}>
              {result.errors.slice(0, 10).map((e, i) => <li key={i}>{e.id}: {e.error}</li>)}
            </ul>
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '16px' }}>
        <div style={{ flex: 1, minWidth: '160px' }}>
          <Input label="Search tests" name="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Code / name / department" />
        </div>
        <div style={{ flex: 1, minWidth: '140px' }}>
          <Select label="Revision mode" name="mode" value={mode} onChange={(e) => setMode(e.target.value)}
            options={[{ value: 'percent', label: 'Percent (%)' }, { value: 'absolute', label: 'Absolute (₹)' }]} />
        </div>
        <div style={{ flex: 1, minWidth: '140px' }}>
          <Input label={mode === 'percent' ? 'Change % (+/-)' : 'Change ₹ (+/-)'} name="amount" type="number" step="any"
            value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={mode === 'percent' ? 'e.g. 10 or -5' : 'e.g. 50 or -20'} />
        </div>
        <div style={{ flex: 1, minWidth: '160px' }}>
          <Input label="Effective date (display only)" name="effectiveDate" type="date"
            value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)}
            helperText="Client-side only — not enforced by the backend" />
        </div>
      </div>

      {/* Impact preview */}
      <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '12px', marginBottom: '16px' }}>
        <h4 style={{ margin: '0 0 8px' }}>Impact preview — {preview.length} test{preview.length === 1 ? '' : 's'} affected</h4>
        {preview.length === 0 ? (
          <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', margin: 0 }}>
            Select tests below and enter a revision amount to preview before/after rates.
          </p>
        ) : (
          <div style={{ maxHeight: '220px', overflowY: 'auto' }}>
            <table style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>
                  <th>Code</th><th>Name</th><th>Before</th><th>After</th><th>Δ</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((t) => (
                  <tr key={t._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ fontWeight: 600 }}>{t.code}</td>
                    <td>{t.name}</td>
                    <td>{formatCurrency(t.price)}</td>
                    <td style={{ fontWeight: 600 }}>{formatCurrency(t.newPrice)}</td>
                    <td style={{ color: t.newPrice >= t.price ? '#166534' : '#991b1b' }}>
                      {t.newPrice >= t.price ? '+' : ''}{formatCurrency(t.newPrice - t.price)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
          <Button variant="primary" disabled={preview.length === 0 || applying} onClick={() => setConfirmOpen(true)}>
            Review & apply to {preview.length} test{preview.length === 1 ? '' : 's'}
          </Button>
        </div>
      </div>

      <DataTable
        headers={['Select', 'Code', 'Name', 'Department', 'Current Rate', 'New Rate', 'Action']}
        data={filtered}
        loading={loading}
        emptyMessage="No tests found."
        renderRow={(test) => {
          const isSel = selected.includes(test._id);
          const next = isSel ? newPriceFor(test.price) : null;
          return (
            <tr key={test._id}>
              <td><input type="checkbox" checked={isSel} onChange={() => toggle(test._id)} aria-label={`Select ${test.code}`} /></td>
              <td style={{ fontWeight: '600', color: 'var(--primary-color)' }}>{test.code}</td>
              <td style={{ fontWeight: '600' }}>{test.name}</td>
              <td>{test.category?.name || 'Uncategorized'}</td>
              <td>{formatCurrency(test.price)}</td>
              <td style={{ fontWeight: '600' }}>{next !== null && !isNaN(next) ? formatCurrency(next) : '—'}</td>
              <td>
                <Button
                  variant="secondary"
                  disabled={!isSel || next === null || isNaN(next) || singleUpdating === test._id}
                  loading={singleUpdating === test._id}
                  onClick={() => handleSingleApply(test, next)}
                >
                  Apply single
                </Button>
              </td>
            </tr>
          );
        }}
      />
      <div style={{ marginTop: '8px' }}>
        <Button variant="secondary" onClick={toggleAll}>Toggle select all (filtered)</Button>
      </div>

      <ConfirmDialog
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleBulkApply}
        loading={applying}
        title="Apply bulk rate revision?"
        message={`${preview.length} test(s) will be updated via PUT /api/tests/bulk-rate-update${effectiveDate ? ` (display effective date ${effectiveDate})` : ''}. This cannot be undone automatically.`}
      />
    </div>
  );
};

export default RateRevision;
