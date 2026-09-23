import React, { useState, useEffect, useCallback } from 'react';
import { getBills } from '../../services/billService';
import { getTests } from '../../services/testService';
import { getReports } from '../../services/reportService';
import { toCsv, downloadCsvText } from '../../services/exportService';
import formatCurrency from '../../utils/formatCurrency';
import { PageHeader, Button, DatePicker, Select, DataTable } from '../../components/common';
import { Download, AlertTriangle, ArrowUpDown } from 'lucide-react';

const toISODate = (d) => d.toISOString().split('T')[0];
const defaultRange = () => {
  const today = new Date();
  const s = new Date(today);
  s.setDate(s.getDate() - 30);
  return { from: toISODate(s), to: toISODate(today) };
};

// Page size per client-side fetch; large windows are paged through
// sequentially because no server aggregation exists.
const PAGE_LIMIT = 200;
const MAX_PAGES = 10;

// Phase 28 — Test Usage & Reorder Analytics.
// Computed client-side from GET /api/reports (per-test attribution; the bill
// list does not populate items) + GET /api/tests (catalog/rates) + GET
// /api/bills (window totals). Route: /analytics/test-usage.
const TestUsage = () => {
  const [range, setRange] = useState(defaultRange());
  const [sortDir, setSortDir] = useState('desc');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rows, setRows] = useState([]);
  const [billTotal, setBillTotal] = useState(null);
  const [truncated, setTruncated] = useState(false);

  const load = useCallback(async () => {
    if (range.from > range.to) {
      setError('Start date is after end date.');
      return;
    }
    setLoading(true);
    setError('');
    setTruncated(false);
    try {
      const [testsRes, billsRes] = await Promise.all([
        getTests({ status: 'Active' }),
        getBills({ startDate: range.from, endDate: range.to, limit: 1 }),
      ]);
      const catalog = Array.isArray(testsRes?.data) ? testsRes.data : testsRes?.data?.tests || [];
      if (billsRes?.success || billsRes?.data) {
        setBillTotal(billsRes?.data?.pagination?.total ?? (Array.isArray(billsRes?.data?.bills) ? billsRes.data.bills.length : null));
      }

      // Page through reports in the window for per-test counts.
      const counts = {};
      let capped = false;
      for (let page = 1; page <= MAX_PAGES; page += 1) {
        const res = await getReports({ from: range.from, to: range.to, limit: PAGE_LIMIT, page });
        const list = res?.data?.reports || res?.reports || [];
        const pagination = res?.data?.pagination || res?.pagination;
        for (const r of list) {
          // A report may carry a single test or a results array.
          const candidates = [];
          if (r.test?._id || r.test?.name) candidates.push(r.test);
          else if (typeof r.test === 'string' && r.test) candidates.push({ _id: r.test });
          for (const row of r.results || []) {
            if (row.test?._id || row.test?.name) candidates.push(row.test);
            else if (typeof row.test === 'string' && row.test) candidates.push({ _id: row.test });
            else if (row.testName) candidates.push({ name: row.testName });
          }
          const seen = new Set();
          for (const c of candidates) {
            const key = String(c._id || c.name || '');
            if (!key || seen.has(key)) continue;
            seen.add(key);
            counts[key] = counts[key] || { count: 0, name: c.name || key, code: c.code || '' };
            counts[key].count += 1;
            if (c.name) counts[key].name = c.name;
            if (c.code) counts[key].code = c.code;
          }
        }
        const totalPages = pagination?.pages;
        if (!totalPages || page >= totalPages) break;
        if (page === MAX_PAGES) capped = true;
      }
      setTruncated(capped);

      const byId = {};
      for (const t of catalog) {
        byId[String(t._id)] = t;
      }
      const merged = catalog.map((t) => {
        const key = String(t._id);
        const hit = counts[key];
        const count = hit ? hit.count : 0;
        const rate = Number(t.rate ?? t.price ?? 0);
        return {
          id: key,
          name: t.name,
          code: t.code || '—',
          department: t.department || '—',
          count,
          revenue: count * rate,
        };
      });
      // Reports referencing tests outside the active catalog (deactivated).
      for (const [key, hit] of Object.entries(counts)) {
        if (!byId[key]) {
          merged.push({ id: key, name: hit.name, code: hit.code || '—', department: '—', count: hit.count, revenue: 0 });
        }
      }
      setRows(merged);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load usage analytics');
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = rows
    .filter((r) => {
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return r.name?.toLowerCase().includes(q) || r.code?.toLowerCase().includes(q);
    })
    .sort((a, b) => (sortDir === 'desc' ? b.count - a.count : a.count - b.count));

  const slowest = [...rows].sort((a, b) => a.count - b.count).slice(0, 5);
  const top = [...rows].sort((a, b) => b.count - a.count).slice(0, 5);

  const handleExport = () => {
    const headers = ['Test', 'Code', 'Department', 'Orders', 'Est. Revenue'];
    const data = filtered.map((r) => [r.name, r.code, r.department, r.count, r.revenue]);
    downloadCsvText(toCsv(headers, data), `test_usage_${range.from}_${range.to}.csv`);
  };

  return (
    <div>
      <PageHeader
        title="Test Usage & Reorder Analytics"
        subtitle="How often each test was ordered in the window, and what to restock"
      />

      <div className="card" style={{ borderLeft: '4px solid var(--color-warning, #d97706)', marginBottom: '1rem', fontSize: '0.85rem' }}>
        <AlertTriangle size={14} /> Server aggregation (GET /api/analysis/test-usage) does not exist, and there is
        no inventory model on the backend — so usage is aggregated in the browser from report/test records and large
        ranges are paged client-side ({PAGE_LIMIT}/page, up to {MAX_PAGES * PAGE_LIMIT} reports). Reorder hints are
        heuristics, not stock levels.
      </div>

      <div className="card" style={{ marginBottom: '1.5rem', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <DatePicker label="From" value={range.from} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} />
        <DatePicker label="To" value={range.to} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} />
        <Select
          label="Sort by usage"
          value={sortDir}
          onChange={(e) => setSortDir(e.target.value)}
          options={[{ value: 'desc', label: 'Most used first' }, { value: 'asc', label: 'Least used first' }]}
          placeholder=""
          style={{ minWidth: '170px' }}
        />
        <div style={{ flex: 1, minWidth: '180px' }}>
          <label style={{ fontSize: '0.78rem', fontWeight: '600', display: 'block', marginBottom: '4px' }}>Search tests</label>
          <input className="input-control" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name or code…" style={{ width: '100%' }} />
        </div>
        <Button variant="primary" size="sm" onClick={load} loading={loading}>Apply</Button>
        <Button variant="secondary" size="sm" onClick={handleExport} disabled={!filtered.length}>
          <Download size={14} /> Export CSV
        </Button>
      </div>

      {error && (
        <div className="card" style={{ borderLeft: '4px solid var(--color-danger, #dc2626)', marginBottom: '1rem', fontSize: '0.85rem' }}>
          {error}
        </div>
      )}

      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
        {billTotal !== null && <>Bills in window: <strong>{billTotal}</strong> · </>}
        Tests tracked: <strong>{rows.length}</strong>
        {truncated && <> · window truncated at {MAX_PAGES * PAGE_LIMIT} reports — narrow the dates for exact counts</>}
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
        <div className="card">
          <h4 style={{ fontWeight: '700', fontSize: '0.95rem', marginBottom: '0.5rem' }}>Reorder suggestions</h4>
          {top.every((t) => t.count === 0) ? (
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>No orders in this window — nothing to restock.</p>
          ) : (
            <ul style={{ fontSize: '0.83rem', margin: 0, paddingLeft: '1.1rem', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {top.filter((t) => t.count > 0).map((t) => (
                <li key={t.id}>
                  <strong>{t.name}</strong> ({t.count} orders) — high demand, verify reagent/consumable stock.
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="card">
          <h4 style={{ fontWeight: '700', fontSize: '0.95rem', marginBottom: '0.5rem' }}>Slowest-moving</h4>
          {slowest.length === 0 ? (
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>No tests in catalog.</p>
          ) : (
            <ul style={{ fontSize: '0.83rem', margin: 0, paddingLeft: '1.1rem', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {slowest.map((t) => (
                <li key={t.id}>
                  <strong>{t.name}</strong> ({t.count} orders)
                  {t.count === 0 ? ' — no demand in window; review listing or pricing.' : ' — low uptake; check referral trends.'}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="card">
        <DataTable
          headers={['Test', 'Code', 'Department', 'Orders', 'Est. Revenue']}
          data={filtered}
          loading={loading}
          emptyMessage="No tests match this window."
          toolbarActions={
            <Button variant="secondary" size="sm" onClick={() => setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))}>
              <ArrowUpDown size={14} /> {sortDir === 'desc' ? 'Most used' : 'Least used'}
            </Button>
          }
          renderRow={(r) => (
            <tr key={r.id}>
              <td style={{ fontWeight: '600' }}>{r.name}</td>
              <td style={{ textAlign: 'center' }}>{r.code}</td>
              <td style={{ textAlign: 'center' }}>{r.department}</td>
              <td style={{ textAlign: 'center', fontWeight: '700' }}>{r.count}</td>
              <td style={{ textAlign: 'right' }}>{formatCurrency(r.revenue)}</td>
            </tr>
          )}
        />
        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '8px' }}>
          Revenue is estimated from current catalog rates × order counts. Export uses the Phase-26 CSV serializer.
        </p>
      </div>
    </div>
  );
};

export default TestUsage;
