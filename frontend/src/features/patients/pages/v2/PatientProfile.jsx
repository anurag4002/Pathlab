import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, FilePlus, Pencil, Printer } from 'lucide-react';
import { getPatientById, updatePatient } from '../../../../services/patientService';
import { getDoctors } from '../../../../services/doctorService';
import { Button, StatGroup, StatusBadge, LoadingSpinner } from '../../../../components/common';
import ReportTable from '../../../../components/business/ReportTable';
import PatientFormModal from '../../components/PatientFormModal';
import printReport from '../../../../utils/printReport';
import downloadFile from '../../../../utils/downloadFile';
import { buildBillsSearchUrl } from '../../../../utils/billNavigation';
import { money, dayLabel, dateTimeLabel, sum } from '../../../../utils/reportFormat';
import { notify } from '../../../../components/common/Toast/toast';
import '../../../../components/business/business.css';
import '../../../../pages/cases/v2/casesV2.css';

const initials = (name) => String(name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
const ageSex = (p) => {
  const age = p.age !== undefined && p.age !== null && p.age !== '' ? `${p.age} ${(p.ageUnit || 'years').charAt(0).toUpperCase()}` : '';
  const sex = p.gender ? p.gender.charAt(0).toUpperCase() : '';
  return [age, sex].filter(Boolean).join(' · ');
};
const toForm = (p) => ({
  name: p.name || '', age: p.age ?? '', ageUnit: p.ageUnit || 'years', birthYear: p.birthYear || '', gender: p.gender || '',
  phone: p.phone || '', address: p.address || '', email: p.email || '', aadhaar: p.aadhaar || '', history: p.history || '',
  uhid: p.uhid || '', referringDoctor: p.referringDoctor?._id || p.referringDoctor || '',
});

// Patient profile (new look): who they are, what they owe, and every bill,
// report and payment - on one screen with tabs.
export default function PatientProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('bills');
  const [reload, setReload] = useState(0);
  // Edit drawer
  const [editOpen, setEditOpen] = useState(false);
  const [formData, setFormData] = useState(null);
  const [formErrors, setFormErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [doctors, setDoctors] = useState([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError('');
    getPatientById(id)
      .then((res) => { if (!cancelled) { if (res?.success) setDetails(res.data); else setError('This patient could not be found.'); } })
      .catch((err) => { if (!cancelled) setError(err.response?.data?.message || 'Could not load this patient.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id, reload]);

  const back = (
    <button type="button" className="bill-back-link" onClick={() => navigate('/cases/patients')} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', border: 0, background: 'none', padding: 0, color: '#71717a', cursor: 'pointer', font: 'inherit', fontSize: '0.875rem', marginBottom: '0.6rem' }}>
      <ArrowLeft size={15} /> Patients
    </button>
  );

  if (loading && !details) return <LoadingSpinner label="Loading patient..." size={2.5} />;
  if (error || !details) return <div>{back}<div className="biz-error" role="alert">{error || 'This patient could not be found.'}</div></div>;

  const { patient, bills = [], reports = [], transactions = [] } = details;
  const live = bills.filter((b) => !b.isVoided);
  const billed = sum(live, (b) => b.totalAmount);
  const received = sum(live, (b) => b.paidAmount);
  const due = sum(live, (b) => b.dueAmount);
  const lastVisit = live.length ? live.reduce((a, b) => (new Date(b.date) > new Date(a.date) ? b : a)).date : null;

  const newBill = () => navigate('/cases/bills/new', { state: { booking: { patientId: patient._id, name: patient.name, phone: patient.phone, age: patient.age, gender: patient.gender, title: patient.title, email: patient.email, address: patient.address } } });

  const openEdit = () => {
    setFormData((prev) => prev || toForm(patient));
    setFormErrors({});
    setEditOpen(true);
    if (!doctors.length) getDoctors().then((res) => setDoctors(res?.data || [])).catch(() => {});
  };
  const saveEdit = async (e) => {
    e?.preventDefault();
    const errs = {};
    if (!String(formData.name || '').trim()) errs.name = 'Enter the patient name.';
    if (!String(formData.phone || '').trim()) errs.phone = 'Enter a phone number.';
    if (Object.keys(errs).length) { setFormErrors(errs); return; }
    setSaving(true);
    try {
      const res = await updatePatient(patient._id, { ...formData, referringDoctor: formData.referringDoctor || null });
      if (res?.success) { setEditOpen(false); setFormData(null); notify('Patient details saved'); setReload((n) => n + 1); }
    } catch (err) {
      setFormErrors({ api: err.response?.data?.message || 'Could not save. Try again.' });
    } finally { setSaving(false); }
  };

  const print = () => printReport({
    title: `Patient statement - ${patient.name}`,
    period: [`Reg ${patient.registrationNumber}`, ageSex(patient), patient.phone && `+91 ${patient.phone}`].filter(Boolean).join(' · '),
    summary: [
      { label: 'Bills', value: String(live.length) },
      { label: 'Billed', value: money(billed) },
      { label: 'Received', value: money(received) },
      { label: 'Still due', value: money(due) },
    ],
    sections: [
      { title: 'Bills', columns: [{ label: 'Bill no' }, { label: 'Date' }, { label: 'Amount', align: 'right' }, { label: 'Received', align: 'right' }, { label: 'Still due', align: 'right' }, { label: 'Status' }], rows: bills.map((b) => [b.billNumber, dayLabel(b.date), money(b.totalAmount), money(b.paidAmount), money(b.dueAmount), b.isVoided ? 'Cancelled' : b.paymentStatus]), totals: ['Total', '', money(billed), money(received), money(due), ''] },
      { title: 'Payments', columns: [{ label: 'Date' }, { label: 'Bill no' }, { label: 'Mode' }, { label: 'Amount', align: 'right' }], rows: transactions.map((t) => [dateTimeLabel(t.date), t.bill?.billNumber || '', t.paymentMethod || '', `${t.type === 'Refund' ? 'Refund -' : ''}${money(t.amount)}`]) },
    ],
  });

  const TABS = [
    { key: 'bills', label: 'Bills', count: bills.length },
    { key: 'reports', label: 'Reports', count: reports.length },
    { key: 'payments', label: 'Payments', count: transactions.length },
  ];
  const facts = [
    ['Phone', patient.phone ? `+91 ${patient.phone}` : ''],
    ['Email', patient.email],
    ['Address', patient.address],
    ['Aadhaar', patient.aadhaar ? `•••• ${String(patient.aadhaar).slice(-4)}` : ''],
    ['UHID', patient.uhid],
    ['Referred by', patient.referringDoctor?.name || 'Self'],
    ['History', patient.history],
    ['Registered', patient.createdAt ? dayLabel(patient.createdAt) : ''],
  ].filter(([, v]) => v);

  return (
    <div className="biz-page">
      <div>{back}</div>
      <div className="cases-hero">
        <span className="cases-hero-avatar" aria-hidden="true">{initials(patient.name)}</span>
        <div className="cases-hero-main">
          <h2>{[patient.title, patient.name].filter(Boolean).join(' ')}{ageSex(patient) && <span className="cases-clinical">{ageSex(patient)}</span>}</h2>
          <p>Reg {patient.registrationNumber}{patient.phone ? ` · +91 ${patient.phone}` : ''}{lastVisit ? ` · Last visit ${dayLabel(lastVisit)}` : ''}</p>
        </div>
        <div className="cases-hero-actions">
          <Button variant="secondary" size="sm" icon={<Pencil size={14} />} onClick={openEdit}>Edit</Button>
          <Button variant="secondary" size="sm" icon={<Printer size={14} />} onClick={print}>Print statement</Button>
          <Button variant="primary" size="sm" icon={<FilePlus size={14} />} onClick={newBill} aria-label={`New bill for ${patient.name}`}>New bill</Button>
        </div>
      </div>

      <StatGroup items={[
        { label: 'Visits', value: String(live.length), hint: lastVisit ? `Last on ${dayLabel(lastVisit)}` : 'No bills yet' },
        { label: 'Billed', value: money(billed) },
        { label: 'Received', value: money(received) },
        { label: 'Still due', value: money(due), tone: due > 0 ? 'warning' : undefined, hint: due > 0 ? 'Collect from Bills or Dues' : 'Nothing due' },
      ]} />

      <div className="cases-profile">
        <section className="biz-section">
          <div className="cases-tabs" role="tablist" aria-label="Patient history">
            {TABS.map((t) => (
              <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} className={tab === t.key ? 'is-on' : ''} onClick={() => setTab(t.key)}>
                {t.label}<span>{t.count}</span>
              </button>
            ))}
          </div>
          {tab === 'bills' && (
            <ReportTable rows={bills} empty="No bills yet for this patient." onRowClick={(b) => b.billNumber && navigate(buildBillsSearchUrl(b))}
              columns={[
                { key: 'no', label: 'Bill no', render: (b) => <span className="strong">{b.billNumber}</span> },
                { key: 'date', label: 'Date', render: (b) => <span className="muted">{dayLabel(b.date)}</span> },
                { key: 'amount', label: 'Amount', align: 'right', render: (b) => money(b.totalAmount) },
                { key: 'paid', label: 'Received', align: 'right', render: (b) => money(b.paidAmount) },
                { key: 'due', label: 'Still due', align: 'right', render: (b) => (Number(b.dueAmount) > 0 ? <span className="is-due">{money(b.dueAmount)}</span> : <span className="muted">-</span>) },
                { key: 'status', label: 'Status', render: (b) => <StatusBadge status={b.isVoided ? 'Cancelled' : b.paymentStatus} /> },
              ]}
              totals={{ no: 'Total', amount: money(billed), paid: money(received), due: money(due) }} />
          )}
          {tab === 'reports' && (
            <ReportTable rows={reports} empty="No uploaded reports for this patient. Lab results are under Today's reports."
              columns={[
                { key: 'test', label: 'Report', render: (r) => <span className="strong">{r.test ? r.test.name : 'General report'}</span> },
                { key: 'date', label: 'Date', render: (r) => <span className="muted">{dayLabel(r.reportDate)}</span> },
                { key: 'by', label: 'Uploaded by', render: (r) => r.uploadedBy?.name || '' },
                { key: 'dl', label: '', align: 'right', render: (r) => <Button variant="secondary" size="sm" onClick={(e) => { e.stopPropagation(); downloadFile(`/${r.fileUrl}`, `report_${patient.registrationNumber}.pdf`); }}>Download</Button> },
              ]} />
          )}
          {tab === 'payments' && (
            <ReportTable rows={transactions} empty="No payments yet."
              columns={[
                { key: 'date', label: 'Date', render: (t) => <span className="muted">{dateTimeLabel(t.date)}</span> },
                { key: 'bill', label: 'Bill no', render: (t) => t.bill?.billNumber || '' },
                { key: 'mode', label: 'Mode', render: (t) => <span className={`biz-pill is-${String(t.paymentMethod || '').toLowerCase()}`}>{t.paymentMethod}</span> },
                { key: 'by', label: 'Received by', render: (t) => t.receivedBy?.name || '' },
                { key: 'amount', label: 'Amount', align: 'right', render: (t) => (t.type === 'Refund' ? <span className="is-due">- {money(t.amount)}</span> : <span className="strong">{money(t.amount)}</span>) },
              ]}
              totals={{ date: 'Total', amount: money(sum(transactions.filter((t) => t.type !== 'Refund'), (t) => t.amount) - sum(transactions.filter((t) => t.type === 'Refund'), (t) => t.amount)) }} />
          )}
        </section>

        <aside className="cases-card" aria-label="Patient details">
          <h2>Details</h2>
          {facts.length ? (
            <dl className="cases-facts">
              {facts.map(([k, v]) => <React.Fragment key={k}><dt>{k}</dt><dd>{v}</dd></React.Fragment>)}
            </dl>
          ) : <p className="biz-note">No extra details saved.</p>}
        </aside>
      </div>

      {formData && (
        <PatientFormModal
          isOpen={editOpen}
          onClose={() => setEditOpen(false)}
          onSubmit={saveEdit}
          formData={formData}
          setFormData={setFormData}
          errors={formErrors}
          loading={saving}
          isEditing
          doctors={doctors}
        />
      )}
      {formErrors.api && editOpen && <div className="biz-error" role="alert">{formErrors.api}</div>}
    </div>
  );
}
