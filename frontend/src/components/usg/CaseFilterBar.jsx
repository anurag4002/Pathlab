import React from 'react';

/**
 * CaseFilterBar (Phase 13) — department + assigned-to + status + search
 * filters for USG case lists. Selected values are sent as query params
 * (backend ignores unknown ones) AND applied client-side so the list
 * always filters even before server-side support lands.
 */
const CaseFilterBar = ({
  department = '',
  onDepartmentChange,
  departments = [],
  assignedTo = '',
  onAssignedChange,
  assignees = [],
  status = '',
  onStatusChange,
  search = '',
  onSearchChange
}) => (
  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '1rem' }}>
    {onDepartmentChange && (
      <label style={{ fontSize: '0.78rem', display: 'flex', flexDirection: 'column', gap: 4 }}>
        Department
        <select value={department} onChange={(e) => onDepartmentChange(e.target.value)} className="select-control" style={{ minWidth: 150 }}>
          <option value="">All departments</option>
          {departments.map((d) => (
            <option key={d.value || d} value={d.value || d}>{d.label || d}</option>
          ))}
        </select>
      </label>
    )}
    {onAssignedChange && (
      <label style={{ fontSize: '0.78rem', display: 'flex', flexDirection: 'column', gap: 4 }}>
        Assigned to
        <select value={assignedTo} onChange={(e) => onAssignedChange(e.target.value)} className="select-control" style={{ minWidth: 170 }}>
          <option value="">Everyone</option>
          {assignees.map((a) => (
            <option key={a.value || a} value={a.value || a}>{a.label || a}</option>
          ))}
        </select>
      </label>
    )}
    {onStatusChange && (
      <label style={{ fontSize: '0.78rem', display: 'flex', flexDirection: 'column', gap: 4 }}>
        Status
        <select value={status} onChange={(e) => onStatusChange(e.target.value)} className="select-control" style={{ minWidth: 140 }}>
          <option value="">All statuses</option>
          <option value="Pending">Pending Signature</option>
          <option value="Completed">Completed Report</option>
        </select>
      </label>
    )}
    {onSearchChange && (
      <label style={{ fontSize: '0.78rem', display: 'flex', flexDirection: 'column', gap: 4 }}>
        Search
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Patient name / reg no…"
          className="select-control"
          style={{ minWidth: 200 }}
        />
      </label>
    )}
  </div>
);

export default CaseFilterBar;
