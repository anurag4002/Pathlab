import React, { useEffect, useMemo, useState } from 'react';
import useStickyState from '../../../utils/useStickyState';
import { getTests, updateTest } from '../../../services/testService';
import { PageHeader, Button, Input } from '../../../components/common';
import ReportTable from '../../../components/business/ReportTable';
import { TAT_CONFIG_KEY, DEFAULT_TAT_SETTINGS, loadTatSettings } from '../../../components/lab/TatCountdown';
import { notify } from '../../../components/common/Toast/toast';
import SettingsNav from '../../manage/v2/SettingsNav';
import '../../../components/business/business.css';
import '../../manage/v2/manage.css';

const FIELDS = [
  { key: 'defaultTatHours', label: 'Normal reports', hint: 'Hours from billing until a report should be ready, when a test has no time of its own.' },
  { key: 'emergencyTatHours', label: 'Emergency reports', hint: 'Hours for urgent orders.' },
  { key: 'dueSoonHours', label: 'Warn when this close', hint: 'Show "Due soon" when this many hours are left.' },
  { key: 'urgentHours', label: '"Due" list covers', hint: 'Reports due within these hours appear in the Due list.' },
];
const SECTIONS = [{ id: 'tat-defaults', label: 'Report times' }, { id: 'tat-tests', label: 'Per test' }];

// Report times (new look): how quickly reports should be ready.
export default function TatConfigV2() {
  const [saved, setSaved] = useState(() => loadTatSettings());
  // Unsaved edits come back after a reload until saved or reset.
  const [form, setForm] = useStickyState('form', loadTatSettings);
  const [error, setError] = useState('');
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useStickyState('search', '');
  const [drafts, setDrafts] = useStickyState('testTimes', {});
  const [savingId, setSavingId] = useState(null);

  useEffect(() => {
    setLoading(true);
    getTests({ status: 'Active' }).then((r) => { if (r.success) setTests(r.data || []); }).catch(() => notify('Could not load tests.')).finally(() => setLoading(false));
  }, []);

  const changed = FIELDS.filter(({ key }) => String(form[key]) !== String(saved[key]));
  const saveDefaults = () => {
    for (const { key, label } of FIELDS) {
      const n = Number(form[key]);
      if (!Number.isFinite(n) || n <= 0) { setError(`${label}: enter a number of hours above 0.`); return; }
    }
    if (Number(form.dueSoonHours) > Number(form.urgentHours)) { setError('"Warn when this close" should not be more than what the "Due" list covers.'); return; }
    const payload = Object.fromEntries(FIELDS.map(({ key }) => [key, Number(form[key])]));
    try {
      localStorage.setItem(TAT_CONFIG_KEY, JSON.stringify(payload));
      setSaved(payload); setForm(payload); setError(''); notify('Report times saved');
    } catch { setError('Could not save on this computer.'); }
  };

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tests.filter((t) => !q || `${t.name} ${t.code}`.toLowerCase().includes(q));
  }, [tests, search]);
  const draftFor = (t) => drafts[t._id] ?? (t.tatHours ?? '');
  const saveTest = async (t) => {
    const raw = draftFor(t);
    const tatHours = raw === '' || raw === null ? null : Number(raw);
    if (tatHours !== null && (!Number.isFinite(tatHours) || tatHours <= 0)) { notify('Enter hours above 0, or leave empty to use the normal time.'); return; }
    setSavingId(t._id);
    try {
      const res = await updateTest(t._id, { name: t.name, code: t.code, category: t.category?._id || t.category, sampleType: t.sampleType, price: t.price, tatHours });
      if (res.success) {
        setTests((prev) => prev.map((x) => (x._id === t._id ? { ...x, tatHours } : x)));
        setDrafts((prev) => { const next = { ...prev }; delete next[t._id]; return next; });
        notify(`${t.name}: ${tatHours === null ? 'uses the normal time' : `${tatHours} hours`}`);
      }
    } catch (err) { notify(err.response?.data?.message || 'Could not save. Try again.'); }
    finally { setSavingId(null); }
  };
  const custom = tests.filter((t) => t.tatHours != null).length;

  return (
    <div className="biz-page">
      <PageHeader title="Report times" subtitle="How quickly reports should be ready. The worklist counts down and warns when a report is running late." />
      <div className="st-layout">
        <SettingsNav sections={SECTIONS} />
        <div className="st-cards">
          <section className="st-card" id="tat-defaults">
            <div className="st-card-head"><div><h2>Report times</h2><p>Saved on this computer. Tests with their own time (below) use that instead.</p></div></div>
            <div className="st-card-body">
              <div className="mg-grid-2">
                {FIELDS.map(({ key, label, hint }) => (
                  <div key={key}>
                    <Input label={`${label} (hours)`} type="number" min="0" step="0.5" value={form[key] ?? ''} onChange={(e) => { setForm((s) => ({ ...s, [key]: e.target.value })); setError(''); }} />
                    <p className="mg-sub" style={{ margin: '0.25rem 0 0' }}>{hint}</p>
                  </div>
                ))}
              </div>
              {error && <p className="mg-error" role="alert">{error}</p>}
            </div>
            <div className="st-card-foot">
              {changed.length > 0 ? <span className="st-changed">Changed: {changed.map((f) => f.label).join(', ')}</span> : <span className="st-saved">Saved</span>}
              <Button variant="secondary" size="sm" onClick={() => { setForm({ ...DEFAULT_TAT_SETTINGS }); setError(''); }}>Use standard times</Button>
              <Button variant="primary" size="sm" onClick={saveDefaults} disabled={!changed.length}>Save</Button>
            </div>
          </section>

          <section className="st-card" id="tat-tests">
            <div className="st-card-head">
              <div><h2>Per test</h2><p>Give a test its own time if it takes longer or shorter than normal. Leave empty to use the normal time ({saved.defaultTatHours} h). {custom} test{custom === 1 ? '' : 's'} have their own time.</p></div>
            </div>
            <div className="st-card-body">
              <div className="form-group mg-hidden-search"><input type="search" data-page-search="" aria-label="Search tests" placeholder="Search tests" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
              <ReportTable loading={loading} rows={rows} rowKey={(t) => t._id} empty="No tests found."
                columns={[
                  { key: 'name', label: 'Test', render: (t) => <><div className="mg-name">{t.name}</div><div className="mg-sub">{t.code}</div></> },
                  { key: 'now', label: 'Ready in', render: (t) => (t.tatHours != null ? <span className="mg-pill is-info">{t.tatHours} h</span> : <span className="muted">{saved.defaultTatHours} h (normal)</span>) },
                  { key: 'edit', label: 'Own time (hours)', render: (t) => (
                    <input className="form-control" style={{ maxWidth: '8rem', height: '2rem' }} type="number" min="0" step="0.5" aria-label={`Hours for ${t.name}`} placeholder="Normal"
                      value={draftFor(t)} onChange={(e) => setDrafts((p) => ({ ...p, [t._id]: e.target.value }))}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); saveTest(t); } }} />
                  ) },
                  { key: 'act', label: '', align: 'right', render: (t) => (String(draftFor(t)) !== String(t.tatHours ?? '')
                    ? <Button variant="primary" size="sm" loading={savingId === t._id} onClick={() => saveTest(t)}>Save</Button> : null) },
                ]} />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
