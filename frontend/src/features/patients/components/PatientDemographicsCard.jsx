import React from 'react';
import { User } from 'lucide-react';
import '../Patients.css';

const PatientDemographicsCard = ({ patient }) => {
  const fields = [
    { label: 'Age / Gender', value: `${patient.age ?? '—'} Years / ${patient.gender || '—'}` },
    { label: 'Phone', value: patient.phone || '—' },
    { label: 'UHID', value: patient.uhid || '—' },
    { label: 'Email', value: patient.email || '—' },
    { label: 'Aadhaar', value: patient.aadhaar || '—' },
    { label: 'Doctor Referral', value: patient.referringDoctor?.name || 'Self / Walk-in' },
    { label: 'Address', value: patient.address || '—' },
    { label: 'History / Symptoms', value: patient.history || '—' }
  ];

  return (
    <div className="demographics-card">
      <div className="demographics-avatar-box">
        <div className="demographics-avatar-icon" aria-hidden="true">
          <User size={32} />
        </div>
        <div>
          <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-bold)', margin: 0 }}>
            {patient.name}
          </h2>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', margin: 0 }}>
            {patient.registrationNumber}
            {patient.title ? ` · ${patient.title}` : ''}
          </p>
        </div>
      </div>
      <div className="demographics-details-grid">
        {fields.map((field) => (
          <div key={field.label}>
            <span className="demographics-field-label">{field.label}</span>
            <span className="demographics-field-value">{field.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PatientDemographicsCard;
