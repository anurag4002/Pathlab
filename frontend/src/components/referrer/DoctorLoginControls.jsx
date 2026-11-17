import React, { useCallback, useEffect, useState } from 'react';
import { Copy, KeyRound, RefreshCw } from 'lucide-react';
import { Button, Input, Modal, Select } from '../common';
import { notify } from '../common/Toast/toast';
import { getDoctorLogins, giveDoctorLogin, resetDoctorPassword, updateDoctorLogin } from '../../services/doctorService';
import { getBranches } from '../../services/branchService';
import './doctorLogin.css';

// Referring-doctor logins, shared by Referral doctors and Doctor access.
// A doctor signs in on the normal login page with their mobile number (or
// email) and the password the admin sets here, and sees only the patients
// they referred.

/** Logins keyed by Doctor id. */
export function useDoctorLogins(enabled = true) {
  const [logins, setLogins] = useState({});
  const [loading, setLoading] = useState(false);
  const reload = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      const res = await getDoctorLogins();
      if (res?.success) setLogins(Object.fromEntries((res.data || []).map((l) => [String(l.doctorId), l])));
    } catch { /* the list still works without login details */ }
    finally { setLoading(false); }
  }, [enabled]);
  useEffect(() => { reload(); }, [reload]);
  return { logins, loading, reload };
}

const tenDigits = (value) => {
  const digits = String(value || '').replace(/\D/g, '');
  const local = digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits.length === 11 && digits.startsWith('0') ? digits.slice(1) : digits;
  return /^[6-9]\d{9}$/.test(local) ? local : '';
};

// Easy to read aloud or type on a phone: no 0/O or 1/l/I.
const makePassword = () => {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const bytes = new Uint32Array(10);
  window.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => chars[b % chars.length]).join('');
};

/** 'with' (can sign in), 'off' (turned off) or 'none'. */
export const doctorLoginState = (login) => (!login ? 'none' : login.status === 'Active' ? 'with' : 'off');

/** Short "has a login?" text for a table cell. */
export function DoctorLoginStatus({ login }) {
  if (!login) return <span className="dl-pill">No login</span>;
  if (login.role && login.role !== 'Referrer') return <span className="dl-pill">Staff login</span>;
  return (
    <span className="dl-status">
      <span className={`dl-pill ${login.status === 'Active' ? 'is-on' : 'is-off'}`}>{login.status === 'Active' ? 'Can sign in' : 'Login off'}</span>
      <span className="dl-id">{login.loginId}</span>
    </span>
  );
}

/** Row menu items for a doctor (give / reset / turn off / turn on). */
export function doctorLoginMenuItems(doctor, login, { open, toggle }) {
  if (!login) return [{ label: 'Give login', onClick: () => open(doctor, 'give') }];
  if (login.role && login.role !== 'Referrer') return [];
  return [
    { label: 'Reset password', onClick: () => open(doctor, 'reset') },
    login.status === 'Active'
      ? { label: 'Turn off login', onClick: () => toggle(doctor, login), danger: true }
      : { label: 'Turn login back on', onClick: () => toggle(doctor, login) }
  ];
}

/** Turn a doctor's login off or back on. */
export async function toggleDoctorLogin(doctor, login, done) {
  const next = login.status === 'Active' ? 'Inactive' : 'Active';
  try {
    const res = await updateDoctorLogin(doctor._id, { status: next });
    if (res?.success) { notify(next === 'Active' ? `${doctor.name} can sign in again` : `${doctor.name} can no longer sign in`); done?.(); }
  } catch (err) {
    notify(err.response?.data?.message || 'Could not change the login.');
  }
}

/**
 * Give a login ('give') or set a new password ('reset').
 * After saving, shows the ID and password once so the admin can pass them on.
 */
export function DoctorLoginDialog({ doctor, mode, login, onClose, onDone }) {
  const isOpen = !!doctor && !!mode;
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [branch, setBranch] = useState('');
  const [branches, setBranches] = useState([]);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(null);

  // Filled once when the dialog opens (not when the login list reloads after
  // saving, which would hide the "give these to the doctor" panel).
  const loginIdRef = React.useRef('');
  loginIdRef.current = login?.loginId || '';
  useEffect(() => {
    if (!isOpen) return;
    setLoginId(mode === 'give' ? (tenDigits(doctor.phone) || doctor.email || '') : loginIdRef.current);
    setPassword(makePassword());
    setBranch(doctor.branch ? String(doctor.branch._id || doctor.branch) : '');
    setErrors({});
    setDone(null);
    if (mode === 'give') {
      getBranches().then((r) => setBranches((r?.data || []).filter((b) => b.status !== 'Inactive'))).catch(() => setBranches([]));
    }
  }, [isOpen, mode, doctor]);

  const save = async (e) => {
    e?.preventDefault();
    const errs = {};
    const id = loginId.trim();
    if (mode === 'give') {
      if (!id) errs.loginId = 'Enter the mobile number or email the doctor will sign in with';
      else if (!id.includes('@') && !tenDigits(id)) errs.loginId = 'Enter a valid 10-digit mobile number, or an email';
    }
    if (password.length < 8) errs.password = 'Use at least 8 characters';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    try {
      const res = mode === 'give'
        ? await giveDoctorLogin(doctor._id, { loginId: id, password, branch: branch || null })
        : await resetDoctorPassword(doctor._id, password);
      if (res?.success) { setDone({ loginId: res.data?.loginId || id, password }); onDone?.(); }
    } catch (err) {
      const data = err.response?.data || {};
      setErrors({ ...(data.errors || {}), api: data.errors ? '' : (data.message || 'Could not save. Try again.') });
    } finally {
      setSaving(false);
    }
  };

  const copyDetails = async () => {
    const text = `Sign in at ${window.location.origin}/login\nID: ${done.loginId}\nPassword: ${done.password}`;
    try { await navigator.clipboard.writeText(text); notify('Sign-in details copied'); } catch { notify('Could not copy. Please note them down.'); }
  };

  const title = mode === 'give' ? `Give ${doctor?.name || 'doctor'} a login` : `New password for ${doctor?.name || 'doctor'}`;
  return (
    <Modal isOpen={isOpen} onClose={onClose} variant="drawer" title={title}
      footer={done ? <Button variant="primary" onClick={onClose}>Done</Button> : <>
        <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
        <Button variant="primary" onClick={save} loading={saving}>{mode === 'give' ? 'Give login' : 'Save new password'}</Button>
      </>}>
      {done ? (
        <div className="dl-done" data-testid="doctor-login-done">
          <p>Give these to the doctor. They sign in on the normal login page and see only the patients they referred.</p>
          <dl>
            <dt>ID</dt><dd>{done.loginId}</dd>
            <dt>Password</dt><dd className="dl-secret">{done.password}</dd>
          </dl>
          <Button variant="secondary" icon={<Copy size={14} />} onClick={copyDetails}>Copy sign-in details</Button>
          <p className="dl-help">The password is not shown again. If it is lost, use Reset password.</p>
        </div>
      ) : (
        <form className="dl-form" onSubmit={save} noValidate>
          {errors.api && <div className="form-error" role="alert">{errors.api}</div>}
          {mode === 'give' ? (
            <Input label="Sign-in ID (mobile number or email)" name="loginId" value={loginId} onChange={(e) => setLoginId(e.target.value)}
              error={errors.loginId} helperText="Usually the doctor's mobile number." inputMode="email" autoComplete="off" required />
          ) : (
            <p className="dl-help">Sign-in ID: <strong>{loginId}</strong>. Saving signs the doctor out on every device.</p>
          )}
          <div className="dl-password">
            <Input label="Password" name="password" value={password} onChange={(e) => setPassword(e.target.value)}
              error={errors.password} helperText="At least 8 characters. You can type your own." autoComplete="new-password" required />
            <Button variant="secondary" size="sm" icon={<RefreshCw size={14} />} onClick={() => setPassword(makePassword())} aria-label="Make a new password">New</Button>
          </div>
          {mode === 'give' && (
            <Select label="Patient requests go to" name="branch" value={branch} onChange={(e) => setBranch(e.target.value)}
              placeholder="Main branch" options={branches.filter((b) => b.code !== 'MAIN').map((b) => ({ value: b._id, label: b.name }))} />
          )}
          <p className="dl-help"><KeyRound size={13} aria-hidden="true" /> The doctor can see their patients' bills and signed reports, and send requests. They cannot change anything.</p>
        </form>
      )}
    </Modal>
  );
}
