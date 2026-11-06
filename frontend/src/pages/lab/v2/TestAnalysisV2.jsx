import React, { useEffect, useMemo, useState } from 'react';
import useStickyState from '../../../utils/useStickyState';
import { Link } from 'react-router-dom';
import { Printer, RefreshCw } from 'lucide-react';
import { getTestUsage } from '../../../services/analysisService';
import { PageHeader, Button, StatGroup } from '../../../components/common';
import PeriodBar, { presetRange } from '../../../components/business/PeriodBar';
import DownloadMenu from '../../../components/business/DownloadMenu';
import ReportTable from '../../../components/business/ReportTable';
import printReport, { fetchAllPages } from '../../../utils/printReport';
import { money, periodLabel, sum, downloadCsv } from '../../../utils/reportFormat';
import '../../../components/business/business.css';
import './labSetupV2.css';

const clean = (name) => String(name || '').replace(/\s*\(bundle\)\s*$/i, '').trim();

// Test analysis (new look): which departments do the most work in a period,
// and the busiest test in each. Per-test detail lives on Test usage.
export default function TestAnalysisV2() {
  const [[from, to], setRange] = useStickyState('range', () => presetRange('days30'));
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true); setError('');
    fetchAllPages(async (page, limit) => {
      const res = await getTestUsage({ from, to, sort: 'desc', page, limit });
      return { items: res?.data?.items || [], pages: res?.data?.pagination?.pages || 1 };
    }, { pageSize: 200 }).then((all) => { if (alive) setItems(all); })
      .catch((err) => { if (alive) setError(err.response?.data?.message || 'Could not load the analysis for this period.'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [from, to, reload]);

  const done = items.filter((r) => r.count > 0);
  const depts = useMemo(() => {
    const map = new Map();
    done.forEach((r) => {
      const key = r.category || 'Panels and packages';
      const d = map.get(key) || { name: key, orders: 0, billed: 0, tests: 0, top: null };
      d.orders += r.count; d.billed += Number(r.revenue) || 0; d.tests += 1;
      if (!d.top || r.count > d.top.count) d.top = r;
      map.set(key, d);
    });
    return [...map.values()].sort((a, b) => b.orders - a.orders);
  }, [done]);
  const totalOrders = sum(depts, (d) => d.orders);
  const totalBilled = sum(depts, (d) => d.billed);
  const max = Math.max(1, ...depts.map((d) => d.orders));

  const print = () => printReport({
    title: 'Test analysis',
    period: periodLabel(from, to),
    summary: [
      { label: 'Tests done', value: String(totalOrders) },
      { label: 'Different tests', value: String(done.length) },
      { label: 'Departments', value: String(depts.length) },
      { label: 'Billed for tests', value: money(totalBilled) },
    ],
    sections: [{
      title: 'By department',
      columns: [{ label: 'Department' }, { label: 'Tests done', align: 'right' }, { label: 'Share', align: 'right' }, { label: 'Busiest test' }, { label: 'Billed', align: 'right' }],
      rows: depts.map((d) => [d.name, String(d.orders), `${Math.round((d.orders / Math.max(1, totalOrders)) * 100)}%`, d.top ? `${clean(d.top.name)} (${d.top.count})` : '', money(d.billed)]),
      totals: ['Total', String(totalOrders), '100%', '', money(totalBilled)],
      empty: 'No tests were done in this period.',
    }],
  });
  const download = () => downloadCsv(`test-analysis-${from}-${to}.csv`, ['Department', 'Tests done', 'Different tests', 'Busiest test', 'Billed'],
    depts.map((d) => [d.name, d.orders, d.tests, d.top ? clean(d.top.name) : '', d.billed]));

  return (
    <div className="biz-page">
      <PageHeader
        title="Test analysis"
        subtitle="Which departments did the most tests in a period, and the busiest test in each."
        action={
          <div className="biz-actions">
            <Button variant="secondary" size="sm" icon={<RefreshCw size={14} />} onClick={() => setReload((n) => n + 1)}>Refresh</Button>
            <Button variant="secondary" size="sm" icon={<Printer size={14} />} onClick={print} disabled={loading}>Print</Button>
            <DownloadMenu items={[{ label: 'By department (CSV)', onClick: download }]} />
          </div>
        }
      />
      <PeriodBar from={from} to={to} onChange={({ from: a, to: b }) => setRange([a, b])} presets={['today', 'week', 'days30', 'month', 'lastMonth']} />
      {error && <div className="biz-error" role="alert">{error}<Button variant="secondary" size="sm" onClick={() => setReload((n) => n + 1)}>Try again</Button></div>}

      <StatGroup loading={loading} items={[
        { label: 'Tests done', value: String(totalOrders), hint: 'Lines on bills in the period' },
        { label: 'Different tests', value: String(done.length), to: '/analytics/test-usage' },
        { label: 'Busiest department', value: depts[0]?.name || '-', hint: depts[0] ? `${depts[0].orders} tests` : undefined },
        { label: 'Billed for tests', value: money(totalBilled) },
      ]} />

      <section className="biz-section">
        <div className="biz-section-head"><h2>By department</h2><p><Link to="/analytics/test-usage">Test usage</Link> lists every single test.</p></div>
        <ReportTable loading={loading} rows={depts} rowKey={(d) => d.name} empty="No tests were done in this period."
          columns={[
            { key: 'name', label: 'Department', render: (d) => <span className="strong">{d.name}</span> },
            { key: 'orders', label: 'Tests done', render: (d) => <span className="ls-bar"><span><span style={{ width: `${(d.orders / max) * 100}%` }} /></span><small>{d.orders}</small></span> },
            { key: 'top', label: 'Busiest test', render: (d) => (d.top ? <>{clean(d.top.name)} <span className="muted">({d.top.count})</span></> : '') },
            { key: 'tests', label: 'Different tests', align: 'right' },
            { key: 'billed', label: 'Billed', align: 'right', render: (d) => money(d.billed) },
          ]}
          totals={{ name: 'Total', orders: `${totalOrders} tests`, tests: String(done.length), billed: money(totalBilled) }} />
      </section>
    </div>
  );
}
