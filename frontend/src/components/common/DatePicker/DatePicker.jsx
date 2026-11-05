import React, { useId } from 'react';
import '../Input/Input.css';

const DatePicker = ({
  label,
  name,
  value,
  onChange,
  error,
  required = false,
  disabled = false,
  className = '',
  id,
  ...props
}) => {
  const autoId = useId();
  const inputId = id || autoId;

  return (
    <div className={`form-group ${className}`}>
      {label && (
        <label className="form-label" htmlFor={inputId}>
          <span>{label}</span>
          {required && <span className="form-required-star" aria-hidden="true">*</span>}
        </label>
      )}
      <input
        type="date"
        id={inputId}
        name={name}
        value={value ?? ''}
        onChange={onChange}
        disabled={disabled}
        required={required}
        className={`form-control ${error ? 'has-error' : ''}`}
        {...props}
      />
      {error && <p className="form-error">{error}</p>}
    </div>
  );
};

export default DatePicker;
