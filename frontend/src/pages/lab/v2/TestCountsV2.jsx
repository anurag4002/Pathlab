import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Printer, RefreshCw } from 'lucide-react';
import { getTestCategories, getTests } from '../../../services/testService';
import { getPanels } from '../../../services/panelService';
import { getPackages } from '../../../services/packageService';
import { PageHeader, Button, StatGroup } from '../../../components/common';
import DownloadMenu from '../../../components/business/DownloadMenu';
import ReportTable from '../../../components/business/ReportTable';
import printReport from '../../../utils/printReport';
import { money, downloadCsv, sum } from '../../../utils/reportFormat';
import '../../../components/business/business.css';
import './labSetupV2.css';

const isActive = (x) => !x.status || x.status === 'Active';

// Test counts (new look): how big the catalogue is, by department.
export default function TestCountsV2() {
  const [tests, setTests] = useState([]);
  const [categories, setCategories] = useState([]);
  const [panels, setPanels] = useState([]);
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true); setError('');
    Promise.allSettled([getTests({}), getTestCategories(), getPanels(), getPackages()]).then(([t, c, p, k]) => {
      if (!alive) return;
      const list = (r) => { const d = r.status === 'fulfilled' ? r.value?.data : []; return Array.isArray(d) ? d : d?.tests || d?.categories || []; };
      setTests(list(t).filter((x) => !x.isDeleted));
      setCategories(list(c));
      setPanels(list(p));
      setPackages(list(k));
      if (t.status === 'rejected') setError('Could not load the tests. Try Refresh.');
    }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [reload]);

  const active = tests.filter(isActive);
  const rows = useMemo(() => {
    const byId = new Map(categories.map((c) => [String(c._id), { id: String(c._id), name: c.name, tests: [] }]));
    const none = { id: 'none', name: 'No department', tests: [] };
    active.forEach((t) => {
      const id = t.category?._id ? String(t.category._id) : (typeof t.category === 'string' ? t.category : '');
      (byId.get(id) || none).tests.push(t);
    });
    const out = [...byId.values()];
    if (none.tests.length) out.push(none);
    return out.map((r) => ({
      ...r,
      count: r.tests.length,
      avg: r.tests.length ? sum(r.tests, (t) => t.price) / r.tests.length : 0,
      low: r.tests.length ? Math.min(...r.tests.map((t) => Number(t.price) || 0)) : 0,
      high: r.tests.length ? Math.max(...r.tests.map((t) => Number(t.price) || 0)) : 0,
    })).sort((a, b) => b.count - a.count);
  }, [active, categories]);
  const max = Math.max(1, ...rows.map((r) => r.count));
  const usedDepts = rows.filter((r) => r.count > 0 && r.id !== 'none').length;

  const print = () => printReport({
    title: 'Test counts',
    period: `As on ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`,
    summary: [
      { label: 'Active tests', value: String(active.length) },
      { label: 'Departments', value: String(usedDepts) },
      { label: 'Panels', value: String(panels.filter(isActive).length) },
      { label: 'Packages', value: String(packages.filter(isActive).length) },
    ],
    sections: [{
      columns: [{ label: 'Department' }, { label: 'Tests', align: 'right' }, { label: 'Lowest price', align: 'right' }, { label: 'Average price', align: 'right' }, { label: 'Highest price', align: 'right' }],
      rows: rows.map((r) => [r.name, String(r.count), r.count ? money(r.low) : '-', r.count ? money(r.avg) : '-', r.count ? money(r.high) : '-']),
      totals: ['Total', String(active.length), '', '', ''],
    }],
  });
  const download = () => downloadCsv('test-counts.csv', ['Department', 'Tests', 'Lowest price', 'Average price', 'Highest price'],
    rows.map((r) => [r.name, r.count, r.low, Math.round(r.avg), r.high]));

  return (
    <div className="biz-page">
      <PageHeader
        title="Test counts"
        subtitle="How many tests, panels and packages you offer, department by department."
        action={
          <div className="biz-actions">
            <Button variant="secondary" size="sm" icon={<RefreshCw size={14} />} onClick={() => setReload((n) => n + 1)}>Refresh</Button>
            <Button variant="secondary" size="sm" icon={<Printer size={14} />} onClick={print} disabled={loading}>Print</Button>
            <DownloadMenu items={[{ label: 'Counts by department (CSV)', onClick: download }]} />
          </div>
        }
      />
      {error && <div className="biz-error" role="alert">{error}<Button variant="secondary" size="sm" onClick={() => setReload((n) => n + 1)}>Try again</Button></div>}

      <StatGroup loading={loading} items={[
        { label: 'Active tests', value: String(active.length), hint: tests.length > active.length ? `${tests.length - active.length} inactive` : 'All active', to: '/lab/tests' },
        { label: 'Departments', value: String(usedDepts), hint: `${categories.length} set up`, to: '/lab/categories' },
        { label: 'Panels', value: String(panels.filter(isActive).length), to: '/lab/panels' },
        { label: 'Packages', value: String(packages.filter(isActive).length), to: '/lab/packages' },
      ]} />

      <section className="biz-section">
        <div className="biz-section-head"><h2>Tests by department</h2><p>Active tests only. <Link to="/analytics/test-usage">See which tests are ordered most</Link>.</p></div>
        <ReportTable loading={loading} rows={rows} rowKey={(r) => r.id} empty="No departments set up yet."
          columns={[
            { key: 'name', label: 'Department', render: (r) => <span className="strong">{r.name}</span> },
            { key: 'count', label: 'Tests', render: (r) => <span className="ls-bar"><span><span style={{ width: `${(r.count / max) * 100}%` }} /></span><small>{r.count}</small></span> },
            { key: 'low', label: 'Lowest price', align: 'right', render: (r) => (r.count ? money(r.low) : <span className="muted">-</span>) },
            { key: 'avg', label: 'Average price', align: 'right', render: (r) => (r.count ? money(r.avg) : <span className="muted">-</span>) },
            { key: 'high', label: 'Highest price', align: 'right', render: (r) => (r.count ? money(r.high) : <span className="muted">-</span>) },
          ]}
          totals={{ name: 'Total', count: `${active.length} tests` }} />
      </section>
    </div>
  );
}
