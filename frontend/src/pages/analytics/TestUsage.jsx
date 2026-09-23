import React, { useState, useEffect } from 'react';
import { getTestUsage } from '../../services/analysisService';
import { toCsv, downloadCsvText } from '../../services/exportService';
import formatCurrency from '../../utils/formatCurrency';
import { PageHeader, Button, DatePicker, Select, DataTable, StatCard } from '../../components/common';
import usePagination from '../../hooks/usePagination';
import useDebounce from '../../hooks/useDebounce';
import { Download, ArrowUpDown, FlaskConical, Receipt, ShoppingCart, FileText } from 'lucide-react';
import './TestUsage.css';

const toISODate = (d) => d.toISOString().split('T')[0];
const defaultRange = () => {
  const today = new Date();
  const s = new Date(today);
  s.setDate(s.getDate() - 30);
  return { from: toISODate(s), to: toISODate(today) };
};

// Test Usage & Reorder Analytics — server-aggregated
// (GET /api/analysis/test-usage over BillItems in the window).
// Route: /analytics/test-usage.
const TestUsage = () => {
  const [range, setRange] = useState(defaultRange());
  const [sortDir, setSortDir] = useState('desc');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 500);
  const { page, limit, goToPage, setLimit } = usePagination(1, 20);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [rows, setRows] = useState([]);
  const [top, setTop] = useState([]);
  const [slowest, setSlowest] = useState([]);
  const [totals, setTotals] = useState({ orders: 0, revenue: 0, distinctTests: 0, bills: 0 });
  const [paginationInfo, setPaginationInfo] = useState({ total: 0, pages: 0 });

  const load = async () => {
    if (range.from > range.to) {
      setError('Start date is after end date.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await getTestUsage({
        from: range.from,
        to: range.to,
        search: debouncedSearch.trim() || undefined,
        sort: sortDir,
        page,
        limit,
      });
      if (res?.success) {
        const d = res.data || {};
        setRows(d.items || []);
        setTop(d.top || []);
        setSlowest(d.slowest || []);
        setTotals(d.totals || { orders: 0, revenue: 0, distinctTests: 0, bills: 0 });
        setPaginationInfo(d.pagination || { total: 0, pages: 0 });
      } else {
        setError(res?.message || 'Failed to load usage analytics');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load usage analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.from, range.to, sortDir, debouncedSearch, page, limit]);

  const handleExport = async () => {
    setExporting(true);
    try {
      // Page through the server aggregation to export the full window.
      const all = [];
      let p = 1;
      for (;;) {
        const res = await getTestUsage({
          from: range.from,
          to: range.to,
          search: debouncedSearch.trim() || undefined,
          sort: sortDir,
          page: p,
          limit: 200,
        });
        const items = res?.data?.items || [];
        all.push(...items);
        const pages = res?.data?.pagination?.pages || 1;
        if (p >= pages) break;
        p += 1;
      }
      const headers = ['Test', 'Code', 'Category', 'Orders', 'Est. Revenue'];
      const data = all.map((r) => [r.name, r.code || '—', r.category || '—', r.count, r.revenue]);
      downloadCsvText(toCsv(headers, data), `test_usage_${range.from}_${range.to}.csv`);
    } catch (err) {
      setError(err.response?.data?.message || 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="test-usage-page">
      <PageHeader
        title="Test Usage & Reorder Analytics"
        subtitle={`How often each test was ordered · ${range.from} → ${range.to}`}
        action={
          <Button variant="secondary" size="sm" onClick={handleExport} loading={exporting} disabled={paginationInfo.total === 0}>
            <Download size={14} /> Export CSV
          </Button>
        }
      />

      <div className="test-usage-filters">
        <DatePicker label="From" value={range.from} onChange={(e) => { setRange((r) => ({ ...r, from: e.target.value })); goToPage(1); }} />
        <DatePicker label="To" value={range.to} onChange={(e) => { setRange((r) => ({ ...r, to: e.target.value })); goToPage(1); }} />
        <Select
          label="Sort by usage"
          value={sortDir}
          onChange={(e) => { setSortDir(e.target.value); goToPage(1); }}
          options={[{ value: 'desc', label: 'Most used first' }, { value: 'asc', label: 'Least used first' }]}
          placeholder=""
        />
      </div>

      {error && (
        <div className="test-usage-alert error" role="alert">{error}</div>
      )}

      <div className="test-usage-kpis">
        <StatCard title="Total Orders" value={totals.orders} icon={ShoppingCart} color="var(--color-primary, #2563eb)" bgColor="var(--color-primary-light, #eff6ff)" />
        <StatCard title="Est. Revenue" value={formatCurrency(totals.revenue)} icon={Receipt} color="var(--color-success, #16a34a)" bgColor="var(--color-success-bg, #f0fdf4)" />
        <StatCard title="Tests Ordered" value={totals.distinctTests} icon={FlaskConical} color="var(--color-info, #0284c7)" bgColor="var(--color-info-bg, #f0f9ff)" />
        <StatCard title="Bills in Window" value={totals.bills} icon={FileText} color="var(--color-warning, #d97706)" bgColor="var(--color-warning-bg, #fffbeb)" />
      </div>

      <div className="test-usage-split">
        <section className="test-usage-card" aria-label="Reorder suggestions">
          <h4 className="test-usage-card-title">Reorder suggestions</h4>
          {top.filter((t) => t.count > 0).length === 0 ? (
            <p className="test-usage-muted">No orders in this window — nothing to restock.</p>
          ) : (
            <ul className="test-usage-list">
              {top.filter((t) => t.count > 0).map((t) => (
                <li key={t.testId}>
                  <strong>{t.name}</strong> ({t.count} orders) — high demand, verify reagent/consumable stock.
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="test-usage-card" aria-label="Slowest moving">
          <h4 className="test-usage-card-title">Slowest-moving</h4>
          {slowest.length === 0 ? (
            <p className="test-usage-muted">No usage in this window.</p>
          ) : (
            <ul className="test-usage-list">
              {slowest.map((t) => (
                <li key={t.testId}>
                  <strong>{t.name}</strong> ({t.count} orders)
                  {t.count === 0 ? ' — no demand in window; review listing or pricing.' : ' — low uptake; check referral trends.'}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <DataTable
        headers={['Test', 'Code', 'Category', 'Orders', 'Est. Revenue']}
        data={rows}
        loading={loading}
        emptyMessage="No tests match this window."
        searchValue={search}
        onSearchChange={(e) => { setSearch(e.target.value); goToPage(1); }}
        searchPlaceholder="Search name or code…"
        pagination={{
          total: paginationInfo.total,
          page,
          limit,
          pages: paginationInfo.pages,
          onPageChange: goToPage,
          onLimitChange: setLimit,
        }}
        toolbarActions={
          <Button variant="secondary" size="sm" onClick={() => { setSortDir((d) => (d === 'desc' ? 'asc' : 'desc')); goToPage(1); }}>
            <ArrowUpDown size={14} /> {sortDir === 'desc' ? 'Most used' : 'Least used'}
          </Button>
        }
        renderRow={(r) => (
          <tr key={r.testId}>
            <td style={{ fontWeight: '600' }}>{r.name}</td>
            <td style={{ textAlign: 'center' }}>{r.code || '—'}</td>
            <td style={{ textAlign: 'center' }}>{r.category || '—'}</td>
            <td style={{ textAlign: 'center', fontWeight: '700' }}>{r.count}</td>
            <td style={{ textAlign: 'right' }}>{formatCurrency(r.revenue)}</td>
          </tr>
        )}
      />
      {paginationInfo.total > 0 && (
        <p className="test-usage-footnote">Revenue is estimated from billed item prices × order counts in the window.</p>
      )}
    </div>
  );
};

export default TestUsage;
