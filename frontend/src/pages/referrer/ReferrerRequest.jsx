import React, { useEffect, useMemo, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { Search, X, CheckCircle2 } from 'lucide-react';
import { Button, Input } from '../../components/common';
import { getReferrerCatalog, sendReferrerRequest } from '../../services/referrerService';

const EMPTY = { name: '', phone: '', age: '', gender: '', preferredDate: '', note: '' };

// Send a patient: the doctor fills in who the patient is and the tests
// wanted. The lab gets it as a booking with "Referred by" set to this
// doctor, calls the patient, makes the bill (lab prices) and does the tests.
export default function ReferrerRequest() {
  const { profile } = useOutletContext() || {};
  const doctors = profile?.doctors || [];
  const [form, setForm] = useState(EMPTY);
  const [doctorId, setDoctorId] = useState('');
  const [catalog, setCatalog] = useState([]);
  const [catalogError, setCatalogError] = useState('');
  const [find, setFind] = useState('');
  const [chosen, setChosen] = useState([]);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [sent, setSent] = useState(null);

  useEffect(() => {
    getReferrerCatalog()
      .then((r) => setCatalog(r?.data || []))
      .catch(() => setCatalogError('Could not load the test list. Please refresh the page.'));
  }, []);

  const options = useMemo(() => {
    const q = find.trim().toLowerCase();
    if (!q) return [];
    const picked = new Set(chosen.map((c) => `${c.kind}:${c.refId}`));
    return catalog.filter((o) => !picked.has(`${o.kind}:${o.refId}`) && `${o.name} ${o.hint}`.toLowerCase().includes(q)).slice(0, 12);
  }, [find, catalog, chosen]);

  const set = (key) => (e) => setForm((s) => ({ ...s, [key]: e.target.value }));
  const add = (o) => { setChosen((c) => [...c, o]); setFind(''); setErrors((e) => ({ ...e, items: '' })); };
  const remove = (o) => setChosen((c) => c.filter((x) => !(x.kind === o.kind && x.refId === o.refId)));

  const submit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!form.name.trim()) errs.name = "Enter the patient's name";
    const digits = form.phone.replace(/\D/g, '');
    if (!/^(91)?\d{10}$|^0\d{10}$/.test(digits)) errs.phone = 'Enter a 10-digit mobile number';
    if (form.age !== '' && !(Number.isInteger(Number(form.age)) && Number(form.age) >= 0 && Number(form.age) <= 120)) errs.age = 'Age in years, 0 to 120';
    if (!chosen.length) errs.items = 'Choose at least one test or package';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    try {
      const res = await sendReferrerRequest({
        ...form,
        age: form.age === '' ? undefined : Number(form.age),
        gender: form.gender || undefined,
        preferredDate: form.preferredDate || undefined,
        doctorId: doctorId || undefined,
        items: chosen.map(({ kind, refId }) => ({ kind, refId }))
      });
      if (res?.success) { setSent(res.data); setForm(EMPTY); setChosen([]); }
    } catch (err) {
      setErrors({ api: err.response?.data?.message || 'Could not send. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  if (sent) {
    return (
      <section className="rf-page">
        <div className="rf-sent" role="status">
          <CheckCircle2 size={28} aria-hidden="true" />
          <h1>Request sent</h1>
          <p>The lab has your request for <strong>{sent.name}</strong> ({sent.tests.join(', ')}). They will contact the patient and make the bill. You will see the patient under My patients once billed.</p>
          <div className="rf-sent-actions">
            <Button variant="primary" onClick={() => setSent(null)}>Send another patient</Button>
            <Link to="/referrer/requests" className="btn btn-secondary">My requests</Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="rf-page">
      <div className="rf-title">
        <div>
          <h1>Send a patient</h1>
          <p>Tell the lab who to see and which tests. The lab confirms with the patient, makes the bill and does the tests.</p>
        </div>
      </div>
      <form className="rf-form" onSubmit={submit} noValidate>
        {errors.api && <div className="rf-error" role="alert">{errors.api}</div>}
        {doctors.length > 1 && (
          <label className="rf-field">
            <span>Referred by</span>
            <select value={doctorId} onChange={(e) => setDoctorId(e.target.value)}>
              {doctors.map((d) => <option key={d._id} value={d._id}>{d.name}{d.clinicHospital ? ` (${d.clinicHospital})` : ''}</option>)}
            </select>
          </label>
        )}
        <div className="rf-grid">
          <Input label="Patient name" name="name" value={form.name} onChange={set('name')} error={errors.name} required autoComplete="off" />
          <Input label="Mobile number" name="phone" value={form.phone} onChange={set('phone')} error={errors.phone} required inputMode="tel" autoComplete="off" placeholder="10 digits" />
          <Input label="Age (years)" name="age" value={form.age} onChange={set('age')} error={errors.age} inputMode="numeric" />
          <div className="form-group">
            <span className="form-label">Sex</span>
            <div className="rf-seg" role="group" aria-label="Sex">
              {['Male', 'Female', 'Other'].map((g) => (
                <button key={g} type="button" aria-pressed={form.gender === g} className={form.gender === g ? 'is-on' : ''}
                  onClick={() => setForm((s) => ({ ...s, gender: s.gender === g ? '' : g }))}>{g}</button>
              ))}
            </div>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="rf-find"><span>Tests or packages</span><span className="form-required-star" aria-hidden="true">*</span></label>
          <div className="rf-picker">
            <label className="rf-search">
              <Search size={16} aria-hidden="true" />
              <input id="rf-find" type="search" value={find} onChange={(e) => setFind(e.target.value)} placeholder="Type a test name, e.g. CBC" autoComplete="off" />
            </label>
            {options.length > 0 && (
              <ul className="rf-options" role="listbox" aria-label="Matching tests">
                {options.map((o) => (
                  <li key={`${o.kind}-${o.refId}`}>
                    <button type="button" role="option" aria-selected="false" onClick={() => add(o)}>
                      <span>{o.name}</span><small>{o.hint}</small>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {find.trim() && !options.length && catalog.length > 0 && <p className="rf-meta">No test matches. Write it in the note below instead.</p>}
          </div>
          {catalogError && <p className="form-error">{catalogError}</p>}
          {errors.items && <p className="form-error">{errors.items}</p>}
          {chosen.length > 0 && (
            <ul className="rf-chosen" aria-label="Chosen tests">
              {chosen.map((o) => (
                <li key={`${o.kind}-${o.refId}`}>
                  <span>{o.name}</span>
                  <button type="button" onClick={() => remove(o)} aria-label={`Remove ${o.name}`}><X size={14} /></button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rf-grid">
          <Input label="Preferred date (optional)" type="date" name="preferredDate" value={form.preferredDate} onChange={set('preferredDate')} />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="rf-note"><span>Note for the lab (optional)</span></label>
          <textarea id="rf-note" className="form-control" rows={3} maxLength={500} value={form.note} onChange={set('note')} placeholder="e.g. fasting sample, home collection, clinical details" />
        </div>
        <p className="rf-meta">The lab sets the price and makes the bill. Nothing is charged by sending this.</p>
        <div className="rf-form-actions">
          <Button type="submit" variant="primary" loading={saving}>Send to lab</Button>
        </div>
      </form>
    </section>
  );
}
