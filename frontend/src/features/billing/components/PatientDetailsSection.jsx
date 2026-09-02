import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Input, Select } from '../../../components/common';
import { PATIENT_TITLES } from '../billingConstants';
import '../Billing.css';

const PatientDetailsSection = ({
  isExistingPatient,
  setIsExistingPatient,
  patients = [],
  selectedPatientId,
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

  const optionalFields = [
    { key: 'email', label: 'Email', active: showEmail, toggle: () => setShowEmail((v) => !v) },
    { key: 'address', label: 'Address', active: showAddress, toggle: () => setShowAddress((v) => !v) },
    { key: 'aadhaar', label: 'Aadhaar', active: showAadhaar, toggle: () => setShowAadhaar((v) => !v) },
    { key: 'history', label: 'Patient History', active: showHistory, toggle: () => setShowHistory((v) => !v) }
  ];

  return (
    <div className="bill-form-card">
      <div className="bill-card-header">
        <div className="bill-card-header-left">
          <span className="bill-card-step-badge">1</span>
          <h3 className="bill-card-title">Patient Details</h3>
        </div>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => setIsExistingPatient((prev) => !prev)}
        >
          {isExistingPatient ? 'Register New' : 'Select Existing'}
        </button>
      </div>

      {isExistingPatient ? (
        <Select
          label="Search Registered Patients"
          value={selectedPatientId}
          onChange={onPatientSelect}
          options={patients.map((p) => ({ value: p._id, label: `${p.name} (${p.phone})` }))}
          error={errors?.patient}
          placeholder="Choose patient profile..."
        />
      ) : (
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
      )}

      {/* Online Report Checkbox */}
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
        <span>Online report requested (auto email/SMS findings link)</span>
      </label>

      {/* Optional Field Toggles */}
      <div className="optional-field-badges">
        {optionalFields.map((f) => (
          <button
            key={f.key}
            type="button"
            className={`optional-badge-btn ${f.active ? 'active' : ''}`}
            onClick={f.toggle}
          >
            + {f.label}
          </button>
        ))}
      </div>

      {/* Rendered Optional Inputs */}
      {showEmail && (
        <Input
          label="Email Address"
          value={patientEmail}
          onChange={(e) => setPatientEmail(e.target.value)}
          placeholder="example@gmail.com"
        />
      )}
      {showAddress && (
        <Input
          label="Home Address / City"
          value={patientAddress}
          onChange={(e) => setPatientAddress(e.target.value)}
          placeholder="Address details"
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
      {showHistory && (
        <Input
          label="Symptoms / Past History"
          value={patientHistory}
          onChange={(e) => setPatientHistory(e.target.value)}
          placeholder="Cough, high sugar, fever, etc."
        />
      )}
    </div>
  );
};

export default PatientDetailsSection;
