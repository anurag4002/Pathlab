import React from 'react';
import { DEPARTMENTS, filterTestsByDepartment } from '../billingConstants';
import '../Billing.css';

const DepartmentSelector = ({ activeDepartment, onSelect, tests = [], packages = [], panels = [], existingDepartment }) => {
  const activeCatalog = [...tests, ...packages, ...panels].filter(item => !item.isDeleted && (!item.status || item.status === 'Active'));
  const departments = [{ name: 'ALL', icon: DEPARTMENTS[0].icon }, ...DEPARTMENTS].filter(dept =>
    ['ALL', 'LAB', 'OUTSOURCE LAB'].includes(dept.name) || dept.name === existingDepartment
    || filterTestsByDepartment(activeCatalog, dept.name).length > 0);
  return (
    <div>
      <label
        className="form-label"
        style={{ marginBottom: 'var(--space-2)', fontWeight: 'var(--font-weight-semibold)' }}
      >
        Select Department
      </label>
      <div className="department-selector-grid">
        {departments.map((dept) => {
          const Icon = dept.icon;
          const isActive = activeDepartment === dept.name;
          return (
            <button
              key={dept.name}
              type="button"
              className={`department-btn ${isActive ? 'active' : ''}`}
              onClick={() => onSelect(dept.name)}
              aria-pressed={isActive}
            >
              <Icon size={18} aria-hidden="true" />
              <span>{dept.name === 'ALL' ? 'All' : dept.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default DepartmentSelector;
