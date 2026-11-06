import React, { useEffect, useMemo, useState } from 'react';
import { Printer, RefreshCw } from 'lucide-react';
import { getTestUsage } from '../../../services/analysisService';
import { toCsv, downloadCsvText } from '../../../services/exportService';
import { PageHeader, Button, StatGroup } from '../../../components/common';
import PeriodBar, { presetRange } from '../../../components/business/PeriodBar';
import DownloadMenu from '../../../components/business/DownloadMenu';
import ReportTable from '../../../components/business/ReportTable';
import printReport, { fetchAllPages } from '../../../utils/printReport';
import { money, periodLabel, sum } from '../../../utils/reportFormat';
import '../../../components/business/business.css';
import './testUsageV2.css';

const cleanName = (name) => String(name || '').replace(/\s*\(bundle\)\s*$/i, '').trim();

// Test usage (new look): which tests are ordered most (keep stock) and
// which are hardly ordered (review), for a period.
export default function TestUsageV2() {
  const [[from, to], setRange] = useState(() => presetRange('days30'));
  const [items, setItems] = useState([]);
  const [top, setTop] = useState([]);
  const [slowest, setSlowest] = useState([]);
  const [totals, setTotals] = useState({ orders: 0, revenue: 0, distinctTests: 0, bills: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [order, setOrder] = useState('most');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError('');
    let first = null;
    fetchAllPages(async (page, limit) => {
      const res = await getTestUsage({ from, to, sort: 'desc', page, limit });
      if (!first) first = res?.data || {};
      return { items: res?.data?.items || [], pages: res?.data?.pagination?.pages || 1 };
    }, { pageSize: 200 }).then((all) => {
      if (cancelled) return;
      setItems(all);
      setTop((first?.top || []).filter((t) => t.count > 0));
      setSlowest(first?.slowest || []);
      setTotals(first?.totals || { orders: 0, revenue: 0, distinctTests: 0, bills: 0 });
    }).catch((err) => { if (!cancelled) setError(err.response?.data?.message || 'Could not load test usage for this period.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [from, to, reload]);

  const maxTop = Math.max(1, ...top.map((t) => t.count));
  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q ? items.filter((r) => `${r.name} ${r.code || ''} ${r.category || ''}`.toLowerCase().includes(q)) : items;
    return [...list].sort((a, b) => (order === 'most' ? b.count - a.count : a.count - b.count));
  }, [items, search, order]);

  const print = () => printReport({
    title: 'Test usage',
    period: periodLabel(from, to),
    summary: [
      { label: 'Orders', value: String(totals.orders) },
      { label: 'Different tests', value: String(totals.distinctTests) },
      { label: 'Bills', value: String(totals.bills) },
      { label: 'Billed for tests', value: money(totals.revenue) },
    ],
    sections: [
      { title: 'Most ordered - keep in stock', columns: [{ label: 'Test' }, { label: 'Orders', align: 'right' }], rows: top.map((t) => [cleanName(t.name), String(t.count)]), empty: 'No orders in this period.' },
      { title: 'Least ordered - review', columns: [{ label: 'Test' }, { label: 'Orders', align: 'right' }], rows: slowest.map((t) => [cleanName(t.name), String(t.count)]) },
      { title: 'All tests', columns: [{ label: 'Test' }, { label: 'Code' }, { label: 'Category' }, { label: 'Orders', align: 'right' }, { label: 'Billed', align: 'right' }], rows: shown.map((r) => [cleanName(r.name), r.code || '', r.category || '', String(r.count), money(r.revenue)]), totals: ['Total', '', '', String(sum(shown, (r) => r.count)), money(sum(shown, (r) => r.revenue))] },
    ],
  });

  const download = () => downloadCsvText(
    toCsv(['Test', 'Code', 'Category', 'Orders', 'Billed'], shown.map((r) => [cleanName(r.name), r.code || '', r.category || '', r.count, r.revenue])),
    `test-usage-${from}-${to}.csv`,
  );

  return (
    <div className="biz-page">
      <PageHeader
        title="Test usage"
        subtitle="Which tests are ordered most (keep their reagents and kits in stock) and which are hardly ordered."
        action={
          <div className="biz-actions">
            <Button variant="secondary" size="sm" icon={<RefreshCw size={14} />} onClick={() => setReload((n) => n + 1)}>Refresh</Button>
            <Button variant="secondary" size="sm" icon={<Printer size={14} />} onClick={print} disabled={loading}>Print</Button>
            <DownloadMenu items={[{ label: 'All tests (CSV)', onClick: download }]} />
          </div>
        }
      />

      <PeriodBar from={from} to={to} onChange={({ from: a, to: b }) => setRange([a, b])} presets={['week', 'days30', 'month', 'lastMonth']} />

      {error && <div className="biz-error" role="alert">{error}<Button variant="secondary" size="sm" onClick={() => setReload((n) => n + 1)}>Try again</Button></div>}

      <StatGroup loading={loading} items={[
        { label: 'Orders', value: String(totals.orders), hint: 'Tests ordered in the period' },
        { label: 'Different tests', value: String(totals.distinctTests), hint: 'Ordered at least once' },
        { label: 'Bills', value: String(totals.bills) },
        { label: 'Billed for tests', value: money(totals.revenue), hint: 'Price x orders' },
      ]} />

      <div className="tu-split">
        <section className="biz-section" aria-label="Most ordered">
          <div className="biz-section-head">
            <h2>Most ordered</h2>
            <p>Keep reagents and kits for these in stock.</p>
          </div>
          <div className="tu-card">
            {top.length === 0 ? (
              <p className="tu-empty">{loading ? 'Loading...' : 'No tests were ordered in this period.'}</p>
            ) : (
              <ol className="tu-rank">
                {top.map((t, i) => (
                  <li key={t.testId}>
                    <span className="tu-rank-no">{i + 1}</span>
                    <span className="tu-rank-name">{cleanName(t.name)}</span>
                    <span className="tu-bar" aria-hidden="true"><span style={{ width: `${Math.round((t.count / maxTop) * 100)}%` }} /></span>
                    <span className="tu-rank-count">{t.count} <small>order{t.count === 1 ? '' : 's'}</small></span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </section>

        <section className="biz-section" aria-label="Least ordered">
          <div className="biz-section-head">
            <h2>Least ordered</h2>
            <p>Worth a look: keep, re-price or promote?</p>
          </div>
          <div className="tu-card">
            {slowest.length === 0 ? (
              <p className="tu-empty">{loading ? 'Loading...' : 'Nothing to show for this period.'}</p>
            ) : (
              <ul className="tu-slow">
                {slowest.map((t) => (
                  <li key={t.testId}>
                    <span className="tu-rank-name">{cleanName(t.name)}</span>
                    <span className={`tu-tag${t.count === 0 ? ' is-none' : ''}`}>{t.count === 0 ? 'Not ordered' : `${t.count} order${t.count === 1 ? '' : 's'}`}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>

      <section className="biz-section" aria-label="All tests">
        <div className="biz-section-head">
          <h2>All tests</h2>
          <div className="tu-tools">
            {/* Driven (and hidden) by the top-bar search: one search box per screen. */}
            <div className="form-group tu-search-wrap"><input type="search" data-page-search="" className="tu-search" aria-label="Search test name, code or category" placeholder="Test name, code or category" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
            <div className="biz-period-presets" role="group" aria-label="Order">
              <button type="button" className={order === 'most' ? 'is-on' : ''} aria-pressed={order === 'most'} onClick={() => setOrder('most')}>Most ordered first</button>
              <button type="button" className={order === 'least' ? 'is-on' : ''} aria-pressed={order === 'least'} onClick={() => setOrder('least')}>Least first</button>
            </div>
          </div>
        </div>
        <ReportTable loading={loading} rows={shown} rowKey={(r) => r.testId} empty={search ? 'No test matches your search.' : 'No tests were ordered in this period.'}
          columns={[
            { key: 'name', label: 'Test', render: (r) => <><div className="strong">{cleanName(r.name)}</div>{r.code && <div className="muted">{r.code}</div>}</> },
            { key: 'category', label: 'Category', render: (r) => r.category || <span className="muted">-</span> },
            { key: 'count', label: 'Orders', align: 'right', render: (r) => (r.count ? <span className="strong">{r.count}</span> : <span className="muted">0</span>) },
            { key: 'revenue', label: 'Billed', align: 'right', render: (r) => money(r.revenue) },
          ]}
          totals={{ name: 'Total', count: String(sum(shown, (r) => r.count)), revenue: money(sum(shown, (r) => r.revenue)) }} />
      </section>
    </div>
  );
}
