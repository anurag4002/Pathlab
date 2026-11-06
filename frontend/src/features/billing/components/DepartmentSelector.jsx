import React from 'react';
import { DEPARTMENTS, filterTestsByDepartment } from '../billingConstants';
import '../Billing.css';
import { rovingKeyDown } from '../../../utils/rovingFocus';

const DepartmentSelector = ({ activeDepartment, onSelect, tests = [], packages = [], panels = [], existingDepartment, compact = false }) => {
  const activeCatalog = [...tests, ...packages, ...panels].filter(item => !item.isDeleted && (!item.status || item.status === 'Active'));
  const departments = [{ name: 'ALL', icon: DEPARTMENTS[0].icon }, ...DEPARTMENTS].filter(dept =>
    ['ALL', 'LAB', 'OUTSOURCE LAB'].includes(dept.name) || dept.name === existingDepartment
    || filterTestsByDepartment(activeCatalog, dept.name).length > 0)
    // New look: outsource tests have their own button, so not a department here.
    .filter((dept) => !compact || dept.name !== 'OUTSOURCE LAB' || dept.name === existingDepartment);
  if (compact) {
    const count = (name) => (name === 'ALL' ? activeCatalog.length : filterTestsByDepartment(activeCatalog, name).length);
    return (
      <label className="bill-dept-select">
        <span>Show</span>
        <select value={activeDepartment || 'ALL'} onChange={(event) => onSelect(event.target.value)} aria-label="Show tests from department">
          {departments.map((dept) => (
            <option key={dept.name} value={dept.name}>{dept.name === 'ALL' ? `All departments (${count('ALL')})` : `${dept.name} (${count(dept.name)})`}</option>
          ))}
        </select>
      </label>
    );
  }
  return (
    <div>
      <label
        className="form-label"
        style={{ marginBottom: 'var(--space-2)', fontWeight: 'var(--font-weight-semibold)' }}
      >
        Select Department
      </label>
      <div className="department-selector-grid" role="radiogroup" aria-label="Department">
        {departments.map((dept, index) => {
          const Icon = dept.icon;
          const isActive = activeDepartment === dept.name;
          return (
            <button
              key={dept.name}
              type="button"
              className={`department-btn ${isActive ? 'active' : ''}`}
              onClick={() => onSelect(dept.name)}
              role="radio"
              aria-checked={isActive}
              tabIndex={isActive || (!departments.some(d => d.name === activeDepartment) && index === 0) ? 0 : -1}
              onKeyDown={(event) => rovingKeyDown(event, departments.length, index, (next) => onSelect(departments[next].name))}
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
