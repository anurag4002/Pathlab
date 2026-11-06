import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Input, Select, PatientPicker, Modal, Button } from '../../../components/common';
import { PATIENT_TITLES } from '../billingConstants';
import '../Billing.css';
import { useUiVersion } from '../../../utils/uiVersion';

const PatientDetailsSection = ({
  isExistingPatient,
  setIsExistingPatient,
  patients = [],
  selectedPatientId,
  selectedPatient = null,
  onPatientSelect,
  patientPhone,
  setPatientPhone,
  patientTitle,
  setPatientTitle,
  patientFirstName,
  setPatientFirstName,
  patientLastName,
  setPatientLastName,
  patientGender,
  setPatientGender,
  patientAgeYears,
  setPatientAgeYears,
  patientAgeMonths,
  setPatientAgeMonths,
  patientAgeDays,
  setPatientAgeDays,
  onlineReportRequested,
  setOnlineReportRequested,
  showEmail,
  setShowEmail,
  showAddress,
  setShowAddress,
  showAadhaar,
  setShowAadhaar,
  showHistory,
  setShowHistory,
  patientEmail,
  setPatientEmail,
  patientAddress,
  setPatientAddress,
  patientAadhaar,
  setPatientAadhaar,
  patientHistory,
  setPatientHistory,
  errors
}) => {
  const navigate = useNavigate();

  // Only offer "+ Email" etc. for fields that are still hidden.
  // Once a field is on (default / prefilled from patient), no toggle chip.
  // New look: optional fields stay folded until they have a value or are
  // opened with their "+ Email" chip, so the test search is visible at once.
  const isV2 = useUiVersion() === 'v2';
  const [opened, setOpened] = useState({});
  const open = (key) => setOpened((prev) => ({ ...prev, [key]: true }));
  if (isV2) {
    showEmail = showEmail && (!!patientEmail || !!opened.email);
    showAddress = showAddress && (!!patientAddress || !!opened.address);
    showAadhaar = showAadhaar && (!!patientAadhaar || !!opened.aadhaar);
    showHistory = showHistory && (!!patientHistory || !!opened.history);
  }
  const optionalFields = [
    { key: 'email', label: 'Email', active: showEmail, toggle: () => (isV2 ? open('email') : setShowEmail((v) => !v)) },
    { key: 'address', label: 'Address', active: showAddress, toggle: () => (isV2 ? open('address') : setShowAddress((v) => !v)) },
    { key: 'aadhaar', label: 'Aadhaar', active: showAadhaar, toggle: () => (isV2 ? open('aadhaar') : setShowAadhaar((v) => !v)) },
    { key: 'history', label: 'Patient History', active: showHistory, toggle: () => (isV2 ? open('history') : setShowHistory((v) => !v)) }
  ].filter((f) => !f.active);

  const newPatientFields = (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {/* Mobile Number */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Mobile Number</label>
            <div style={{ display: 'flex' }}>
              <span
                style={{
                  padding: '0 var(--space-2)',
                  border: '1px solid var(--color-border)',
                  borderRight: 'none',
                  background: 'var(--color-background)',
                  display: 'flex',
                  alignItems: 'center',
                  fontSize: 'var(--font-size-sm)',
                  color: 'var(--color-text-muted)',
                  borderRadius: 'var(--radius-sm) 0 0 var(--radius-sm)',
                  height: '2.5rem'
                }}
              >
                +91
              </span>
              <input
                type="text"
                className="form-control"
                value={patientPhone}
                onChange={(e) => setPatientPhone(e.target.value)}
                placeholder="Phone number"
                style={{
                  borderRadius: '0 var(--radius-sm) var(--radius-sm) 0',
                  flex: 1
                }}
              />
            </div>
            {errors?.phone && <p className="form-error">{errors.phone}</p>}
          </div>

          {/* Title + First + Last Name */}
          <div style={{ display: 'grid', gridTemplateColumns: '5rem 1fr 1fr', gap: 'var(--space-2)' }}>
            <Select
              label="Title"
              value={patientTitle}
              onChange={(e) => setPatientTitle(e.target.value)}
              options={PATIENT_TITLES.map((t) => ({ value: t, label: t }))}
              placeholder=""
            />
            <Input
              label="First Name *"
              value={patientFirstName}
              onChange={(e) => setPatientFirstName(e.target.value)}
              error={errors?.firstName}
              placeholder="First Name"
            />
            <Input
              label="Last Name"
              value={patientLastName}
              onChange={(e) => setPatientLastName(e.target.value)}
              placeholder="Last Name"
            />
          </div>

          {/* Gender Toggle */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Sex *</label>
            <div className="gender-toggle-group">
              {['Male', 'Female', 'Other'].map((g) => (
                <button
                  key={g}
                  type="button"
                  className={`gender-toggle-btn ${patientGender === g ? 'active' : ''}`}
                  onClick={() => setPatientGender(g)}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>

          {/* Age */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Age *</label>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 'var(--space-2)' }}>
              <Input
                type="number"
                value={patientAgeYears}
                onChange={(e) => setPatientAgeYears(e.target.value)}
                error={errors?.age}
                placeholder="Years"
              />
              <Input
                type="number"
                value={patientAgeMonths}
                onChange={(e) => setPatientAgeMonths(e.target.value)}
                placeholder="Months"
              />
              <Input
                type="number"
                value={patientAgeDays}
                onChange={(e) => setPatientAgeDays(e.target.value)}
                placeholder="Days"
              />
            </div>
          </div>
        </div>
  );

  // New look: registering a patient opens a panel on the right. Closing it
  // (X, Esc, click outside) keeps everything typed; the card shows a summary.
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState('new');
  const openDrawer = (mode) => { setDrawerMode(mode); setDrawerOpen(true); };
  // Email, Aadhaar, address and history: a profile section in the panel
  // (new look), saved with the bill like before.
  const profileFields = (
    <div className="bill-profile-fields">
      <Input label="Email" type="email" value={patientEmail} onChange={(e) => setPatientEmail(e.target.value)} placeholder="name@example.com" />
      <Input label="Aadhaar number" value={patientAadhaar} onChange={(e) => setPatientAadhaar(e.target.value)} placeholder="12 digits" inputMode="numeric" />
      <Input label="Address / city" value={patientAddress} onChange={(e) => setPatientAddress(e.target.value)} placeholder="House, street, city" />
      <Input label="Symptoms / past history" value={patientHistory} onChange={(e) => setPatientHistory(e.target.value)} placeholder="e.g. fever, diabetic" />
    </div>
  );
  const profileFilled = [patientEmail && 'email', patientAadhaar && 'Aadhaar', patientAddress && 'address', patientHistory && 'history'].filter(Boolean);
  const fieldErrors = errors?.firstName || errors?.phone || errors?.age;
  React.useEffect(() => { if (isV2 && fieldErrors && !isExistingPatient) openDrawer('new'); }, [isV2, fieldErrors, isExistingPatient]);
  const draftName = [patientTitle, patientFirstName, patientLastName].filter(Boolean).join(' ');
  const draftAge = [patientAgeYears && `${patientAgeYears} Y`, patientAgeMonths && `${patientAgeMonths} M`, patientAgeDays && `${patientAgeDays} D`].filter(Boolean).join(' ');
  const draftMissing = [!patientPhone && 'phone', !patientFirstName && 'name', !patientGender && 'sex', !(patientAgeYears || patientAgeMonths || patientAgeDays) && 'age'].filter(Boolean);
  const newPatientSummary = (
    <div className={`bill-new-patient-summary${draftMissing.length ? ' is-incomplete' : ''}`}>
      <div className="bill-new-patient-text">
        <strong>{draftName || 'New patient'}</strong>
        <span>{[draftAge, patientGender, patientPhone && `+91 ${patientPhone}`].filter(Boolean).join(' \u00b7 ') || 'No details yet'}</span>
        {draftMissing.length > 0 && <span className="bill-new-patient-missing">Still needed: {draftMissing.join(', ')}</span>}
      </div>
      <div className="bill-new-patient-actions">
        <Button variant="secondary" size="sm" onClick={() => openDrawer('new')}>{draftMissing.length ? 'Fill details' : 'Edit'}</Button>
        <button type="button" className="bill-inline-add" onClick={() => setIsExistingPatient(true)}>Find existing instead</button>
      </div>
    </div>
  );

  return (
    <div className="bill-form-card bill-step-patient">
      <div className="bill-card-header">
        <div className="bill-card-header-left">
          <span className="bill-card-step-badge">1</span>
          <h3 className="bill-card-title">{isV2 ? 'Patient' : 'Patient Details'}</h3>
        </div>
        {!(isV2 && !isExistingPatient) && <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => {
            if (isV2) { setIsExistingPatient(false); openDrawer('new'); return; }
            setIsExistingPatient((prev) => !prev);
          }}
        >
          {isV2 ? '+ New patient' : isExistingPatient ? 'Register New' : 'Select Existing'}
        </button>}
      </div>

      {isExistingPatient ? (
        <PatientPicker
          label={isV2 ? 'Find the patient' : 'Search Registered Patients'}
          value={selectedPatient || patients.find((p) => p._id === selectedPatientId) || null}
          onSelect={onPatientSelect}
          error={errors?.patient}
          required
          placeholder={isV2 ? 'Type name, phone or reg no…' : 'Recently registered first — type name, phone or reg no…'}
        />
      ) : isV2 ? (
        <div>
          <div className="form-label">New patient</div>
          {newPatientSummary}
        </div>
      ) : (
        newPatientFields
      )}

      {/* Online Report Checkbox */}
      <div className={isV2 ? 'bill-patient-extras' : undefined} style={isV2 ? undefined : { display: 'contents' }}>
      <label
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
          fontSize: 'var(--font-size-sm)',
          cursor: 'pointer'
        }}
      >
        <input
          type="checkbox"
          checked={onlineReportRequested}
          onChange={(e) => setOnlineReportRequested(e.target.checked)}
        />
        <span>{isV2 ? 'Send the report online (SMS / email link)' : 'Online report requested (auto email/SMS findings link)'}</span>
      </label>
      {isV2 && (isExistingPatient ? !!(selectedPatient || selectedPatientId) : true) && (
        <button type="button" className="bill-profile-link" onClick={() => openDrawer(isExistingPatient ? 'profile' : 'new')}>
          {profileFilled.length ? `Email, address\u2026 (${profileFilled.length} added)` : '+ Email, Aadhaar, address, history'}
        </button>
      )}
      </div>

      {/* + chips only when a field is still off; defaults / prefilled stay as inputs only */}
      {!isV2 && optionalFields.length > 0 && (
        <div className="optional-field-badges">
          {optionalFields.map((f) => (
            <button
              key={f.key}
              type="button"
              className="optional-badge-btn"
              onClick={f.toggle}
              title={`Show ${f.label}`}
            >
              + {f.label}
            </button>
          ))}
        </div>
      )}

      {!isV2 && <>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
        {showEmail && (
          <Input
            label="Email Address"
            value={patientEmail}
            onChange={(e) => setPatientEmail(e.target.value)}
            placeholder="example@gmail.com"
          />
        )}
        {showAadhaar && (
          <Input
            label="Aadhaar ID Card"
            value={patientAadhaar}
            onChange={(e) => setPatientAadhaar(e.target.value)}
            placeholder="12-digit UID"
          />
        )}
      </div>
      {showAddress && (
        <Input
          label="Home Address / City"
          value={patientAddress}
          onChange={(e) => setPatientAddress(e.target.value)}
          placeholder="Address details"
        />
      )}
      {showHistory && (
        <Input
          label="Symptoms / Past History"
          value={patientHistory}
          onChange={(e) => setPatientHistory(e.target.value)}
          placeholder="Cough, high sugar, fever, etc."
        />
      )}
      </>}
      {isV2 && (
        <Modal isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} variant="drawer" title={drawerMode === 'new' ? 'New patient' : 'Patient details'}
          footer={<>
            <span className="bill-drawer-note">Closing keeps what you typed.</span>
            <Button variant="primary" onClick={() => setDrawerOpen(false)}>Done</Button>
          </>}>
          <div className="bill-new-patient-form" onKeyDown={(event) => { if (event.key === 'Enter' && event.target.matches('input')) { event.preventDefault(); setDrawerOpen(false); } }}>
            {drawerMode === 'new' ? newPatientFields : (() => {
              const p = selectedPatient || patients.find((x) => x._id === selectedPatientId) || {};
              return (
                <div className="bill-profile-head">
                  <strong>{[p.title, p.name].filter(Boolean).join(' ') || 'Patient'}</strong>
                  <span>{[p.age != null && p.age !== '' && `${p.age} ${(p.ageUnit || 'Years').charAt(0)}`, p.gender, p.phone && `+91 ${p.phone}`, p.registrationNumber].filter(Boolean).join(' \u00b7 ')}</span>
                </div>
              );
            })()}
            <div className="bill-profile-section">
              <h4>{drawerMode === 'new' ? 'More details (optional)' : 'Contact and history'}</h4>
              {profileFields}
              {drawerMode === 'profile' && <p className="bill-drawer-note">Changes are saved to the patient when you create the bill.</p>}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default PatientDetailsSection;
