import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw, Send, Copy } from 'lucide-react';
import { getDoctors } from '../../../services/doctorService';
import { getInvites, createInvite } from '../../../services/doctorPortalService';
import { PageHeader, Button, Modal, Input, RowMenu, StatGroup } from '../../../components/common';
import ReportTable from '../../../components/business/ReportTable';
import { notify } from '../../../components/common/Toast/toast';
import { dayLabel } from '../../../utils/reportFormat';
import useDraft from './useDraft';
import useStickyState from '../../../utils/useStickyState';
import { useDoctorLogins, DoctorLoginStatus, DoctorLoginDialog, doctorLoginMenuItems, toggleDoctorLogin, doctorLoginState } from '../../../components/referrer/DoctorLoginControls';
import '../../../components/business/business.css';
import './manage.css';

const EMPTY_INVITE = { name: '', email: '', phone: '' };
const INVITE_STATUS = { Pending: ['Waiting', 'is-warn'], Accepted: ['Joined', 'is-good'], Expired: ['Expired', ''] };

// Copies an invite code without ever showing it on screen.
const copyCode = async (token) => {
  if (!token) { notify('No code for this invite.'); return; }
  try { await navigator.clipboard.writeText(token); notify('Invite code copied - paste it into a message to the doctor'); }
  catch { notify('Could not copy. Try again.'); }
};

// Doctor access (new look): the referring doctors - the names in
// "Referred by" on bills - and whether each can sign in to see their own
// patients and signed reports.
export default function DoctorAccessV2() {
  const [doctors, setDoctors] = useState([]);
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(false);
  const { logins, reload: reloadLogins } = useDoctorLogins();
  const [search, setSearch] = useStickyState('search', '');
  const [tab, setTab] = useStickyState('tab', 'doctors');
  const [loginTab, setLoginTab] = useStickyState('loginTab', 'all');
  const [loginTarget, setLoginTarget] = useState(null);

  const [inviteOpen, setInviteOpen] = useStickyState('inviteOpen', false);
  const [invite, setInvite, clearInvite] = useDraft('doctor-invite', EMPTY_INVITE);
  const [inviteError, setInviteError] = useState('');
  const [inviteToken, setInviteToken] = useState('');
  const [savingInvite, setSavingInvite] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [d, i] = await Promise.allSettled([getDoctors(), getInvites()]);
      if (d.status === 'fulfilled' && d.value?.success) setDoctors(d.value.data || []);
      if (i.status === 'fulfilled' && i.value?.success) setInvites(i.value.data?.invites || i.value.data || []);
    } finally { setLoading(false); }
    reloadLogins();
  };
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const q = search.trim().toLowerCase();
  const loginOf = (d) => logins[String(d._id)];
  const doctorRows = useMemo(() => doctors
    .filter((d) => loginTab === 'all' || doctorLoginState(logins[String(d._id)]) === loginTab)
    .filter((d) => !q || `${d.name} ${d.phone} ${d.clinicHospital || ''} ${logins[String(d._id)]?.loginId || ''}`.toLowerCase().includes(q)),
  [doctors, logins, loginTab, q]);
  const inviteRows = useMemo(() => invites.filter((v) => !q || `${v.name} ${v.email} ${v.phone}`.toLowerCase().includes(q))
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)), [invites, q]);
  const waiting = invites.filter((v) => v.status === 'Pending').length;
  const count = (state) => doctors.filter((d) => doctorLoginState(logins[String(d._id)]) === state).length;

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

  const open = (d, mode) => setLoginTarget({ doctor: d, mode });
  const items = (d) => doctorLoginMenuItems(d, loginOf(d), { open, toggle: (doc, l) => toggleDoctorLogin(doc, l, reloadLogins) });

  return (
    <div className="biz-page">
      <PageHeader
        title="Doctor access"
        subtitle='The doctors in "Referred by" on bills. Give a doctor a login and they see only the patients they referred, and signed reports.'
        action={<div className="biz-actions">
          <Button variant="secondary" size="sm" icon={<RefreshCw size={14} />} onClick={load}>Refresh</Button>
          <Link to="/cases/doctors" className="btn btn-secondary btn-sm">Add a doctor</Link>
          <Button variant="secondary" size="sm" icon={<Send size={14} />} onClick={() => { setInviteError(''); setInviteToken(''); setInviteOpen(true); }}>Invite by email</Button>
        </div>}
      />

      <StatGroup loading={loading} items={[
        { label: 'Can sign in', value: String(count('with')) },
        { label: 'Login turned off', value: String(count('off')) },
        { label: 'No login yet', value: String(count('none')) },
        { label: 'Invites waiting', value: String(waiting), hint: 'Not joined yet', tone: waiting ? 'warning' : undefined },
      ]} />

      <div className="biz-tabs" role="tablist" aria-label="Show">
        {[['doctors', 'Doctors', doctors.length], ['invites', 'Invites', invites.length]].map(([key, label, n]) => (
          <button key={key} type="button" role="tab" aria-selected={tab === key} className={tab === key ? 'is-on' : ''} onClick={() => setTab(key)}>{label}<span>{n}</span></button>
        ))}
      </div>
      <div className="form-group" style={{ maxWidth: 360 }}>
        <input type="search" data-page-search="" aria-label="Search doctors" placeholder="Doctor, clinic or phone" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {tab === 'doctors' ? (
        <>
          <div className="mg-seg" role="group" aria-label="Login" style={{ marginBottom: 12 }}>
            {[['all', 'All'], ['with', 'Can sign in'], ['off', 'Turned off'], ['none', 'No login']].map(([value, label]) => (
              <button key={value} type="button" className={loginTab === value ? 'is-on' : ''} aria-pressed={loginTab === value} onClick={() => setLoginTab(value)}>{label}</button>
            ))}
          </div>
          <ReportTable loading={loading} rows={doctorRows} rowKey={(d) => d._id}
            empty={q || loginTab !== 'all' ? 'No doctor matches.' : 'No referral doctors yet. Add them on the Referral doctors screen.'}
            columns={[
              { key: 'name', label: 'Doctor', render: (d) => <><div className="mg-name">{d.name}</div><div className="mg-sub">{[d.clinicHospital, d.phone].filter(Boolean).join(' · ')}</div></> },
              { key: 'login', label: 'Login', render: (d) => <DoctorLoginStatus login={loginOf(d)} /> },
              { key: 'act', label: '', align: 'right', render: (d) => (
                <span className="mg-row-actions">
                  {!loginOf(d)
                    ? <Button variant="secondary" size="sm" onClick={() => open(d, 'give')} aria-label={`Give ${d.name} a login`}>Give login</Button>
                    : items(d).length > 0 && <RowMenu label={`Login actions for ${d.name}`} items={items(d)} />}
                </span>
              ) },
            ]} />
        </>
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

      <Modal isOpen={inviteOpen} onClose={() => setInviteOpen(false)} variant="drawer" title="Invite a doctor by email"
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
              <p className="mg-help">Nothing is sent automatically. You will get a code to share. The login is linked to the referral doctor with this email; usually "Give login" is simpler.</p>
            </div>
            {inviteError && <p className="mg-error" role="alert">{inviteError}</p>}
          </form>
        )}
      </Modal>

      <DoctorLoginDialog doctor={loginTarget?.doctor} mode={loginTarget?.mode} login={loginTarget ? loginOf(loginTarget.doctor) : null}
        onClose={() => setLoginTarget(null)} onDone={reloadLogins} />
    </div>
  );
}
