import React from 'react';
import { Modal, Button, Input, Select } from '../../../components/common';
import { GENDER_OPTIONS } from '../../../constants/patientConstants';
import useAuth from '../../../hooks/useAuth';
import { useUiVersion } from '../../../utils/uiVersion';

const EMPTY_FORM = {
  name: '',
  age: '',
  ageUnit: 'years',
  birthYear: '',
  gender: '',
  phone: '',
  address: '',
  email: '',
  aadhaar: '',
  history: '',
  uhid: '',
  referringDoctor: ''
};

const PatientFormModal = ({
  isOpen,
  onClose,
  onSubmit,
  formData,
  setFormData,
  errors,
  loading,
  isEditing,
  doctors = [],
  doctorsLoading = false
}) => {
  const { user } = useAuth();
  const isV2 = useUiVersion() === 'v2';
  const identityLocked = isEditing && user?.role !== 'Admin';
  const handleChange = (field) => (e) =>
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));

  const footer = (
    <>
      {isV2 && !isEditing && <span className="cases-drawer-note">Closing keeps what you typed.</span>}
      <Button variant="secondary" onClick={onClose} disabled={loading}>
        Cancel
      </Button>
      <Button variant="primary" onClick={onSubmit} loading={loading}>
        {isV2 ? (isEditing ? 'Save changes' : 'Add patient') : isEditing ? 'Update Patient' : 'Register Patient'}
      </Button>
    </>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isV2 ? (isEditing ? 'Edit patient' : 'New patient') : isEditing ? 'Edit Patient Details' : 'Register New Patient'}
      footer={footer}
      variant="drawer"
      size="lg"
    >
      <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        {errors.api && (
          <div
            style={{
              padding: 'var(--space-2) var(--space-3)',
              backgroundColor: 'var(--color-danger-bg)',
              color: 'var(--color-danger)',
              borderRadius: 'var(--radius-sm)',
              fontSize: 'var(--font-size-sm)'
            }}
          >
            {errors.api}
          </div>
        )}
        {!isEditing && (
          <p className="form-helper">Registration number is assigned by the server when the patient is created.</p>
        )}
        <Input
          label={isV2 ? 'Name' : 'Patient Name'}
          name="name"
          disabled={identityLocked}
          helperText={identityLocked ? 'Only Admin can change the patient name.' : undefined}
          value={formData.name}
          onChange={handleChange('name')}
          error={errors.name}
          required
        />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
          <Input
            label="Age"
            name="age"
            type="number"
            step="any"
            min="0"
            value={formData.age}
            onChange={handleChange('age')}
            error={errors.age}
            required
          />
          <Input label="Birth year (patient login)" name="birthYear" disabled={identityLocked} type="number" min="1850" max="2200" value={formData.birthYear || ''} onChange={handleChange('birthYear')} error={errors.birthYear} helperText="Enter the actual birth year. If blank, the registration year minus age is used." />
          <Select label="Age unit" name="ageUnit" value={formData.ageUnit || 'years'}
            onChange={handleChange('ageUnit')} options={[{ value: 'years', label: 'Years' }, { value: 'months', label: 'Months' }, { value: 'days', label: 'Days' }]}
            placeholder="" error={errors.ageUnit} />
          <Select
            label={isV2 ? 'Sex' : 'Gender'}
            name="gender"
            value={formData.gender}
            onChange={handleChange('gender')}
            options={GENDER_OPTIONS}
            error={errors.gender}
            required
            placeholder="Select gender"
          />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
          <Input
            label={isV2 ? 'Phone number' : 'Phone Number'}
            name="phone"
            disabled={identityLocked}
            helperText={identityLocked ? 'Only Admin can change the phone number.' : undefined}
            value={formData.phone}
            onChange={handleChange('phone')}
            error={errors.phone}
            required
          />
          <Input
            label="UHID"
            name="uhid"
            value={formData.uhid || ''}
            onChange={handleChange('uhid')}
            placeholder="Universal Health ID (optional)"
          />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
          <Input
            label="Email"
            name="email"
            type="email"
            value={formData.email || ''}
            onChange={handleChange('email')}
            placeholder="example@gmail.com"
          />
          <Input
            label="Aadhaar"
            name="aadhaar"
            value={formData.aadhaar || ''}
            onChange={handleChange('aadhaar')}
            placeholder="12-digit UID"
          />
        </div>
        <Input
          label={isV2 ? 'Address' : 'Full Address'}
          name="address"
          value={formData.address}
          onChange={handleChange('address')}
          placeholder="Home address / city"
        />
        <Input
          label={isV2 ? 'Symptoms or past history' : 'Symptoms / Past History'}
          name="history"
          value={formData.history || ''}
          onChange={handleChange('history')}
          placeholder="Cough, high sugar, fever, etc."
        />
        <Select
          label={isV2 ? 'Referred by' : 'Referring Doctor'}
          name="referringDoctor"
          value={formData.referringDoctor}
          onChange={handleChange('referringDoctor')}
          options={doctors}
          placeholder={doctorsLoading ? 'Loading doctors...' : 'Walk-in / Self (no referral)'}
        />
      </form>
    </Modal>
  );
};

export { EMPTY_FORM };
export default PatientFormModal;
