import React from 'react';
import normalizePermissions from './normalizePermissions';
import './PermissionMatrix.css';

const PermissionMatrix = ({
  permissions,
  availableKeys = [],
  disabled = false,
  onChange
}) => {
  const normalized = normalizePermissions(permissions);
  const keys = [...new Set(
    (Array.isArray(availableKeys) ? availableKeys : [])
      .filter((key) => typeof key === 'string' && key.trim())
  )].sort();

  if (keys.length === 0) {
    return (
      <div className="permission-matrix-empty" role="note">
        No permission keys were returned by the existing user API. A permission catalog is required before additional permissions can be offered.
      </div>
    );
  }

  if (Object.keys(normalized).length === 0) {
    return (
      <div className="permission-matrix-empty" role="note">
        No explicit permission entries are stored for this user. The backend treats an empty permission map as legacy/default behavior, so no per-permission edit state can be inferred safely.
      </div>
    );
  }

  const enabledCount = keys.filter((key) => normalized[key] === true).length;

  return (
    <fieldset className="permission-matrix" disabled={disabled}>
      <legend>Permission Matrix</legend>
      <p className="permission-matrix-description">
        Permission values are stored per user by the existing API. No role-level mapping is inferred by this screen.
      </p>
      <div className="permission-matrix-grid">
        {keys.map((key) => (
          <label className="permission-matrix-item" key={key}>
            <input
              type="checkbox"
              checked={normalized[key] === true}
              onChange={(event) => onChange?.(key, event.target.checked)}
            />
            <span>{key}</span>
          </label>
        ))}
      </div>
      {enabledCount === 1 && (
        <p className="permission-matrix-warning" role="note">
          Removing the final explicit permission may change the backend from an explicit matrix to its legacy empty-map behavior. Review before saving.
        </p>
      )}
    </fieldset>
  );
};

export default PermissionMatrix;
