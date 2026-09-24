import React, { useEffect, useState } from 'react';
import { User, ShieldCheck, Briefcase, FileText, Building2 } from 'lucide-react';
import { Input, Select } from '../../../components/common';
import PermissionMatrix from './PermissionMatrix';
import { getBranches, branchIdOf } from '../../../services/branchService';
import './EmployeeForm.css';

const DEPARTMENTS = ['LAB', 'USG', 'XRAY', 'ECG', 'CT SCAN', 'MRI', 'Front Desk', 'Billing', 'Collection'];

const EmployeeForm = ({ formData, setFormData, errors, editing, isSuperadmin }) => {
  const set = (k, v) => setFormData((p) => ({ ...p, [k]: v }));
  const [branches, setBranches] = useState([]);
  useEffect(() => {
    let active = true;
    getBranches({ status: 'Active' })
      .then((res) => {
        if (!active) return;
        setBranches(Array.isArray(res?.data) ? res.data : []);
      })
      .catch(() => { if (active) setBranches([]); });
    return () => { active = false; };
  }, []);
  const toggleDept = (d) => setFormData((p) => {
    const cur = p.departments || [];
    return { ...p, departments: cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d] };
  });

  return (
    <div className="emp-form">
      {errors.api && <div className="emp-form-alert" role="alert">{errors.api}</div>}

      <section className="emp-form-section" aria-label="Identity">
        <h4 className="emp-form-section-title"><User size={15} /> Identity</h4>
        <div className="emp-form-grid">
          <div className="emp-form-full">
            <Input label="Full Name" name="name" value={formData.name} onChange={(e) => set('name', e.target.value)} error={errors.name} placeholder="e.g. Sunita Sharma" required />
          </div>
          <Input label="Email Address" name="email" type="email" value={formData.email} onChange={(e) => set('email', e.target.value)} error={errors.email} placeholder="name@purepathlab.in" required />
          <Input label="Phone" name="phone" value={formData.phone || ''} onChange={(e) => set('phone', e.target.value)} placeholder="+91…" />
        </div>
      </section>

      <section className="emp-form-section" aria-label="Login and access">
        <h4 className="emp-form-section-title"><ShieldCheck size={15} /> Login & Access</h4>
        <div className="emp-form-grid">
          <div className="emp-form-full">
            <Input
              label={editing ? 'Reset Password (leave blank to keep current)' : 'Password *'}
              name="password" type="password" value={formData.password || ''}
              onChange={(e) => set('password', e.target.value)} error={errors.password} required={!editing}
              placeholder={editing ? '••••••••' : 'Set a strong password'}
            />
          </div>
          <Select
            label="Portal Role" value={formData.role}
            onChange={(e) => set('role', e.target.value)}
            options={[
              { value: 'Employee', label: 'Laboratory Operator / Employee' },
              { value: 'Admin', label: 'Administrator' },
            ]}
            required
          />
          <Select
            label="Status" value={formData.status}
            onChange={(e) => set('status', e.target.value)}
            options={[{ value: 'Active', label: 'Active' }, { value: 'Inactive', label: 'Inactive' }]}
            required
          />
          <Input label="Joining Date" name="joiningDate" type="date" value={formData.joiningDate || ''} onChange={(e) => set('joiningDate', e.target.value)} />
        </div>
      </section>

      <section className="emp-form-section" aria-label="Branch assignment">
        <h4 className="emp-form-section-title"><Building2 size={15} /> Branch (single-branch access)</h4>
        <div className="emp-form-grid">
          <Select
            label="Assigned Branch"
            value={branchIdOf(formData.branch) || formData.branch || ''}
            onChange={(e) => set('branch', e.target.value)}
            options={[
              { value: '', label: 'Main (default)' },
              ...branches.map((b) => ({ value: b._id, label: `${b.name} (${b.code})` }))
            ]}
            required
          />
        </div>
        {errors.branch && <p className="form-error">{errors.branch}</p>}
        <p className="form-hint">Staff see only their own branch. Admins see all branches.</p>
      </section>

      <section className="emp-form-section" aria-label="Work profile">
        <h4 className="emp-form-section-title"><Briefcase size={15} /> Work Profile</h4>
        <div className="emp-form-grid">
          <Input label="Designation" name="designation" value={formData.designation || ''} onChange={(e) => set('designation', e.target.value)} placeholder="e.g. Lab Technician" />
          <Input label="Qualification" name="qualification" value={formData.qualification || ''} onChange={(e) => set('qualification', e.target.value)} placeholder="e.g. DMLT" />
        </div>
        <div>
          <label className="form-label"><span>Departments (at least one)</span></label>
          <div className="emp-dept-row" role="group" aria-label="Departments">
            {DEPARTMENTS.map((d) => {
              const on = (formData.departments || []).includes(d);
              return (
                <label key={d} className={`emp-dept-chip ${on ? 'on' : ''}`}>
                  <input type="checkbox" checked={on} onChange={() => toggleDept(d)} />
                  {d}
                </label>
              );
            })}
          </div>
          {errors.departments && <p className="form-error">{errors.departments}</p>}
        </div>
        <Input label="Documents / ID references (comma separated)" name="documents" value={formData.documents || ''} onChange={(e) => set('documents', e.target.value)} placeholder="e.g. Aadhaar XXXX, offer letter ref" />
      </section>

      <section className="emp-form-section" aria-label="Permissions">
        <h4 className="emp-form-section-title"><FileText size={15} /> Permissions</h4>
        <PermissionMatrix
          value={formData.permissions}
          onChange={(m) => set('permissions', m)}
          disabledReason={isSuperadmin ? 'Superadmin keeps all permissions — the matrix is shown for reference.' : undefined}
        />
      </section>
    </div>
  );
};

export default EmployeeForm;
