import React from 'react';
import './Input.css';

const Input = ({
  label,
  name,
  type = 'text',
  value,
  onChange,
  error,
  helperText,
  placeholder,
  required = false,
  disabled = false,
  className = '',
  id,
  ...props
}) => {
  const inputId = id || name;

  return (
    <div className={`form-group ${className}`}>
      {label && (
        <label className="form-label" htmlFor={inputId}>
          <span>{label}</span>
          {required && <span className="form-required-star" aria-hidden="true">*</span>}
        </label>
      )}
      <div className="form-control-wrapper">
        <input
          type={type}
          id={inputId}
          name={name}
          value={value ?? ''}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          className={`form-control ${error ? 'has-error' : ''}`}
          aria-invalid={!!error}
          aria-describedby={error ? `${inputId}-error` : undefined}
          {...props}
        />
      </div>
      {error && <p className="form-error" id={`${inputId}-error`}>{error}</p>}
      {helperText && !error && <p className="form-helper">{helperText}</p>}
    </div>
  );
};

export default Input;
