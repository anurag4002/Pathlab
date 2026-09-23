import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { getOnboarding, setOnboardingStep, getSignatures, createSignature, deleteSignature } from '../../services/setupService';
import { PageHeader, Button, DataTable, Input } from '../../components/common';
import useClientPagination from '../../hooks/useClientPagination';
import {
  Trash2, CheckCircle2, Circle, ArrowRight, PartyPopper, PenLine,
  MailCheck, Building2, FileImage, IndianRupee, Ruler, Users,
  MonitorCheck, MessageSquare, Receipt, FileCheck2, Upload,
} from 'lucide-react';
import './Onboarding.css';

// SaaS-style setup checklist. Step content (title/description/done) comes
// from GET /api/setup/onboarding; links + icons are a client-side map since
// the server leaves `link` empty.
const STEP_META = {
  'verify-email': { icon: MailCheck, link: '' },
  'centre-profile': { icon: Building2, link: '/setup/profile' },
  'letterhead': { icon: FileImage, link: '/setup/profile' },
  'rates': { icon: IndianRupee, link: '/lab/tests' },
  'normals': { icon: Ruler, link: '/lab/tests' },
  'users': { icon: Users, link: '/manage/employees' },
  'browser-code': { icon: MonitorCheck, link: '/manage/security' },
  'sms-setup': { icon: MessageSquare, link: '/delivery/templates' },
  'signature': { icon: PenLine, link: '#signatures' },
  'first-bill': { icon: Receipt, link: '/cases/bills/new' },
  'first-report': { icon: FileCheck2, link: '/lab/reports' },
};

const sigPreviewSrc = (g) => {
  const u = g?.url || g?.imageUrl || '';
  if (!u) return '';
  return /^https?:\/\//.test(u) || u.startsWith('/') ? u : `/${u}`;
};

const Onboarding = () => {
  const [data, setData] = useState({ percent: 0, steps: [] });
  const [sigs, setSigs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [togglingKey, setTogglingKey] = useState('');
  const [sigForm, setSigForm] = useState({ name: '', title: '', file: null });
  const [sigLoading, setSigLoading] = useState(false);
  const [sigError, setSigError] = useState('');
  const pgSigs = useClientPagination(sigs, 5);
  const load = async () => {
    setLoading(true);
    try {
      const [o, s] = await Promise.all([getOnboarding().catch(() => null), getSignatures().catch(() => null)]);
      if (o?.success) setData(o.data || { percent: 0, steps: [] });
      if (s?.success) setSigs(s.data?.signatures || s.data || []);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);
  const toggle = async (key, done) => {
    setTogglingKey(key);
    try { await setOnboardingStep(key, !done); await load(); }
    catch (e) { alert(e.response?.data?.message || 'Failed to update step'); }
    finally { setTogglingKey(''); }
  };
  const uploadSig = async (e) => {
    e.preventDefault();
    setSigError('');
    if (!sigForm.file) { setSigError('Choose a signature image file first.'); return; }
    const fd = new FormData(); fd.append('file', sigForm.file); fd.append('name', sigForm.name); fd.append('title', sigForm.title);
    setSigLoading(true);
    try {
      const r = await createSignature(fd);
      if (r.success) { setSigForm({ name: '', title: '', file: null }); load(); }
    }
    catch (e) { setSigError(e.response?.data?.message || 'Upload failed'); }
    finally { setSigLoading(false); }
  };
  const del = async (id) => { if (!window.confirm('Delete signature?')) return; try { await deleteSignature(id); load(); } catch (e) { alert(e.response?.data?.message || 'Failed to delete'); } };
  const steps = useMemo(() => {
    const raw = data.steps || data.checklist || [];
    return raw.map((s, i) => {
      const meta = STEP_META[s.key] || {};
      return {
        key: s.key || `step-${i}`,
        title: s.title || s.label || s.key,
        description: s.description || '',
        link: meta.link || s.link || '',
        Icon: meta.icon || Circle,
        done: !!s.done,
      };
    });
  }, [data]);
  const pct = data.percent ?? data.completion ?? 0;
  const doneCount = steps.filter((s) => s.done).length;
  const nextStep = steps.find((s) => !s.done);
  const complete = steps.length > 0 && doneCount === steps.length;

  const R = 40;
  const CIRC = 2 * Math.PI * R;

  return (
    <div className="onboarding-page">
      <PageHeader
        title="Getting Started"
        subtitle="Set up your lab step by step — profile, rates, staff, messaging and signatures"
      />

      <section className="onboarding-hero" aria-label="Setup progress">
        <div className="onboarding-ring" aria-hidden="true">
          <svg width="96" height="96" viewBox="0 0 96 96">
            <circle className="onboarding-ring-track" cx="48" cy="48" r={R} fill="none" strokeWidth="10" />
            <circle
              className="onboarding-ring-fill"
              cx="48" cy="48" r={R} fill="none" strokeWidth="10"
              strokeDasharray={CIRC}
              strokeDashoffset={CIRC - (CIRC * Math.min(100, pct)) / 100}
            />
          </svg>
          <span className="onboarding-ring-label">{pct}%</span>
        </div>
        <div className="onboarding-hero-text">
          <h2 className="onboarding-hero-title">
            {complete ? 'Setup complete — nice work!' : `${doneCount} of ${steps.length} steps complete`}
          </h2>
          <p className="onboarding-hero-sub">
            {complete
              ? 'Your lab is ready to bill, report and notify patients.'
              : nextStep
                ? `Up next: ${nextStep.title}. Each step takes a minute or two.`
                : 'Loading your checklist…'}
          </p>
          {complete ? (
            <span className="onboarding-hero-done"><PartyPopper size={16} /> All done</span>
          ) : nextStep ? (
            nextStep.link.startsWith('#') ? (
              <a className="onboarding-hero-cta" href={nextStep.link}>
                Continue setup <ArrowRight size={15} />
              </a>
            ) : nextStep.link ? (
              <Link className="onboarding-hero-cta" to={nextStep.link}>
                Continue setup <ArrowRight size={15} />
              </Link>
            ) : null
          ) : null}
        </div>
      </section>

      <div className="onboarding-grid">
        {loading && steps.length === 0
          ? [0, 1, 2, 3].map((i) => (
            <div key={i} className="onboarding-step" aria-hidden="true">
              <div style={{ height: 40, width: 40, borderRadius: 8, background: 'var(--color-background)' }} />
              <div style={{ height: 16, width: '70%', background: 'var(--color-background)', borderRadius: 4 }} />
              <div style={{ height: 40, background: 'var(--color-background)', borderRadius: 4 }} />
            </div>
          ))
          : steps.map((s) => {
            const isNext = nextStep && nextStep.key === s.key && !s.done;
            return (
              <article
                key={s.key}
                className={`onboarding-step${s.done ? ' is-done' : ''}${isNext ? ' is-next' : ''}`}
                aria-label={`${s.title} — ${s.done ? 'done' : isNext ? 'up next' : 'to do'}`}
              >
                <div className="onboarding-step-top">
                  <span className="onboarding-step-icon"><s.Icon size={20} /></span>
                  <span className={`onboarding-step-badge ${s.done ? 'done' : isNext ? 'next' : 'todo'}`}>
                    {s.done ? 'Done' : isNext ? 'Up next' : 'To do'}
                  </span>
                </div>
                <h3 className="onboarding-step-title">{s.title}</h3>
                {s.description && <p className="onboarding-step-desc">{s.description}</p>}
                <div className="onboarding-step-actions">
                  {s.link && !s.link.startsWith('#') && (
                    <Link to={s.link}>
                      <Button variant={isNext ? 'primary' : 'secondary'} size="sm">
                        Open <ArrowRight size={13} />
                      </Button>
                    </Link>
                  )}
                  {s.link && s.link.startsWith('#') && (
                    <a href={s.link}>
                      <Button variant={isNext ? 'primary' : 'secondary'} size="sm">
                        Open <ArrowRight size={13} />
                      </Button>
                    </a>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    loading={togglingKey === s.key}
                    onClick={() => toggle(s.key, s.done)}
                    icon={s.done ? <CheckCircle2 size={14} /> : undefined}
                  >
                    {s.done ? 'Mark undone' : 'Mark done'}
                  </Button>
                </div>
              </article>
            );
          })}
      </div>

      <section className="onboarding-card" id="signatures" aria-label="Signatures">
        <h3 className="onboarding-card-title"><PenLine size={17} /> Authority Signatures</h3>
        <form onSubmit={uploadSig} className="onboarding-sig-form">
          <Input label="Name" placeholder="Dr. A. Sharma" value={sigForm.name} onChange={(e) => setSigForm((s) => ({ ...s, name: e.target.value }))} required />
          <Input label="Title" placeholder="Consultant Pathologist" value={sigForm.title} onChange={(e) => setSigForm((s) => ({ ...s, title: e.target.value }))} />
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label"><span>Image</span></label>
            <input type="file" accept="image/*" className="onboarding-file-input" onChange={(e) => setSigForm((s) => ({ ...s, file: e.target.files?.[0] || null }))} />
          </div>
          <Button type="submit" size="sm" loading={sigLoading} icon={<Upload size={14} />}>Upload</Button>
        </form>
        {sigError && <p className="form-error" role="alert">{sigError}</p>}
        <DataTable
          headers={['Name', 'Title', 'Preview', 'Action']}
          data={pgSigs.paged}
          loading={loading}
          emptyMessage="No signatures yet — upload your first one above."
          pagination={{
            total: pgSigs.total,
            page: pgSigs.page,
            limit: pgSigs.limit,
            pages: pgSigs.pages,
            onPageChange: pgSigs.goToPage,
            onLimitChange: pgSigs.setLimit,
          }}
          renderRow={(g, i) => (
            <tr key={g._id || i}>
              <td style={{ fontWeight: 600 }}>{g.name}</td>
              <td>{g.title || '—'}</td>
              <td>{sigPreviewSrc(g) ? <img src={sigPreviewSrc(g)} alt={`${g.name} signature`} className="onboarding-sig-preview" /> : '—'}</td>
              <td>
                <Button variant="danger" size="sm" onClick={() => del(g._id)} icon={<Trash2 size={13} />}>
                  Delete
                </Button>
              </td>
            </tr>
          )}
        />
      </section>
    </div>
  );
};
export default Onboarding;
