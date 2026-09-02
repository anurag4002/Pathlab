import React from 'react';
import '../Input/Input.css';
import './Select.css';

const Select = ({
  label,
  name,
  value,
  onChange,
  options = [],
  error,
  placeholder = 'Select an option',
  required = false,
  disabled = false,
  className = '',
  id,
  ...props
}) => {
  const selectId = id || name;

  return (
    <div className={`form-group ${className}`}>
      {label && (
        <label className="form-label" htmlFor={selectId}>
          <span>{label}</span>
          {required && <span className="form-required-star" aria-hidden="true">*</span>}
        </label>
      )}
      <div className="select-wrapper">
        <select
          id={selectId}
          name={name}
          value={value ?? ''}
          onChange={onChange}
          disabled={disabled}
          required={required}
          className={`select-control ${error ? 'has-error' : ''}`}
          aria-invalid={!!error}
          aria-describedby={error ? `${selectId}-error` : undefined}
          {...props}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
      {error && <p className="form-error" id={`${selectId}-error`}>{error}</p>}
    </div>
  );
};

export default Select;
