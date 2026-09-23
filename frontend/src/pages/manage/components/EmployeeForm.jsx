import React from 'react';
import { Input, Select } from '../../../components/common';
import PermissionMatrix from './PermissionMatrix';

// Phase 19 — extended employee form: designation / department / joining
// date / documents + permission matrix (Phase 25). Sessions panel omitted:
// GET /api/users/:id/sessions and revoke endpoints do not exist.
const DEPARTMENTS = ['LAB', 'USG', 'XRAY', 'ECG', 'CT SCAN', 'MRI', 'Front Desk', 'Billing', 'Collection'];

const EmployeeForm = ({ formData, setFormData, errors, editing, isSuperadmin }) => {
  const set = (k, v) => setFormData((p) => ({ ...p, [k]: v }));
  const toggleDept = (d) => setFormData((p) => {
    const cur = p.departments || [];
    return { ...p, departments: cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d] };
  });

  return (
    <div className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
      {errors.api && <div className="form-error">{errors.api}</div>}
      <Input label="Full Name" name="name" value={formData.name} onChange={(e) => set('name', e.target.value)} error={errors.name} required />
      <div style={{ display: 'flex', gap: '12px' }}>
        <Input label="Email Address" name="email" type="email" value={formData.email} onChange={(e) => set('email', e.target.value)} error={errors.email} required style={{ flex: 1 }} />
        <Input label="Phone" name="phone" value={formData.phone || ''} onChange={(e) => set('phone', e.target.value)} style={{ flex: 1 }} />
      </div>
      <Input
        label={editing ? 'Reset Password (leave blank to keep current)' : 'Password *'}
        name="password" type="password" value={formData.password || ''}
        onChange={(e) => set('password', e.target.value)} error={errors.password} required={!editing}
      />
      <div style={{ display: 'flex', gap: '12px' }}>
        <Input label="Designation" name="designation" value={formData.designation || ''} onChange={(e) => set('designation', e.target.value)} placeholder="e.g. Lab Technician" style={{ flex: 1 }} />
        <Input label="Qualification" name="qualification" value={formData.qualification || ''} onChange={(e) => set('qualification', e.target.value)} placeholder="e.g. DMLT" style={{ flex: 1 }} />
      </div>
      <div style={{ display: 'flex', gap: '12px' }}>
        <Select
          label="Portal Role" value={formData.role}
          onChange={(e) => set('role', e.target.value)}
          options={[
            { value: 'Employee', label: 'Laboratory Operator / Employee' },
            { value: 'Admin', label: 'Administrator' },
          ]}
          required style={{ flex: 1 }}
        />
        <Select
          label="Status" value={formData.status}
          onChange={(e) => set('status', e.target.value)}
          options={[{ value: 'Active', label: 'Active' }, { value: 'Inactive', label: 'Inactive' }]}
          required style={{ flex: 1 }}
        />
      </div>
      <Input label="Joining Date" name="joiningDate" type="date" value={formData.joiningDate || ''} onChange={(e) => set('joiningDate', e.target.value)} />
      <div>
        <label className="form-label"><span>Departments (at least one)</span></label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 16px' }}>
          {DEPARTMENTS.map((d) => (
            <label key={d} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '.85rem' }}>
              <input type="checkbox" checked={(formData.departments || []).includes(d)} onChange={() => toggleDept(d)} /> {d}
            </label>
          ))}
        </div>
        {errors.departments && <p className="form-error">{errors.departments}</p>}
      </div>
      <Input label="Documents / ID references (comma separated)" name="documents" value={formData.documents || ''} onChange={(e) => set('documents', e.target.value)} placeholder="e.g. Aadhaar XXXX, offer letter ref" />
      <PermissionMatrix
        value={formData.permissions}
        onChange={(m) => set('permissions', m)}
        disabledReason={isSuperadmin ? 'Superadmin retains all permissions — the matrix is shown for reference.' : undefined}
      />
      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>
        Note: active-sessions view / revoke is not available — session list endpoints do not exist on the backend.
      </p>
    </div>
  );
};

export default EmployeeForm;
