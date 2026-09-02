import React from 'react';
import { Modal, Button, Input, Select } from '../../../components/common';
import { GENDER_OPTIONS } from '../../../constants/patientConstants';

const EMPTY_FORM = {
  name: '',
  age: '',
  gender: '',
  phone: '',
  address: '',
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
  const handleChange = (field) => (e) =>
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));

  const footer = (
    <>
      <Button variant="secondary" onClick={onClose} disabled={loading}>
        Cancel
      </Button>
      <Button variant="primary" onClick={onSubmit} loading={loading}>
        {isEditing ? 'Update Patient' : 'Register Patient'}
      </Button>
    </>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Patient Details' : 'Register New Patient'}
      footer={footer}
      size="md"
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
        <Input
          label="Patient Name"
          name="name"
          value={formData.name}
          onChange={handleChange('name')}
          error={errors.name}
          required
        />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
          <Input
            label="Age (Years)"
            name="age"
            type="number"
            value={formData.age}
            onChange={handleChange('age')}
            error={errors.age}
            required
          />
          <Select
            label="Gender"
            name="gender"
            value={formData.gender}
            onChange={handleChange('gender')}
            options={GENDER_OPTIONS}
            error={errors.gender}
            required
            placeholder="Select gender"
          />
        </div>
        <Input
          label="Phone Number"
          name="phone"
          value={formData.phone}
          onChange={handleChange('phone')}
          error={errors.phone}
          required
        />
        <Input
          label="Full Address"
          name="address"
          value={formData.address}
          onChange={handleChange('address')}
        />
        <Select
          label="Referring Doctor"
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
