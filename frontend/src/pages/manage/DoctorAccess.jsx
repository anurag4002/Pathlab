import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getDoctors } from '../../services/doctorService';
import { getInvites, createInvite } from '../../services/doctorPortalService';
import useClientPagination from '../../hooks/useClientPagination';
import { Link2 } from 'lucide-react';
import { DataTable, PageHeader, Button, AdvancedFilterBar } from '../../components/common';
import { notify } from '../../components/common/Toast/toast';
import DoctorAccessV2 from './v2/DoctorAccessV2';
import { useUiVersion } from '../../utils/uiVersion';
import { useDoctorLogins, DoctorLoginStatus, DoctorLoginDialog, doctorLoginMenuItems, toggleDoctorLogin, doctorLoginState } from '../../components/referrer/DoctorLoginControls';

const LOGIN_FILTERS = [
  { value: 'with', label: 'Has a login' },
  { value: 'off', label: 'Login turned off' },
  { value: 'none', label: 'No login' }
];

// Doctor access: the referring doctors (the names in "Referred by" on
// bills) and their logins. A doctor with a login sees only the patients
// they referred, and signed reports.
const DoctorAccess = () => {
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(false);
  const { logins, reload: reloadLogins } = useDoctorLogins();
  const [loginTarget, setLoginTarget] = useState(null);

  const [search, setSearch] = useState('');
  const [loginFilter, setLoginFilter] = useState('');

  // Invite section
  const [invites, setInvites] = useState([]);
  const [invLoading, setInvLoading] = useState(false);
  const [invForm, setInvForm] = useState({ name: '', email: '', phone: '' });
  const [invToken, setInvToken] = useState('');
  const [invSaving, setInvSaving] = useState(false);

  const pgInvites = useClientPagination(invites, 5);
  const filteredDoctors = doctors.filter((d) => {
    if (loginFilter && doctorLoginState(logins[String(d._id)]) !== loginFilter) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return `${d.name || ''} ${d.phone || ''} ${d.clinicHospital || ''} ${logins[String(d._id)]?.loginId || ''}`.toLowerCase().includes(q);
  });
  const pgDoctors = useClientPagination(filteredDoctors, 10);

  const fetchDoctors = async () => {
    setLoading(true);
    try {
      const res = await getDoctors();
      if (res.success) setDoctors(res.data || []);
    } catch (err) {
      console.error('Failed to load referral doctors', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchInvites = async () => {
    setInvLoading(true);
    try { const r = await getInvites(); if (r.success) setInvites(r.data?.invites || r.data || []); }
    catch (e) { console.error('invites', e); } finally { setInvLoading(false); }
  };
  useEffect(() => { fetchDoctors(); fetchInvites(); }, []);
  const handleInvite = async (e) => {
    e.preventDefault();
    setInvSaving(true); setInvToken('');
    try { const r = await createInvite(invForm); if (r.success) { setInvToken(r.data?.token || r.data?.invite?.token || ''); setInvForm({ name: '', email: '', phone: '' }); fetchInvites(); } }
    catch (e) { notify(e.response?.data?.message || 'Invite failed'); } finally { setInvSaving(false); }
  };

  const menu = (doctor) => doctorLoginMenuItems(doctor, logins[String(doctor._id)], {
    open: (d, mode) => setLoginTarget({ doctor: d, mode }),
    toggle: (d, l) => toggleDoctorLogin(d, l, reloadLogins)
  });

  return (
    <div>
      <PageHeader
        title="Doctor Portal Access"
        subtitle='Referring doctors (the names in "Referred by" on bills). A doctor with a login sees only the patients they referred.'
        action={<Link to="/cases/doctors" className="btn btn-secondary">Add or edit doctors</Link>}
      />

      <AdvancedFilterBar
        showSearchButton={false}
        showClearButton={!!(search || loginFilter)}
        onClear={() => { setSearch(''); setLoginFilter(''); pgDoctors.reset(); }}
        values={{ search, login: loginFilter }}
        onChange={(key, value) => {
          pgDoctors.reset();
          if (key === 'search') setSearch(value);
          else if (key === 'login') setLoginFilter(value);
        }}
        fields={[
          { key: 'search', label: 'Search', type: 'text', size: 'lg', placeholder: 'Doctor, clinic or phone...' },
          { key: 'login', label: 'Login', type: 'select', options: LOGIN_FILTERS, placeholder: 'All doctors' }
        ]}
      />

      <DataTable
        headers={['Doctor', 'Phone', 'Clinic / Hospital', 'Login', 'Actions']}
        data={pgDoctors.paged}
        loading={loading}
        emptyMessage="No referral doctors. Add them under Cases > Referral Doctors."
        pagination={{
          total: pgDoctors.total,
          page: pgDoctors.page,
          limit: pgDoctors.limit,
          pages: pgDoctors.pages,
          onPageChange: pgDoctors.goToPage,
          onLimitChange: pgDoctors.setLimit,
        }}
        renderRow={(doc) => (
          <tr key={doc._id}>
            <td style={{ fontWeight: '600' }}>{doc.name}{doc.status === 'Inactive' && <span className="dl-pill" style={{ marginLeft: 6 }}>Inactive</span>}</td>
            <td>{doc.phone || '-'}</td>
            <td>{doc.clinicHospital || '-'}</td>
            <td><DoctorLoginStatus login={logins[String(doc._id)]} /></td>
            <td>
              <span className="dl-actions">
                {menu(doc).map((item) => (
                  <button key={item.label} type="button" className={`btn btn-${item.danger ? 'danger' : 'secondary'} btn-sm`}
                    style={{ padding: '4px 8px', fontSize: '0.75rem' }} onClick={item.onClick}>{item.label}</button>
                ))}
              </span>
            </td>
          </tr>
        )}
      />

      <div className="card" style={{ marginTop: '1.5rem', padding: '1rem' }}>
        <h3 style={{ margin: '0 0 .75rem', display: 'flex', alignItems: 'center', gap: 8 }}><Link2 size={16} /> Invite Doctor (token link)</h3>
        <p style={{ fontSize: '.8rem', margin: '0 0 .75rem' }}>The doctor chooses their own password with the code. Their login is linked to the referral doctor with the same email.</p>
        <form onSubmit={handleInvite} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input className="form-control" style={{ maxWidth: 200 }} placeholder="Name" value={invForm.name} onChange={(e) => setInvForm(s => ({ ...s, name: e.target.value }))} required />
          <input className="form-control" style={{ maxWidth: 220 }} placeholder="Email" value={invForm.email} onChange={(e) => setInvForm(s => ({ ...s, email: e.target.value }))} required />
          <input className="form-control" style={{ maxWidth: 160 }} placeholder="Phone" value={invForm.phone} onChange={(e) => setInvForm(s => ({ ...s, phone: e.target.value }))} />
          <Button type="submit" size="sm" loading={invSaving}>Send Invite</Button>
        </form>
        {invToken && <p style={{ fontSize: '.8rem', marginTop: 8 }}>Invite token: <code>{invToken}</code></p>}
        <DataTable headers={['Name', 'Email', 'Phone', 'Token / Status']} data={pgInvites.paged} loading={invLoading} emptyMessage="No invites yet."
          pagination={{
            total: pgInvites.total,
            page: pgInvites.page,
            limit: pgInvites.limit,
            pages: pgInvites.pages,
            onPageChange: pgInvites.goToPage,
            onLimitChange: pgInvites.setLimit,
          }}
          renderRow={(iv, i) => (<tr key={iv._id || i}><td>{iv.name}</td><td>{iv.email}</td><td>{iv.phone || '-'}</td><td style={{ fontSize: '.78rem' }}><code>{iv.token || iv.status || '-'}</code></td></tr>)} />
      </div>

      <DoctorLoginDialog doctor={loginTarget?.doctor} mode={loginTarget?.mode} login={loginTarget ? logins[String(loginTarget.doctor._id)] : null}
        onClose={() => setLoginTarget(null)} onDone={reloadLogins} />
    </div>
  );
};

// New look: its own simpler screen; Classic keeps the page above.
const DoctorAccessPage = () => (useUiVersion() === 'v2' ? <DoctorAccessV2 /> : <DoctorAccess />);
export default DoctorAccessPage;
