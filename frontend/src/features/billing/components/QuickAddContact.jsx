import React, { useEffect, useState } from 'react';
import { Modal, Button, Input } from '../../../components/common';

// New bill (new look): add a referral doctor or agent in a right-side panel
// without leaving the bill. What is typed stays if the panel is closed by
// mistake; it clears once saved.
const EMPTY = { name: '', phone: '', clinicHospital: '' };

export default function QuickAddContact({ kind, isOpen, onClose, onCreate, onCreated }) {
  const [drafts, setDrafts] = useState({ doctor: EMPTY, agent: EMPTY });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [lastKind, setLastKind] = useState(kind);
  if (kind && kind !== lastKind) setLastKind(kind);
  const k = kind || lastKind || 'doctor';
  const form = drafts[k];
  const set = (field) => (event) => setDrafts((all) => ({ ...all, [k]: { ...all[k], [field]: event.target.value } }));
  useEffect(() => { if (isOpen) setError(''); }, [isOpen]);

  const save = async () => {
    if (!form.name.trim() || !form.phone.trim()) { setError(`Enter the ${k}'s name and phone number.`); return; }
    setBusy(true); setError('');
    try {
      const payload = { name: form.name.trim(), phone: form.phone.trim() };
      if (k === 'doctor' && form.clinicHospital.trim()) payload.clinicHospital = form.clinicHospital.trim();
      const created = await onCreate(payload);
      setDrafts((all) => ({ ...all, [k]: EMPTY }));
      onCreated?.(created);
    } catch (err) {
      setError(err.response?.data?.message || `Could not add the ${k}. Try again.`);
    } finally {
      setBusy(false);
    }
  };
  const label = k === 'doctor' ? 'Doctor' : 'Agent';

  return (
    <Modal isOpen={!!isOpen} onClose={onClose} variant="drawer" title={`New ${k}`}
      footer={<>
        <span className="bill-drawer-note">Closing keeps what you typed.</span>
        <Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
        <Button variant="primary" onClick={save} loading={busy}>Add {k}</Button>
      </>}>
      <div className="bill-new-patient-form" onKeyDown={(event) => { if (event.key === 'Enter' && event.target.matches('input')) { event.preventDefault(); save(); } }}>
        <Input label={`${label} name *`} value={form.name} onChange={set('name')} placeholder={k === 'doctor' ? 'e.g. Dr. Anil Sharma' : 'e.g. Ramesh Kumar'} autoFocus />
        <Input label="Phone number *" value={form.phone} onChange={set('phone')} placeholder="10-digit mobile" inputMode="tel" />
        {k === 'doctor' && <Input label="Clinic / hospital" value={form.clinicHospital} onChange={set('clinicHospital')} placeholder="Optional" />}
        <p className="bill-drawer-note">Commission and other details can be set later on the {k === 'doctor' ? 'Referral doctors' : 'Agents'} screen.</p>
        {error && <p role="alert" className="quick-add-contact-error">{error}</p>}
      </div>
    </Modal>
  );
}
