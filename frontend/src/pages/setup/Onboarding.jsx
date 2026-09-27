import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  RefreshCw, Trash2, ChevronDown, ChevronUp, CheckCircle2, Circle,
  Building2, FileImage, IndianRupee, Ruler, Users, MonitorCheck,
  MessageSquare, PenLine, Receipt, FileCheck2, MailCheck
} from 'lucide-react';
import {
  getOnboarding,
  setOnboardingStep,
  getLabProfile,
  updateLabProfile,
  uploadLogo,
  uploadLetterhead,
  getSignatures,
  createSignature,
  deleteSignature,
  getBrowsers,
  createBrowser,
} from '../../services/setupService';
import { requestEmailOtp, verifyEmailOtp, getUsers, createUser } from '../../services/authService';
import { getTests, updateTestRate, updateTest } from '../../services/testService';
import { getCredits } from '../../services/notifyService';
import { createPatient } from '../../services/patientService';
import { getBills, createBill } from '../../services/billService';
import {
  getPendingLabCases, getReports, createResultReport,
  getReportForEntry, saveReportResults, signReport, verifyReport,
} from '../../services/reportService';
import useAuth from '../../hooks/useAuth';
import { isAdmin } from '../../utils/permissions';
import formatDate from '../../utils/formatDate';
import {
  PageHeader, Button, Input, Select, FileUploader,
  ConfirmDialog, StatusBadge, LoadingSpinner, SignaturePreview,
} from '../../components/common';
import './Onboarding.css';

const STEP_META = {
  'verify-email': { icon: MailCheck },
  'centre-profile': { icon: Building2 },
  letterhead: { icon: FileImage },
  rates: { icon: IndianRupee },
  normals: { icon: Ruler },
  users: { icon: Users },
  'browser-code': { icon: MonitorCheck },
  'sms-setup': { icon: MessageSquare },
  signature: { icon: PenLine },
  'first-bill': { icon: Receipt },
  'first-report': { icon: FileCheck2 },
};

const getErrorMessage = (error, fallback) => {
  if (error?.response) {
    const message = error.response.data?.message;
    if (typeof message === 'string' && message.trim()) return message;
    const status = error.response.status;
    if (status === 401) return 'Your session has expired. Please log in again.';
    if (status === 403) return 'You do not have permission for this action.';
    if (status === 404) return 'The requested record was not found.';
    if (status === 409) return 'Conflict — it changed elsewhere. Refresh and try again.';
    if (status === 422) return 'The submitted data is invalid.';
    if (status >= 500) return 'Server error. Please try again.';
  }
  if (error?.code === 'ECONNABORTED') return 'The request timed out. Please try again.';
  if (error?.code === 'ERR_NETWORK' || error?.request) return 'Network error. Check your connection.';
  return error?.message || fallback;
};

const asArray = (v) => {
  if (Array.isArray(v)) return v;
  if (Array.isArray(v?.tests)) return v.tests;
  if (Array.isArray(v?.users)) return v.users;
  if (Array.isArray(v?.bills)) return v.bills;
  if (Array.isArray(v?.reports)) return v.reports;
  if (Array.isArray(v?.cases)) return v.cases;
  return [];
};
const getTestList = (res) => {
  const d = res?.data;
  if (Array.isArray(d)) return d;
  if (Array.isArray(d?.tests)) return d.tests;
  if (Array.isArray(d?.data)) return d.data;
  return [];
};
const getUserList = (res) => {
  const d = res?.data;
  if (Array.isArray(d)) return d;
  if (Array.isArray(d?.users)) return d.users;
  return [];
};
const getBrowserList = (res) => {
  const d = res?.data;
  if (Array.isArray(d)) return d;
  if (Array.isArray(d?.browsers)) return d.browsers;
  return [];
};
const getBillList = (res) => {
  const d = res?.data;
  if (Array.isArray(d)) return d;
  if (Array.isArray(d?.bills)) return d.bills;
  return [];
};

const PanelMsg = ({ error, success }) => (
  <>
    {error && <div className="onboarding-alert onboarding-alert-error" role="alert">{error}</div>}
    {success && <div className="onboarding-alert onboarding-alert-success" role="status">{success}</div>}
  </>
);

/* ---------------- 1. Verify email ---------------- */
const VerifyEmailPanel = ({ defaultEmail, markDone }) => {
  const [email, setEmail] = useState(defaultEmail || '');
  const [otp, setOtp] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const send = async () => {
    if (!email.trim()) { setError('Enter the lab owner email.'); return; }
    setLoading(true); setError(''); setNotice('');
    try {
      const r = await requestEmailOtp(email.trim());
      if (!r?.success) throw new Error(r?.message || 'Could not send code.');
      setSent(true); setNotice(r.message || 'Verification code sent. Check inbox.');
    } catch (e) { setError(getErrorMessage(e, 'Could not send code.')); }
    finally { setLoading(false); }
  };
  const verify = async () => {
    if (!otp.trim()) { setError('Enter the 6-digit code.'); return; }
    setLoading(true); setError(''); setNotice('');
    try {
      const r = await verifyEmailOtp(email.trim(), otp.trim());
      if (!r?.success) throw new Error(r?.message || 'Verification failed.');
      setNotice('Email verified.');
      await markDone('verify-email');
    } catch (e) { setError(getErrorMessage(e, 'Verification failed.')); }
    finally { setLoading(false); }
  };
  return (
    <div className="onboarding-form">
      <PanelMsg error={error} success={notice} />
      <Input label="Lab owner email" name="ob-email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={loading} required />
      <div className="onboarding-row">
        <Button variant="secondary" onClick={send} loading={loading} disabled={loading}>{sent ? 'Resend code' : 'Send code'}</Button>
      </div>
      {sent && (
        <>
          <Input label="6-digit code" name="ob-otp" value={otp} onChange={(e) => setOtp(e.target.value)} disabled={loading} />
          <div className="onboarding-row"><Button onClick={verify} loading={loading} disabled={loading}>Verify email</Button></div>
        </>
      )}
    </div>
  );
};

/* ---------------- 2. Centre profile ---------------- */
const CentreProfilePanel = ({ markDone }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [form, setForm] = useState({ labName: '', phone: '', address: '', email: '' });
  const [logo, setLogo] = useState(null);
  useEffect(() => {
    let live = true;
    getLabProfile().then((r) => {
      if (!live) return;
      const p = r?.data?.profile || r?.data || {};
      setForm({ labName: p.labName || '', phone: p.phone || '', address: p.address || '', email: p.email || '' });
    }).catch((e) => live && setError(getErrorMessage(e, 'Failed to load profile.')))
      .finally(() => live && setLoading(false));
    return () => { live = false; };
  }, []);
  const save = async () => {
    setSaving(true); setError(''); setNotice('');
    try {
      const r = await updateLabProfile({ labName: form.labName, phone: form.phone, address: form.address, email: form.email });
      if (!r?.success) throw new Error(r?.message || 'Save failed.');
      if (logo) {
        const lr = await uploadLogo(logo);
        if (!lr?.success) throw new Error(lr?.message || 'Profile saved but logo upload failed.');
      }
      setNotice('Centre profile saved.');
      setLogo(null);
      await markDone('centre-profile');
    } catch (e) { setError(getErrorMessage(e, 'Save failed.')); }
    finally { setSaving(false); }
  };
  if (loading) return <LoadingSpinner label="Loading centre profile..." />;
  return (
    <div className="onboarding-form">
      <PanelMsg error={error} success={notice} />
      <div className="onboarding-grid2">
        <Input label="Lab / centre name" value={form.labName} onChange={(e) => setForm({ ...form, labName: e.target.value })} disabled={saving} />
        <Input label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} disabled={saving} />
      </div>
      <Input label="Address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} disabled={saving} />
      <Input label="Lab email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} disabled={saving} />
      <FileUploader label="Lab logo (JPG/PNG, 2 MB)" subtitle="Uploads immediately on save" accept=".jpg,.jpeg,.png" value={logo} disabled={saving} onChange={setLogo} />
      <div className="onboarding-row"><Button onClick={save} loading={saving} disabled={saving}>Save centre profile</Button></div>
    </div>
  );
};

/* ---------------- 3. Letterhead ---------------- */
const LetterheadPanel = ({ markDone }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [margin, setMargin] = useState('90');
  const [file, setFile] = useState(null);
  const [current, setCurrent] = useState('');
  useEffect(() => {
    let live = true;
    getLabProfile().then((r) => {
      if (!live) return;
      const p = r?.data?.profile || r?.data || {};
      setMargin(String(p.letterheadTopMargin ?? 90));
      setCurrent(p.letterheadUrl || '');
    }).catch((e) => live && setError(getErrorMessage(e, 'Failed to load.')))
      .finally(() => live && setLoading(false));
    return () => { live = false; };
  }, []);
  const save = async () => {
    setSaving(true); setError(''); setNotice('');
    try {
      if (file) {
        const r = await uploadLetterhead(file);
        if (!r?.success) throw new Error(r?.message || 'Letterhead upload failed.');
      }
      const r2 = await updateLabProfile({ letterheadTopMargin: Number(margin) || 0 });
      if (!r2?.success) throw new Error(r2?.message || 'Save failed.');
      setNotice('Letterhead saved.'); setFile(null);
      await markDone('letterhead');
    } catch (e) { setError(getErrorMessage(e, 'Save failed.')); }
    finally { setSaving(false); }
  };
  if (loading) return <LoadingSpinner label="Loading letterhead..." />;
  return (
    <div className="onboarding-form">
      <PanelMsg error={error} success={notice} />
      {current && <p className="onboarding-hint">Current file: <span className="onboarding-mono">{current}</span></p>}
      <FileUploader label="Letterhead image (PDF/JPG/PNG, 10 MB)" accept=".pdf,.jpg,.jpeg,.png" value={file} disabled={saving} onChange={setFile} />
      <Input label="Top margin for PDFs" type="number" value={margin} onChange={(e) => setMargin(e.target.value)} disabled={saving} />
      <div className="onboarding-row"><Button onClick={save} loading={saving} disabled={saving}>Save letterhead</Button></div>
    </div>
  );
};

/* ---------------- 4. Rates ---------------- */
const RatesPanel = ({ markDone }) => {
  const [loading, setLoading] = useState(true);
  const [tests, setTests] = useState([]);
  const [prices, setPrices] = useState({});
  const [savingId, setSavingId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  useEffect(() => {
    let live = true;
    getTests({ limit: 50, status: 'Active' }).then((r) => {
      if (!live) return;
      const list = getTestList(r).slice(0, 8);
      setTests(list);
      setPrices(Object.fromEntries(list.map((t) => [t._id, t.price ?? ''])));
    }).catch((e) => live && setError(getErrorMessage(e, 'Failed to load tests.')))
      .finally(() => live && setLoading(false));
    return () => { live = false; };
  }, []);
  const save = async (t) => {
    setSavingId(t._id); setError(''); setNotice('');
    try {
      const r = await updateTestRate(t._id, Number(prices[t._id]));
      if (!r?.success) throw new Error(r?.message || 'Rate update failed.');
      setNotice(`Rate saved for ${t.name}.`);
      await markDone('rates');
    } catch (e) { setError(getErrorMessage(e, 'Rate update failed.')); }
    finally { setSavingId(''); }
  };
  if (loading) return <LoadingSpinner label="Loading test rates..." />;
  if (!tests.length) return <p className="onboarding-hint">No active tests found. Add tests in Lab → Test Database first.</p>;
  return (
    <div className="onboarding-form">
      <PanelMsg error={error} success={notice} />
      {tests.map((t) => (
        <div className="onboarding-inline-row" key={t._id}>
          <span className="onboarding-inline-name">{t.name} <span className="onboarding-hint">({t.code || 'no code'})</span></span>
          <input className="form-control onboarding-price" type="number" min="0" value={prices[t._id] ?? ''} onChange={(e) => setPrices({ ...prices, [t._id]: e.target.value })} aria-label={`Price for ${t.name}`} />
          <Button size="sm" variant="secondary" onClick={() => save(t)} loading={savingId === t._id} disabled={!!savingId}>Save</Button>
        </div>
      ))}
    </div>
  );
};

/* ---------------- 5. Normals ---------------- */
const NormalsPanel = ({ markDone }) => {
  const [loading, setLoading] = useState(true);
  const [tests, setTests] = useState([]);
  const [testId, setTestId] = useState('');
  const [form, setForm] = useState({ referenceRange: '', normalLow: '', normalHigh: '', criticalLow: '', criticalHigh: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  useEffect(() => {
    let live = true;
    getTests({ limit: 100, status: 'Active' }).then((r) => {
      if (!live) return;
      const list = getTestList(r);
      setTests(list);
      if (list[0]) {
        setTestId(list[0]._id);
        setForm({
          referenceRange: list[0].referenceRange || '',
          normalLow: list[0].normalLow ?? '', normalHigh: list[0].normalHigh ?? '',
          criticalLow: list[0].criticalLow ?? '', criticalHigh: list[0].criticalHigh ?? '',
        });
      }
    }).catch((e) => live && setError(getErrorMessage(e, 'Failed to load tests.')))
      .finally(() => live && setLoading(false));
    return () => { live = false; };
  }, []);
  const pick = (id) => {
    setTestId(id);
    const t = tests.find((x) => String(x._id) === String(id));
    if (t) setForm({
      referenceRange: t.referenceRange || '',
      normalLow: t.normalLow ?? '', normalHigh: t.normalHigh ?? '',
      criticalLow: t.criticalLow ?? '', criticalHigh: t.criticalHigh ?? '',
    });
  };
  const save = async () => {
    if (!testId) { setError('Pick a test first.'); return; }
    setSaving(true); setError(''); setNotice('');
    try {
      const payload = { referenceRange: form.referenceRange };
      ['normalLow', 'normalHigh', 'criticalLow', 'criticalHigh'].forEach((k) => {
        if (form[k] !== '' && form[k] !== null && form[k] !== undefined) payload[k] = Number(form[k]);
      });
      const r = await updateTest(testId, payload);
      if (!r?.success) throw new Error(r?.message || 'Save failed.');
      setNotice('Reference range saved.');
      await markDone('normals');
    } catch (e) { setError(getErrorMessage(e, 'Save failed.')); }
    finally { setSaving(false); }
  };
  if (loading) return <LoadingSpinner label="Loading tests..." />;
  return (
    <div className="onboarding-form">
      <PanelMsg error={error} success={notice} />
      <Select label="Test" value={testId} onChange={(e) => pick(e.target.value)} options={tests.map((t) => ({ value: t._id, label: `${t.name} (${t.code || '—'})` }))} />
      <Input label="Reference range (text)" value={form.referenceRange} onChange={(e) => setForm({ ...form, referenceRange: e.target.value })} disabled={saving} />
      <div className="onboarding-grid2">
        <Input label="Normal low" type="number" value={form.normalLow} onChange={(e) => setForm({ ...form, normalLow: e.target.value })} disabled={saving} />
        <Input label="Normal high" type="number" value={form.normalHigh} onChange={(e) => setForm({ ...form, normalHigh: e.target.value })} disabled={saving} />
        <Input label="Critical low" type="number" value={form.criticalLow} onChange={(e) => setForm({ ...form, criticalLow: e.target.value })} disabled={saving} />
        <Input label="Critical high" type="number" value={form.criticalHigh} onChange={(e) => setForm({ ...form, criticalHigh: e.target.value })} disabled={saving} />
      </div>
      <div className="onboarding-row"><Button onClick={save} loading={saving} disabled={saving}>Save ranges</Button></div>
    </div>
  );
};

/* ---------------- 6. Users ---------------- */
const UsersPanel = ({ markDone }) => {
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', role: 'Employee' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await getUsers({});
      setUsers(getUserList(r));
    } catch (e) { setError(getErrorMessage(e, 'Failed to load users.')); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  const create = async () => {
    if (!form.name.trim() || !form.email.trim() || !form.password) { setError('Name, email and password are required.'); return; }
    setSaving(true); setError(''); setNotice('');
    try {
      const r = await createUser({ name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim(), password: form.password, role: form.role, status: 'Active' });
      if (!r?.success) throw new Error(r?.message || 'Create failed.');
      setNotice(`Login created for ${form.name}.`);
      setForm({ name: '', email: '', phone: '', password: '', role: 'Employee' });
      await load();
      await markDone('users');
    } catch (e) { setError(getErrorMessage(e, 'Create failed.')); }
    finally { setSaving(false); }
  };
  return (
    <div className="onboarding-form">
      <PanelMsg error={error} success={notice} />
      {loading ? <LoadingSpinner label="Loading staff..." /> : (
        <p className="onboarding-hint">{users.length ? `${users.length} staff login(s): ${users.slice(0, 5).map((u) => u.name || u.email).join(', ')}${users.length > 5 ? '…' : ''}` : 'No staff logins yet — create the first one below.'}</p>
      )}
      <div className="onboarding-grid2">
        <Input label="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} disabled={saving} />
        <Input label="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} disabled={saving} />
        <Input label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} disabled={saving} />
        <Input label="Temporary password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} disabled={saving} />
      </div>
      <Select label="Role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} options={[{ value: 'Employee', label: 'Employee' }, { value: 'Admin', label: 'Admin' }]} />
      <div className="onboarding-row"><Button onClick={create} loading={saving} disabled={saving}>Create staff login</Button></div>
    </div>
  );
};

/* ---------------- 7. Browser code ---------------- */
const BrowsersPanel = ({ markDone }) => {
  const [loading, setLoading] = useState(true);
  const [browsers, setBrowsers] = useState([]);
  const [label, setLabel] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await getBrowsers();
      setBrowsers(getBrowserList(r));
    } catch (e) { setError(getErrorMessage(e, 'Failed to load browsers.')); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  const register = async () => {
    setSaving(true); setError(''); setNotice('');
    try {
      const r = await createBrowser({ label: label.trim() || 'Front desk' });
      if (!r?.success) throw new Error(r?.message || 'Register failed.');
      setNotice(`Browser registered: ${r.data?.code || 'code issued'}.`);
      setLabel('');
      await load();
      await markDone('browser-code');
    } catch (e) { setError(getErrorMessage(e, 'Register failed.')); }
    finally { setSaving(false); }
  };
  return (
    <div className="onboarding-form">
      <PanelMsg error={error} success={notice} />
      {loading ? <LoadingSpinner label="Loading browsers..." /> : (
        <p className="onboarding-hint">{browsers.length ? `${browsers.length} registered: ${browsers.slice(0, 5).map((b) => b.code).join(', ')}` : 'No browsers registered yet.'}</p>
      )}
      <Input label="Device label (e.g. Reception PC)" value={label} onChange={(e) => setLabel(e.target.value)} disabled={saving} />
      <div className="onboarding-row"><Button onClick={register} loading={saving} disabled={saving}>Register this browser</Button></div>
    </div>
  );
};

/* ---------------- 8. SMS setup ---------------- */
const SmsPanel = ({ markDone }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [credits, setCredits] = useState(null);
  const [form, setForm] = useState({ smsSenderId: 'PUREPATH', smsEnabled: false, whatsappEnabled: false, emailEnabled: false });
  useEffect(() => {
    let live = true;
    Promise.allSettled([getLabProfile(), getCredits()]).then(([p, c]) => {
      if (!live) return;
      if (p.status === 'fulfilled') {
        const d = p.value?.data?.profile || p.value?.data || {};
        setForm({
          smsSenderId: d.smsSenderId || 'PUREPATH',
          smsEnabled: !!d.smsEnabled, whatsappEnabled: !!d.whatsappEnabled, emailEnabled: !!d.emailEnabled,
        });
      } else if (live) setError(getErrorMessage(p.reason, 'Failed to load SMS settings.'));
      if (c.status === 'fulfilled') setCredits(c.value?.data ?? null);
    }).finally(() => live && setLoading(false));
    return () => { live = false; };
  }, []);
  const save = async () => {
    setSaving(true); setError(''); setNotice('');
    try {
      const r = await updateLabProfile(form);
      if (!r?.success) throw new Error(r?.message || 'Save failed.');
      setNotice('Messaging settings saved.');
      await markDone('sms-setup');
    } catch (e) { setError(getErrorMessage(e, 'Save failed.')); }
    finally { setSaving(false); }
  };
  if (loading) return <LoadingSpinner label="Loading messaging..." />;
  return (
    <div className="onboarding-form">
      <PanelMsg error={error} success={notice} />
      {credits !== null && <p className="onboarding-hint">Credit balance: <span className="onboarding-mono">{typeof credits === 'object' ? JSON.stringify(credits) : String(credits)}</span></p>}
      <Input label="SMS sender ID" value={form.smsSenderId} onChange={(e) => setForm({ ...form, smsSenderId: e.target.value })} disabled={saving} />
      <label className="onboarding-check"><input type="checkbox" checked={form.smsEnabled} onChange={(e) => setForm({ ...form, smsEnabled: e.target.checked })} disabled={saving} /> SMS notifications</label>
      <label className="onboarding-check"><input type="checkbox" checked={form.whatsappEnabled} onChange={(e) => setForm({ ...form, whatsappEnabled: e.target.checked })} disabled={saving} /> WhatsApp notifications</label>
      <label className="onboarding-check"><input type="checkbox" checked={form.emailEnabled} onChange={(e) => setForm({ ...form, emailEnabled: e.target.checked })} disabled={saving} /> Email notifications</label>
      <div className="onboarding-row"><Button onClick={save} loading={saving} disabled={saving}>Save messaging</Button></div>
    </div>
  );
};

/* ---------------- 9. Signatures ---------------- */
const SignaturesPanel = ({ markDone }) => {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: '', title: '', file: null });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [del, setDel] = useState(null);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await getSignatures();
      const arr = Array.isArray(r?.data) ? r.data : r?.data?.signatures || [];
      setList(arr);
    } catch (e) { setError(getErrorMessage(e, 'Failed to load signatures.')); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  const upload = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('Signature name is required.'); return; }
    if (!form.file) { setError('Choose a signature file.'); return; }
    setSaving(true); setError(''); setNotice('');
    try {
      const fd = new FormData();
      fd.append('file', form.file);
      fd.append('name', form.name.trim());
      if (form.title.trim()) fd.append('title', form.title.trim());
      const r = await createSignature(fd);
      if (!r?.success) throw new Error(r?.message || 'Upload failed.');
      setNotice('Signature uploaded.');
      setForm({ name: '', title: '', file: null });
      await load();
      await markDone('signature');
    } catch (err) { setError(getErrorMessage(err, 'Upload failed.')); }
    finally { setSaving(false); }
  };
  const confirmDel = async () => {
    if (!del) return;
    try {
      const r = await deleteSignature(del._id);
      if (!r?.success) throw new Error(r?.message || 'Delete failed.');
      setDel(null); await load();
    } catch (e) { setError(getErrorMessage(e, 'Delete failed.')); setDel(null); }
  };
  return (
    <div className="onboarding-form">
      <PanelMsg error={error} success={notice} />
      {loading ? <LoadingSpinner label="Loading signatures..." /> : (
        <p className="onboarding-hint">{list.length ? `${list.length} signature(s) on file.` : 'No signatures yet — upload the first one below.'}</p>
      )}
      <form onSubmit={upload}>
        <div className="onboarding-grid2">
          <Input label="Doctor / authority name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} disabled={saving} required />
          <Input label="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} disabled={saving} />
        </div>
        <FileUploader label="Signature image" subtitle="PDF, JPG, JPEG, PNG up to 10 MB" accept=".pdf,.jpg,.jpeg,.png" value={form.file} disabled={saving} onChange={(f) => setForm({ ...form, file: f })} />
        <div className="onboarding-row"><Button type="submit" loading={saving} disabled={saving}>Upload signature</Button></div>
      </form>
      {list.slice(0, 5).map((s) => (
        <div className="onboarding-inline-row" key={s._id}>
          <SignaturePreview url={s.imageUrl} label={s.name} />
          <span className="onboarding-inline-name">{s.name} {s.title ? `— ${s.title}` : ''}</span>
          <Button size="sm" variant="danger" onClick={() => setDel(s)} aria-label={`Delete ${s.name}`}><Trash2 size={14} /></Button>
        </div>
      ))}
      <ConfirmDialog isOpen={!!del} onClose={() => setDel(null)} onConfirm={confirmDel} title="Delete signature?" message={`Delete ${del?.name || 'this signature'}?`} confirmText="Delete signature" />
    </div>
  );
};

/* ---------------- 10. First bill ---------------- */
const FirstBillPanel = ({ markDone }) => {
  const [tests, setTests] = useState([]);
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: '', phone: '', age: '', gender: 'Male', testId: '', paid: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  useEffect(() => {
    let live = true;
    Promise.allSettled([getTests({ limit: 100, status: 'Active' }), getBills({ limit: 5 })]).then(([t, b]) => {
      if (!live) return;
      if (t.status === 'fulfilled') {
        const list = getTestList(t.value);
        setTests(list);
        if (list[0]) setForm((f) => ({ ...f, testId: f.testId || list[0]._id }));
      }
      if (b.status === 'fulfilled') setBillListSafe(b.value);
    }).finally(() => live && setLoading(false));
    const setBillListSafe = (v) => setBills(getBillList(v));
    return () => { live = false; };
  }, []);
  const create = async () => {
    if (!form.name.trim() || !form.phone.trim() || !form.age || !form.testId) { setError('Patient name, phone, age and one test are required.'); return; }
    const t = tests.find((x) => String(x._id) === String(form.testId));
    if (!t) { setError('Selected test not found.'); return; }
    setSaving(true); setError(''); setNotice('');
    try {
      const pat = await createPatient({ name: form.name.trim(), phone: form.phone.trim(), gender: form.gender, age: Number(form.age), address: 'Registered Inline' });
      if (!pat?.success) throw new Error(pat?.message || 'Patient registration failed.');
      const bill = await createBill({
        patient: pat.data._id, referringDoctor: null, agent: null,
        items: [{ itemId: t._id, itemType: 'Test', name: t.name, price: Number(t.price) || 0 }],
        discount: 0, paidAmount: Number(form.paid) || 0, paymentMethod: 'Cash',
        department: 'LAB', caseType: 'LabCase', collectionCentre: 'Main',
      });
      if (!bill?.success) throw new Error(bill?.message || 'Bill creation failed.');
      setNotice(`Bill ${bill.data?.billNumber || ''} created for ${form.name}.`);
      setForm({ name: '', phone: '', age: '', gender: 'Male', testId: tests[0]?._id || '', paid: '' });
      const rb = await getBills({ limit: 5 }).catch(() => null);
      if (rb) setBills(getBillList(rb));
      await markDone('first-bill');
    } catch (e) { setError(getErrorMessage(e, 'Bill creation failed.')); }
    finally { setSaving(false); }
  };
  if (loading) return <LoadingSpinner label="Loading billing..." />;
  return (
    <div className="onboarding-form">
      <PanelMsg error={error} success={notice} />
      <p className="onboarding-hint">{bills.length ? `${bills.length} recent bill(s) — creating another completes this step.` : 'No bills yet — create the first one below.'}</p>
      <div className="onboarding-grid2">
        <Input label="Patient name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} disabled={saving} />
        <Input label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} disabled={saving} />
        <Input label="Age (years)" type="number" value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} disabled={saving} />
        <Select label="Gender" value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })} options={[{ value: 'Male', label: 'Male' }, { value: 'Female', label: 'Female' }, { value: 'Other', label: 'Other' }]} />
      </div>
      <Select label="Test" value={form.testId} onChange={(e) => setForm({ ...form, testId: e.target.value })} options={tests.map((t) => ({ value: t._id, label: `${t.name} — ₹${t.price ?? '?'}` }))} />
      <Input label="Paid amount (optional)" type="number" value={form.paid} onChange={(e) => setForm({ ...form, paid: e.target.value })} disabled={saving} />
      <div className="onboarding-row"><Button onClick={create} loading={saving} disabled={saving}>Register patient & create bill</Button></div>
    </div>
  );
};

/* ---------------- 11. First report ---------------- */
const FirstReportPanel = ({ markDone }) => {
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState([]);
  const [reports, setReports] = useState([]);
  const [billId, setBillId] = useState('');
  const [entry, setEntry] = useState(null);
  const [values, setValues] = useState({});
  const [sigs, setSigs] = useState([]);
  const [sigId, setSigId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, r, s] = await Promise.allSettled([getPendingLabCases({ limit: 10 }), getReports({ limit: 5 }), getSignatures()]);
      if (p.status === 'fulfilled') {
        const cases = p.value?.data?.cases || [];
        setPending(cases);
        if (cases[0] && !billId) setBillId(cases[0].bill?._id || '');
      }
      if (r.status === 'fulfilled') {
        const d = r.value?.data;
        setReports(Array.isArray(d) ? d : d?.reports || []);
      }
      if (s.status === 'fulfilled') {
        const arr = Array.isArray(s.value?.data) ? s.value.data : s.value?.data?.signatures || [];
        setSigs(arr);
        if (arr[0]) setSigId(arr[0]._id);
      }
    } catch (e) { setError(getErrorMessage(e, 'Failed to load reports.')); }
    finally { setLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { load(); }, [load]);
  const selected = pending.find((c) => String(c.bill?._id) === String(billId));
  const registerEntry = async () => {
    if (!selected) { setError('Pick a pending bill first.'); return; }
    const patId = selected.bill?.patient?._id || selected.bill?.patient;
    setBusy(true); setError(''); setNotice('');
    try {
      const r = await createResultReport({ patient: patId, bill: selected.bill._id });
      if (!r?.success) throw new Error(r?.message || 'Could not register result.');
      const id = r.data?._id;
      const e = await getReportForEntry(id);
      if (!e?.success) throw new Error(e?.message || 'Could not load entry.');
      setEntry(e.data);
      const tests = e.data?.tests || e.data?.bill?.items || [];
      setValues(Object.fromEntries(tests.map((t, i) => [t.itemId || t.test || t._id || i, ''])));
      setNotice('Result shell registered — enter values below.');
    } catch (e2) { setError(getErrorMessage(e2, 'Result registration failed.')); }
    finally { setBusy(false); }
  };
  const entryTests = entry?.tests || entry?.bill?.items || [];
  const saveAndSign = async () => {
    if (!entry?._id) { setError('Register the result first.'); return; }
    setBusy(true); setError(''); setNotice('');
    try {
      const rows = entryTests.map((t) => {
        const key = t.itemId || t.test || t._id;
        return { test: t.itemId || t.test || undefined, testName: t.name || t.testName || 'Test', value: values[key] ?? '' };
      }).filter((x) => String(x.value).trim() !== '');
      if (!rows.length) throw new Error('Enter at least one result value.');
      const s = await saveReportResults(entry._id, rows);
      if (!s?.success) throw new Error(s?.message || 'Save failed.');
      if (sigId) {
        const sg = await signReport(entry._id, sigId);
        if (!sg?.success) throw new Error(sg?.message || 'Sign failed.');
      }
      const v = await verifyReport(entry._id);
      if (!v?.success) throw new Error(v?.message || 'Verify failed.');
      setNotice('First report published (reported → signed → verified).');
      setEntry(null);
      await load();
      await markDone('first-report');
    } catch (e2) { setError(getErrorMessage(e2, 'Publish failed.')); }
    finally { setBusy(false); }
  };
  if (loading) return <LoadingSpinner label="Loading reports..." />;
  return (
    <div className="onboarding-form">
      <PanelMsg error={error} success={notice} />
      <p className="onboarding-hint">{reports.length ? `${reports.length} report(s) exist.` : 'No reports yet.'} {pending.length ? `${pending.length} bill(s) awaiting result entry.` : 'No pending bills — create a bill first.'}</p>
      {!!pending.length && (
        <>
          <Select label="Pending bill" value={billId} onChange={(e) => setBillId(e.target.value)} options={pending.map((c) => ({ value: c.bill?._id, label: `${c.bill?.billNumber || 'Bill'} — ${c.bill?.patient?.name || 'patient'}` }))} />
          <div className="onboarding-row"><Button variant="secondary" onClick={registerEntry} loading={busy} disabled={busy}>Start result entry</Button></div>
        </>
      )}
      {entry && (
        <>
          {entryTests.map((t, i) => {
            const key = t.itemId || t.test || t._id || i;
            return <Input key={String(key) + i} label={`${t.name || t.testName || 'Test'}${t.unit ? ` (${t.unit})` : ''}`} value={values[key] ?? ''} onChange={(e) => setValues({ ...values, [key]: e.target.value })} disabled={busy} />;
          })}
          {!!sigs.length && <Select label="Sign with" value={sigId} onChange={(e) => setSigId(e.target.value)} options={sigs.map((s) => ({ value: s._id, label: s.name }))} />}
          <div className="onboarding-row"><Button onClick={saveAndSign} loading={busy} disabled={busy}>Save, sign & publish</Button></div>
        </>
      )}
    </div>
  );
};

const PANELS = {
  'verify-email': VerifyEmailPanel,
  'centre-profile': CentreProfilePanel,
  letterhead: LetterheadPanel,
  rates: RatesPanel,
  normals: NormalsPanel,
  users: UsersPanel,
  'browser-code': BrowsersPanel,
  'sms-setup': SmsPanel,
  signature: SignaturesPanel,
  'first-bill': FirstBillPanel,
  'first-report': FirstReportPanel,
};

/* ---------------- Main page ---------------- */
const Onboarding = () => {
  const { user } = useAuth();
  const canManage = isAdmin(user);
  const [onboarding, setOnboarding] = useState({ percent: 0, steps: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState('');
  const [toggling, setToggling] = useState('');
  const reqRef = useRef(0);

  const load = useCallback(async () => {
    const id = ++reqRef.current;
    setLoading(true);
    try {
      const r = await getOnboarding();
      if (id !== reqRef.current) return;
      if (!r?.success) { setError(r?.message || 'Failed to load onboarding.'); return; }
      setOnboarding(r.data || { percent: 0, steps: [] });
      setError('');
    } catch (e) {
      if (id === reqRef.current) setError(getErrorMessage(e, 'Failed to load onboarding.'));
    } finally {
      if (id === reqRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const steps = useMemo(() => {
    const raw = Array.isArray(onboarding.steps) ? onboarding.steps : [];
    return raw.map((s, i) => ({
      ...s,
      key: s.key || `step-${i}`,
      title: s.title || s.label || s.key,
      description: s.description || '',
      Icon: (STEP_META[s.key] || {}).icon || Circle,
      done: !!s.done,
    }));
  }, [onboarding]);

  const percent = onboarding.percent ?? 0;
  const doneCount = steps.filter((s) => s.done).length;
  const next = steps.find((s) => !s.done);
  const complete = steps.length > 0 && doneCount === steps.length;

  useEffect(() => {
    if (!expanded && next) setExpanded(next.key);
  }, [next, expanded]);

  const markDone = useCallback(async (key) => {
    if (!canManage) return;
    setToggling(key);
    try {
      const r = await setOnboardingStep(key, true);
      if (!r?.success) throw new Error(r?.message || 'Could not mark done.');
      await load();
    } catch (e) {
      setError(getErrorMessage(e, 'Could not update step.'));
    } finally {
      setToggling('');
    }
  }, [canManage, load]);

  const toggle = async (key, done) => {
    if (!canManage || toggling) return;
    setToggling(key);
    try {
      const r = await setOnboardingStep(key, done);
      if (!r?.success) throw new Error(r?.message || 'Update failed.');
      await load();
    } catch (e) { setError(getErrorMessage(e, 'Update failed.')); }
    finally { setToggling(''); }
  };

  const ring = 2 * Math.PI * 42;
  const offset = ring - (ring * (Number(percent) || 0)) / 100;

  return (
    <div className="onboarding-page">
      <PageHeader
        title="Onboarding"
        subtitle="Complete every setup action right here — each step works inline."
        action={canManage ? <Button variant="secondary" onClick={load} icon={<RefreshCw size={14} />}>Refresh</Button> : null}
      />
      {error && <div className="onboarding-alert onboarding-alert-error" role="alert"><span>{error}</span><Button variant="secondary" size="sm" onClick={load}>Retry</Button></div>}

      <section className="onboarding-hero" aria-label="Onboarding progress">
        <div className="onboarding-ring" aria-hidden="true">
          <svg width="96" height="96" viewBox="0 0 96 96">
            <circle className="onboarding-ring-track" cx="48" cy="48" r="42" fill="none" strokeWidth="10" />
            <circle className="onboarding-ring-fill" cx="48" cy="48" r="42" fill="none" strokeWidth="10"
              strokeDasharray={ring} strokeDashoffset={offset} />
          </svg>
          <span className="onboarding-ring-label">{loading ? '…' : `${percent}%`}</span>
        </div>
        <div className="onboarding-hero-text">
          <h2 className="onboarding-hero-title">{complete ? 'Setup complete — nice work!' : loading ? 'Loading your checklist…' : next ? `Up next: ${next.title}` : 'Getting started'}</h2>
          <p className="onboarding-hero-sub">{doneCount} of {steps.length} steps complete. Every action below saves to the real API and auto-marks its step done.</p>
          {complete
            ? <span className="onboarding-hero-done"><CheckCircle2 size={16} /> All steps done</span>
            : next && <button className="onboarding-hero-cta" onClick={() => setExpanded(next.key)}>Continue: {next.title}</button>}
        </div>
      </section>

      {loading ? <LoadingSpinner label="Loading onboarding..." /> : (
        <div className="onboarding-grid">
          {steps.map((step) => {
            const Panel = PANELS[step.key];
            const isOpen = expanded === step.key;
            const isNext = next?.key === step.key;
            return (
              <article className={`onboarding-step${isNext ? ' is-next' : ''}${step.done ? ' is-done' : ''}`} key={step.key}>
                <div className="onboarding-step-top">
                  <span className="onboarding-step-icon"><step.Icon size={20} aria-hidden="true" /></span>
                  <span className={`onboarding-step-badge${step.done ? ' done' : isNext ? ' next' : ' todo'}`}>
                    {step.done ? 'Done' : isNext ? 'Up next' : 'To do'}
                  </span>
                </div>
                <h3 className="onboarding-step-title">{step.title}</h3>
                <p className="onboarding-step-desc">{step.description}</p>
                <div className="onboarding-step-actions">
                  <Button variant={isOpen ? 'secondary' : 'primary'} size="sm" onClick={() => setExpanded(isOpen ? '' : step.key)}>
                    {isOpen ? <><ChevronUp size={14} /> Hide</> : <><ChevronDown size={14} /> {step.done ? 'Review' : 'Do it here'}</>}
                  </Button>
                  {canManage && (
                    <Button variant="secondary" size="sm" disabled={!!toggling} onClick={() => toggle(step.key, !step.done)}>
                      {toggling === step.key ? 'Saving…' : step.done ? 'Mark undone' : 'Mark done'}
                    </Button>
                  )}
                </div>
                {isOpen && (
                  <div className="onboarding-step-body">
                    {!canManage
                      ? <p className="onboarding-hint">Read-only — an Admin completes this step.</p>
                      : Panel
                        ? step.key === 'verify-email'
                          ? <Panel defaultEmail={user?.email} markDone={markDone} />
                          : <Panel markDone={markDone} />
                        : <p className="onboarding-hint">No inline form for this step yet.</p>}
                    <p className="onboarding-hint"> completion date: {step.done && step.updatedAt ? formatDate(step.updatedAt) : step.done ? 'done' : 'pending'}</p>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Onboarding;
