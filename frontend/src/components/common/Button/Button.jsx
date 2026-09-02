import React from 'react';
import './Button.css';

const Button = ({
  children,
  onClick,
  type = 'button',
  variant = 'primary', // 'primary' | 'secondary' | 'danger' | 'ghost'
  size = 'md',        // 'sm' | 'md' | 'lg'
  block = false,
  loading = false,
  disabled = false,
  icon,
  className = '',
  ...props
}) => {
  const sizeClass = size !== 'md' ? `btn-${size}` : '';
  const blockClass = block ? 'btn-block' : '';

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`btn btn-${variant} ${sizeClass} ${blockClass} ${disabled || loading ? 'btn-disabled' : ''} ${className}`}
      {...props}
    >
      {loading ? (
        <>
          <span className="btn-spinner" aria-hidden="true" />
          <span>Loading...</span>
        </>
      ) : (
        <>
          {icon && <span className="btn-icon">{icon}</span>}
          {children}
        </>
      )}
    </button>
  );
};

export default Button;
