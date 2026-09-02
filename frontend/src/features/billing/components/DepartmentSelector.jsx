import React from 'react';
import { DEPARTMENTS } from '../billingConstants';
import '../Billing.css';

const DepartmentSelector = ({ activeDepartment, onSelect }) => {
  return (
    <div>
      <label
        className="form-label"
        style={{ marginBottom: 'var(--space-2)', fontWeight: 'var(--font-weight-semibold)' }}
      >
        Select Department
      </label>
      <div className="department-selector-scroll">
        {DEPARTMENTS.map((dept) => {
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
              <span>{dept.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default DepartmentSelector;
