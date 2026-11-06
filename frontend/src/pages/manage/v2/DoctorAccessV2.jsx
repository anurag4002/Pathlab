import React, { useEffect, useMemo, useState } from 'react';
import { Plus, RefreshCw, Send, Copy } from 'lucide-react';
import { getUsers, createUser, updateUser, deleteUser } from '../../../services/authService';
import { getInvites, createInvite } from '../../../services/doctorPortalService';
import { PageHeader, Button, Modal, Input, ConfirmDialog, RowMenu, StatGroup } from '../../../components/common';
import ReportTable from '../../../components/business/ReportTable';
import { notify } from '../../../components/common/Toast/toast';
import { dayLabel } from '../../../utils/reportFormat';
import useDraft from './useDraft';
import '../../../components/business/business.css';
import './manage.css';

const EMPTY_LOGIN = { name: '', email: '', phone: '', password: '', status: 'Active' };
const EMPTY_INVITE = { name: '', email: '', phone: '' };
const INVITE_STATUS = { Pending: ['Waiting', 'is-warn'], Accepted: ['Joined', 'is-good'], Expired: ['Expired', ''] };

// Copies an invite code without ever showing it on screen.
const copyCode = async (token) => {
  if (!token) { notify('No code for this invite.'); return; }
  try { await navigator.clipboard.writeText(token); notify('Invite code copied - paste it into a message to the doctor'); }
  catch { notify('Could not copy. Try again.'); }
};

// Doctor access (new look): doctors who can sign in to see their patients' reports.
export default function DoctorAccessV2() {
  const [doctors, setDoctors] = useState([]);
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('doctors');

  const [loginOpen, setLoginOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [login, setLogin] = useState(EMPTY_LOGIN);
  const [loginError, setLoginError] = useState('');
  const [savingLogin, setSavingLogin] = useState(false);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [invite, setInvite, clearInvite] = useDraft('doctor-invite', EMPTY_INVITE);
  const [inviteError, setInviteError] = useState('');
  const [inviteToken, setInviteToken] = useState('');
  const [savingInvite, setSavingInvite] = useState(false);

  const [del, setDel] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [u, i] = await Promise.allSettled([getUsers(), getInvites()]);
      if (u.status === 'fulfilled' && u.value?.success) setDoctors((u.value.data || []).filter((x) => x.role === 'Doctor'));
      if (i.status === 'fulfilled' && i.value?.success) setInvites(i.value.data?.invites || i.value.data || []);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const q = search.trim().toLowerCase();
  const doctorRows = useMemo(() => doctors.filter((d) => !q || `${d.name} ${d.email} ${d.phone}`.toLowerCase().includes(q)), [doctors, q]);
  const inviteRows = useMemo(() => invites.filter((v) => !q || `${v.name} ${v.email} ${v.phone}`.toLowerCase().includes(q))
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)), [invites, q]);
  const waiting = invites.filter((v) => v.status === 'Pending').length;

  const openNewLogin = () => { setEditing(null); setLogin(EMPTY_LOGIN); setLoginError(''); setLoginOpen(true); };
  const openEdit = (d) => { setEditing(d); setLogin({ name: d.name || '', email: d.email || '', phone: d.phone || '', password: '', status: d.status || 'Active' }); setLoginError(''); setLoginOpen(true); };
  const saveLogin = async (e) => {
    e?.preventDefault();
    if (!login.name.trim() || !login.email.trim()) { setLoginError('Enter the doctor\'s name and email.'); return; }
    if (!editing && login.password.length < 6) { setLoginError('Choose a password of at least 6 characters.'); return; }
    setSavingLogin(true); setLoginError('');
    try {
      const payload = { ...login, role: 'Doctor' };
      if (!payload.password) delete payload.password;
      const res = editing ? await updateUser(editing._id, payload) : await createUser(payload);
      if (res.success) { setLoginOpen(false); setLogin(EMPTY_LOGIN); notify(editing ? 'Doctor updated' : 'Doctor can now sign in'); load(); }
    } catch (err) { setLoginError(err.response?.data?.message || 'Could not save. Try again.'); }
    finally { setSavingLogin(false); }
  };
  const sendInvite = async (e) => {
    e?.preventDefault();
    if (!invite.name.trim() || !invite.email.trim()) { setInviteError('Enter the doctor\'s name and email.'); return; }
    setSavingInvite(true); setInviteError(''); setInviteToken('');
    try {
      const r = await createInvite(invite);
      if (r.success) { setInviteToken(r.data?.token || r.data?.invite?.token || ''); clearInvite(); load(); }
    } catch (err) { setInviteError(err.response?.data?.message || 'Could not create the invite.'); }
    finally { setSavingInvite(false); }
  };
  const remove = async () => {
    setDeleting(true);
    try { const res = await deleteUser(del._id); if (res.success) { notify('Doctor removed'); load(); } }
    catch (err) { notify(err.response?.data?.message || 'Could not remove.'); }
    finally { setDeleting(false); setDel(null); }
  };
  const toggle = async (d) => {
    const next = d.status === 'Active' ? 'Inactive' : 'Active';
    try { const res = await updateUser(d._id, { name: d.name, email: d.email, phone: d.phone || '', role: 'Doctor', status: next }); if (res.success) { notify(next === 'Active' ? 'Sign-in allowed again' : 'Sign-in switched off'); load(); } }
    catch (err) { notify(err.response?.data?.message || 'Could not update.'); }
  };

  return (
    <div className="biz-page">
      <PageHeader
        title="Doctor access"
        subtitle="Doctors who can sign in to see their own patients' reports. Invite them, or set up their sign-in yourself."
        action={<div className="biz-actions">
          <Button variant="secondary" size="sm" icon={<RefreshCw size={14} />} onClick={load}>Refresh</Button>
          <Button variant="secondary" size="sm" icon={<Plus size={14} />} onClick={openNewLogin}>Set up sign-in</Button>
          <Button variant="primary" size="sm" icon={<Send size={14} />} onClick={() => { setInviteError(''); setInviteToken(''); setInviteOpen(true); }}>Invite a doctor</Button>
        </div>}
      />

      <StatGroup loading={loading} items={[
        { label: 'Doctors with access', value: String(doctors.filter((d) => d.status === 'Active').length) },
        { label: 'Switched off', value: String(doctors.filter((d) => d.status !== 'Active').length) },
        { label: 'Invites waiting', value: String(waiting), hint: 'Not joined yet', tone: waiting ? 'warning' : undefined },
      ]} />

      <div className="biz-tabs" role="tablist" aria-label="Show">
        {[['doctors', 'Doctors', doctors.length], ['invites', 'Invites', invites.length]].map(([key, label, n]) => (
          <button key={key} type="button" role="tab" aria-selected={tab === key} className={tab === key ? 'is-on' : ''} onClick={() => setTab(key)}>{label}<span>{n}</span></button>
        ))}
      </div>
      <div className="form-group mg-hidden-search" style={{ display: 'none' }}><input type="search" data-page-search="" aria-label="Search doctors" placeholder="Doctor name, email or phone" value={search} onChange={(e) => setSearch(e.target.value)} /></div>

      {tab === 'doctors' ? (
        <ReportTable loading={loading} rows={doctorRows} rowKey={(d) => d._id} onRowClick={openEdit}
          empty="No doctor can sign in yet. Invite one, or set up their sign-in."
          columns={[
            { key: 'name', label: 'Doctor', render: (d) => <><div className="mg-name">{d.name}</div><div className="mg-sub">{d.email}</div></> },
            { key: 'phone', label: 'Phone', render: (d) => d.phone || <span className="muted">Not set</span> },
            { key: 'status', label: 'Sign-in', render: (d) => <span className={`mg-pill ${d.status === 'Active' ? 'is-good' : ''}`}>{d.status === 'Active' ? 'Allowed' : 'Switched off'}</span> },
            { key: 'act', label: '', align: 'right', render: (d) => (
              <span className="mg-row-actions" onClick={(e) => e.stopPropagation()}>
                <Button variant="secondary" size="sm" onClick={() => openEdit(d)}>Edit</Button>
                <RowMenu items={[
                  { label: d.status === 'Active' ? 'Switch off sign-in' : 'Allow sign-in again', onClick: () => toggle(d) },
                  { label: 'Remove', danger: true, onClick: () => setDel(d) },
                ]} />
              </span>
            ) },
          ]} />
      ) : (
        <ReportTable loading={loading} rows={inviteRows} rowKey={(v, i) => v._id || i} empty="No invites sent yet."
          columns={[
            { key: 'name', label: 'Doctor', render: (v) => <><div className="mg-name">{v.name}</div><div className="mg-sub">{v.email}{v.phone ? ` · ${v.phone}` : ''}</div></> },
            { key: 'status', label: 'Status', render: (v) => { const [label, tone] = INVITE_STATUS[v.status] || [v.status, '']; return <span className={`mg-pill ${tone}`}>{label}</span>; } },
            { key: 'sent', label: 'Sent', render: (v) => <span className="muted">{v.createdAt ? dayLabel(v.createdAt) : ''}</span> },
            { key: 'exp', label: 'Expires', render: (v) => <span className="muted">{v.expiresAt ? dayLabel(v.expiresAt) : ''}</span> },
            { key: 'act', label: '', align: 'right', render: (v) => (v.status === 'Pending' && v.token
              ? <Button variant="secondary" size="sm" icon={<Copy size={13} />} onClick={() => copyCode(v.token)}>Copy invite code</Button> : null) },
          ]} />
      )}

      <Modal isOpen={inviteOpen} onClose={() => setInviteOpen(false)} variant="drawer" title="Invite a doctor"
        footer={inviteToken ? <Button variant="primary" onClick={() => setInviteOpen(false)}>Done</Button> : <>
          <span className="mg-draft-note">Closing keeps what you typed.</span>
          <Button variant="secondary" onClick={() => setInviteOpen(false)}>Cancel</Button>
          <Button variant="primary" onClick={sendInvite} loading={savingInvite}>Create invite</Button>
        </>}>
        {inviteToken ? (
          <div className="mg-form">
            <div className="mg-form-section">
              <h3>Invite created</h3>
              <p className="mg-help" style={{ margin: 0 }}>Copy the invite code and send it to the doctor (WhatsApp or email). They use it once to choose their password. The code is not shown here for safety.</p>
              <div><Button variant="primary" icon={<Copy size={14} />} onClick={() => copyCode(inviteToken)}>Copy invite code</Button></div>
            </div>
          </div>
        ) : (
          <form className="mg-form" onSubmit={sendInvite}>
            <div className="mg-form-section">
              <Input label="Doctor's name *" value={invite.name} onChange={(e) => setInvite((s) => ({ ...s, name: e.target.value }))} placeholder="e.g. Dr. Anil Sharma" autoFocus />
              <Input label="Email *" type="email" value={invite.email} onChange={(e) => setInvite((s) => ({ ...s, email: e.target.value }))} placeholder="doctor@example.com" />
              <Input label="Phone" value={invite.phone} onChange={(e) => setInvite((s) => ({ ...s, phone: e.target.value }))} placeholder="10-digit mobile" inputMode="tel" />
              <p className="mg-help">Nothing is sent automatically. You will get a code to share.</p>
            </div>
            {inviteError && <p className="mg-error" role="alert">{inviteError}</p>}
          </form>
        )}
      </Modal>

      <Modal isOpen={loginOpen} onClose={() => setLoginOpen(false)} variant="drawer" title={editing ? `Edit ${editing.name}` : 'Set up a doctor\'s sign-in'}
        footer={<>
          <Button variant="secondary" onClick={() => setLoginOpen(false)} disabled={savingLogin}>Cancel</Button>
          <Button variant="primary" onClick={saveLogin} loading={savingLogin}>{editing ? 'Save changes' : 'Create sign-in'}</Button>
        </>}>
        <form className="mg-form" onSubmit={saveLogin} noValidate>
          <div className="mg-form-section">
            <h3>Doctor</h3>
            <Input label="Name *" value={login.name} onChange={(e) => setLogin((s) => ({ ...s, name: e.target.value }))} autoFocus />
            <div className="mg-grid-2">
              <Input label="Email (used to sign in) *" type="email" value={login.email} onChange={(e) => setLogin((s) => ({ ...s, email: e.target.value }))} />
              <Input label="Phone" value={login.phone} onChange={(e) => setLogin((s) => ({ ...s, phone: e.target.value }))} inputMode="tel" />
            </div>
          </div>
          <div className="mg-form-section">
            <h3>Password</h3>
            <Input label={editing ? 'New password (leave empty to keep the current one)' : 'Password *'} type="password" autoComplete="new-password" value={login.password} onChange={(e) => setLogin((s) => ({ ...s, password: e.target.value }))} />
          </div>
          <div className="mg-form-section">
            <h3>Sign-in</h3>
            <div className="mg-seg" role="group" aria-label="Sign-in">
              {[['Active', 'Allowed'], ['Inactive', 'Switched off']].map(([value, label]) => (
                <button key={value} type="button" className={login.status === value ? 'is-on' : ''} aria-pressed={login.status === value} onClick={() => setLogin((s) => ({ ...s, status: value }))}>{label}</button>
              ))}
            </div>
          </div>
          {loginError && <p className="mg-error" role="alert">{loginError}</p>}
        </form>
      </Modal>

      <ConfirmDialog isOpen={!!del} onClose={() => setDel(null)} onConfirm={remove} loading={deleting}
        title="Remove this doctor's access?"
        message={`${del?.name || 'This doctor'} will no longer be able to sign in. Their patients' reports are not affected. To stop access for a while, switch off sign-in instead.`}
        confirmText="Remove" />
    </div>
  );
}
