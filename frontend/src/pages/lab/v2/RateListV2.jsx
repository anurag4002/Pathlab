import React, { useEffect, useMemo, useState } from 'react';
import { Printer, RefreshCw } from 'lucide-react';
import { getTests, getCategories } from '../../../services/testService';
import { getPanels } from '../../../services/panelService';
import { getPackages } from '../../../services/packageService';
import { PageHeader, Button, StatGroup } from '../../../components/common';
import DownloadMenu from '../../../components/business/DownloadMenu';
import ReportTable from '../../../components/business/ReportTable';
import printReport from '../../../utils/printReport';
import { money, downloadCsv } from '../../../utils/reportFormat';
import '../../../components/business/business.css';
import './labSetupV2.css';

const TYPES = [
  { key: 'all', label: 'Everything' },
  { key: 'Test', label: 'Tests' },
  { key: 'Panel', label: 'Panels' },
  { key: 'Package', label: 'Packages' },
];

// Rate list (new look): every test, panel and package with its price, a
// clean printed price list, and a spreadsheet download. Read-only.
export default function RateListV2() {
  const [tests, setTests] = useState([]);
  const [panels, setPanels] = useState([]);
  const [packages, setPackages] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const [type, setType] = useState('all');
  const [category, setCategory] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    let alive = true;
    setLoading(true); setError('');
    Promise.allSettled([getTests({}), getPanels(), getPackages(), getCategories()]).then(([t, p, k, c]) => {
      if (!alive) return;
      setTests(t.status === 'fulfilled' && Array.isArray(t.value?.data) ? t.value.data : []);
      setPanels(p.status === 'fulfilled' && Array.isArray(p.value?.data) ? p.value.data : []);
      setPackages(k.status === 'fulfilled' && Array.isArray(k.value?.data) ? k.value.data : []);
      setCategories(c.status === 'fulfilled' && Array.isArray(c.value?.data) ? c.value.data : []);
      if ([t, p, k].some((r) => r.status === 'rejected')) setError('Some prices could not be loaded. Try Refresh.');
    }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [reload]);

  const all = useMemo(() => [
    ...tests.filter((x) => !x.isDeleted).map((x) => ({ id: `t${x._id}`, name: x.name, code: x.code, type: 'Test', category: x.category?.name || '', categoryId: x.category?._id || x.category, price: x.price, active: !x.status || x.status === 'Active' })),
    ...panels.map((x) => ({ id: `p${x._id}`, name: x.name, code: '', type: 'Panel', category: 'Panels', price: x.price, active: !x.status || x.status === 'Active', count: (x.tests || []).length })),
    ...packages.map((x) => ({ id: `k${x._id}`, name: x.name, code: '', type: 'Package', category: 'Packages', price: x.price, active: !x.status || x.status === 'Active', count: (x.tests || x.items || []).length })),
  ].sort((a, b) => String(a.name).localeCompare(String(b.name))), [tests, panels, packages]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return all.filter((r) => (type === 'all' || r.type === type)
      && (showInactive || r.active)
      && (!category || String(r.categoryId) === category)
      && (!q || `${r.name} ${r.code}`.toLowerCase().includes(q)));
  }, [all, type, showInactive, category, search]);

  const counts = { Test: all.filter((r) => r.type === 'Test' && r.active).length, Panel: all.filter((r) => r.type === 'Panel' && r.active).length, Package: all.filter((r) => r.type === 'Package' && r.active).length };

  // Price list on paper: grouped by department / panels / packages.
  const print = () => {
    const groups = [...new Set(rows.map((r) => r.category || 'Other'))].sort((a, b) => {
      const rank = (g) => (g === 'Panels' ? 1 : g === 'Packages' ? 2 : 0);
      return rank(a) - rank(b) || a.localeCompare(b);
    });
    printReport({
      title: 'Rate list',
      period: `Prices as on ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`,
      filters: [type !== 'all' && TYPES.find((t) => t.key === type).label, category && categories.find((c) => c._id === category)?.name, search && `Search: ${search}`],
      sections: groups.map((g) => ({
        title: g,
        columns: [{ label: 'Name' }, { label: 'Code' }, { label: 'Price', align: 'right' }],
        rows: rows.filter((r) => (r.category || 'Other') === g).map((r) => [r.name, r.code || '', money(r.price)]),
      })),
    });
  };
  const download = () => downloadCsv('rate-list.csv', ['Name', 'Code', 'Type', 'Department', 'Price', 'Status'],
    rows.map((r) => [r.name, r.code, r.type, r.type === 'Test' ? r.category : '', r.price, r.active ? 'Active' : 'Inactive']));

  return (
    <div className="biz-page">
      <PageHeader
        title="Rate list"
        subtitle="Every test, panel and package with its price. Print it as a price list for the counter."
        action={
          <div className="biz-actions">
            <Button variant="secondary" size="sm" icon={<RefreshCw size={14} />} onClick={() => setReload((n) => n + 1)}>Refresh</Button>
            <Button variant="secondary" size="sm" icon={<Printer size={14} />} onClick={print} disabled={loading}>Print price list</Button>
            <DownloadMenu items={[{ label: 'Rate list (CSV)', onClick: download }]} />
          </div>
        }
      />

      <div className="ls-toolbar">
        <div className="biz-period-presets" role="group" aria-label="Show">
          {TYPES.map((t) => (
            <button key={t.key} type="button" className={type === t.key ? 'is-on' : ''} aria-pressed={type === t.key} onClick={() => { setType(t.key); if (t.key !== 'all' && t.key !== 'Test') setCategory(''); }}>
              {t.label}{t.key !== 'all' && <span className="ls-count">{counts[t.key]}</span>}
            </button>
          ))}
        </div>
        {(type === 'all' || type === 'Test') && categories.length > 0 && (
          <select className="ls-select" aria-label="Department" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">All departments</option>
            {categories.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
          </select>
        )}
        <label className="ls-check"><input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} /> Show inactive</label>
        <div className="form-group ls-search-wrap"><input type="search" data-page-search="" className="ls-search" aria-label="Search name or code" placeholder="Name or code" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        <span className="ls-meta">{rows.length} shown</span>
      </div>

      {error && <div className="biz-error" role="alert">{error}<Button variant="secondary" size="sm" onClick={() => setReload((n) => n + 1)}>Try again</Button></div>}

      <StatGroup loading={loading} items={[
        { label: 'Tests', value: String(counts.Test), hint: 'Active' },
        { label: 'Panels', value: String(counts.Panel), hint: 'Active' },
        { label: 'Packages', value: String(counts.Package), hint: 'Active' },
      ]} />

      <ReportTable loading={loading} rows={rows} rowKey={(r) => r.id} limit={100} empty={search ? 'Nothing matches your search.' : 'No prices to show.'}
        columns={[
          { key: 'name', label: 'Name', render: (r) => <><div className="strong">{r.name}</div>{r.code && <div className="muted">{r.code}</div>}</> },
          { key: 'type', label: 'Type', render: (r) => <span className={`ls-type is-${r.type.toLowerCase()}`}>{r.type}{r.count ? ` · ${r.count} tests` : ''}</span> },
          { key: 'category', label: 'Department', render: (r) => (r.type === 'Test' ? (r.category || <span className="muted">-</span>) : <span className="muted">-</span>) },
          { key: 'price', label: 'Price', align: 'right', render: (r) => <span className="strong">{money(r.price)}</span> },
          { key: 'status', label: '', render: (r) => (r.active ? null : <span className="ls-off">Inactive</span>) },
        ]} />
    </div>
  );
}
