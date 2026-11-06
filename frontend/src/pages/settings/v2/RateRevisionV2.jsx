import React, { useEffect, useMemo, useState } from 'react';
import useStickyState from '../../../utils/useStickyState';
import { getTests, updateTestRate, bulkUpdateTestRates } from '../../../services/testService';
import { PageHeader, Button, ConfirmDialog, RowMenu } from '../../../components/common';
import ReportTable from '../../../components/business/ReportTable';
import { usePermissions } from '../../../hooks/usePermission';
import { money, sum } from '../../../utils/reportFormat';
import '../../../components/business/business.css';
import '../../lab/v2/labSetupV2.css';

// Change prices (new look): pick tests, say how much, check the new prices,
// then save - nothing changes until the last step.
export default function RateRevisionV2() {
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const [search, setSearch] = useStickyState('search', '');
  const [dept, setDept] = useStickyState('dept', '');
  const [selected, setSelected] = useState([]);
  const [mode, setMode] = useState('percent');
  const [amount, setAmount] = useState('');
  const [roundTo, setRoundTo] = useState(1);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingOne, setSavingOne] = useState(null);
  const { can } = usePermissions();
  const canRates = can('rates') || can('settings');

  const load = () => {
    setLoading(true);
    getTests({ status: 'Active' }).then((res) => setTests(Array.isArray(res?.data) ? res.data.filter((t) => !t.isDeleted) : []))
      .catch((err) => setError(err.response?.data?.message || 'Could not load the tests.'))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const departments = useMemo(() => [...new Set(tests.map((t) => t.category?.name).filter(Boolean))].sort(), [tests]);
  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tests.filter((t) => (!dept || t.category?.name === dept)
      && (!q || `${t.name} ${t.code} ${t.category?.name || ''}`.toLowerCase().includes(q)))
      .sort((a, b) => String(a.name).localeCompare(String(b.name)));
  }, [tests, search, dept]);

  const delta = Number(amount);
  const validAmount = amount !== '' && !Number.isNaN(delta) && !(mode === 'percent' && delta <= -100);
  const newPrice = (price) => {
    if (!validAmount) return null;
    const raw = mode === 'percent' ? Number(price) * (1 + delta / 100) : Number(price) + delta;
    return Math.max(0, Math.round(raw / roundTo) * roundTo);
  };
  const picked = tests.filter((t) => selected.includes(t._id));
  const preview = validAmount ? picked.map((t) => ({ ...t, next: newPrice(t.price) })) : [];
  const before = sum(picked, (t) => t.price);
  const after = sum(preview, (t) => t.next);

  const toggle = (id) => setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const allShownPicked = shown.length > 0 && shown.every((t) => selected.includes(t._id));
  const pickShown = () => setSelected((prev) => (allShownPicked ? prev.filter((id) => !shown.some((t) => t._id === id)) : [...new Set([...prev, ...shown.map((t) => t._id)])]));

  const saveAll = async () => {
    setSaving(true); setError('');
    try {
      const res = await bulkUpdateTestRates(preview.map((t) => ({ id: t._id, price: t.next })));
      const counts = res?.data || {};
      setDone(`New prices saved for ${counts.ok ?? preview.length} test${(counts.ok ?? preview.length) === 1 ? '' : 's'}${counts.failed ? `; ${counts.failed} could not be changed` : ''}.`);
      setSelected([]); setAmount(''); setConfirmOpen(false);
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'The prices could not be saved. Nothing was changed.');
      setConfirmOpen(false);
    } finally { setSaving(false); }
  };
  const saveOne = async (t) => {
    setSavingOne(t._id); setError('');
    try {
      await updateTestRate(t._id, newPrice(t.price));
      setDone(`${t.name}: price is now ${money(newPrice(t.price))}.`);
      setSelected((prev) => prev.filter((x) => x !== t._id));
      load();
    } catch (err) { setError(err.response?.data?.message || `Could not change the price of ${t.name}.`); } finally { setSavingOne(null); }
  };

  return (
    <div className="biz-page">
      <PageHeader title="Rate revision" subtitle="Raise or lower the price of many tests at once. You see every new price before anything is saved." />
      {!canRates && <div className="biz-error" role="note">You can try out new prices here, but only staff with price permission can save them.</div>}
      {error && <div className="biz-error" role="alert">{error}</div>}
      {done && <div className="ls-done" role="status">{done}</div>}

      <div className="ls-steps">
        <div className="ls-step">
          <h3><span>1</span>Choose tests</h3>
          <p>Tick tests in the list, or pick a whole department.</p>
          <div className="ls-step-row">
            <select className="ls-select" aria-label="Department" value={dept} onChange={(e) => setDept(e.target.value)}>
              <option value="">All departments</option>
              {departments.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
            <Button variant="secondary" size="sm" onClick={pickShown} disabled={!shown.length}>{allShownPicked ? 'Untick shown' : `Tick all ${shown.length} shown`}</Button>
          </div>
          <p><b style={{ color: '#18181b' }}>{selected.length}</b> test{selected.length === 1 ? '' : 's'} chosen{selected.length ? <> · <button type="button" className="ls-link" style={{ fontWeight: 400 }} onClick={() => setSelected([])}>clear</button></> : null}</p>
        </div>
        <div className="ls-step">
          <h3><span>2</span>How much?</h3>
          <p>Use a minus sign to lower prices, e.g. -5.</p>
          <div className="ls-step-row">
            <div className="biz-period-presets" role="group" aria-label="Change by">
              <button type="button" className={mode === 'percent' ? 'is-on' : ''} aria-pressed={mode === 'percent'} onClick={() => setMode('percent')}>Percent %</button>
              <button type="button" className={mode === 'absolute' ? 'is-on' : ''} aria-pressed={mode === 'absolute'} onClick={() => setMode('absolute')}>Rupees ₹</button>
            </div>
            <input type="number" aria-label={mode === 'percent' ? 'Change in percent' : 'Change in rupees'} placeholder={mode === 'percent' ? 'e.g. 10' : 'e.g. 50'} value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="ls-step-row">
            <select className="ls-select" aria-label="Round new prices" value={roundTo} onChange={(e) => setRoundTo(Number(e.target.value))}>
              <option value={1}>Round to whole rupees</option>
              <option value={10}>Round to nearest ₹10</option>
              <option value={50}>Round to nearest ₹50</option>
            </select>
          </div>
          {amount !== '' && !validAmount && <p className="ls-crit">Enter a number{mode === 'percent' ? ' above -100' : ''}.</p>}
        </div>
        <div className="ls-step">
          <h3><span>3</span>Check and save</h3>
          {preview.length ? (
            <p>{preview.length} test{preview.length === 1 ? '' : 's'}: {money(before)} now, <b style={{ color: '#18181b' }}>{money(after)}</b> after ({after >= before ? '+' : ''}{money(after - before)}).</p>
          ) : <p>Choose tests and an amount to see the new prices below.</p>}
          {canRates && <Button variant="primary" disabled={!preview.length || saving} onClick={() => setConfirmOpen(true)}>Save new prices{preview.length ? ` (${preview.length})` : ''}</Button>}
        </div>
      </div>

      <section className="biz-section">
        <div className="biz-section-head">
          <h2>Tests</h2>
          <div className="form-group ls-search-wrap"><input type="search" data-page-search="" className="ls-search" aria-label="Search test, code or department" placeholder="Test, code or department" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        </div>
        <ReportTable loading={loading} rows={shown} rowKey={(t) => t._id} limit={100} empty={search ? 'No test matches your search.' : 'No active tests.'}
          columns={[
            { key: 'pick', label: '', render: (t) => <input type="checkbox" checked={selected.includes(t._id)} onChange={() => toggle(t._id)} aria-label={`Choose ${t.name}`} /> },
            { key: 'name', label: 'Test', render: (t) => <><div className="strong">{t.name}</div><div className="muted">{t.code}</div></> },
            { key: 'dept', label: 'Department', render: (t) => t.category?.name || <span className="muted">-</span> },
            { key: 'now', label: 'Now', align: 'right', render: (t) => money(t.price) },
            { key: 'next', label: 'New price', align: 'right', render: (t) => {
              if (!selected.includes(t._id) || !validAmount) return <span className="muted">-</span>;
              const n = newPrice(t.price);
              return <span className={`ls-new${n < Number(t.price) ? ' is-down' : ''}`}>{money(n)}</span>;
            } },
            { key: 'act', label: '', render: (t) => (canRates && selected.includes(t._id) && validAmount ? (
              <RowMenu items={[{ label: savingOne === t._id ? 'Saving...' : 'Save just this one', onClick: () => saveOne(t) }]} />
            ) : null) },
          ]} />
      </section>

      <ConfirmDialog
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={saveAll}
        loading={saving}
        title={`Save new prices for ${preview.length} test${preview.length === 1 ? '' : 's'}?`}
        message={`Total ${money(before)} becomes ${money(after)}. New bills will use the new prices; bills already made keep their old prices.`}
      />
    </div>
  );
}
