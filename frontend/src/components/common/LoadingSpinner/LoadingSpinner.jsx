import React from 'react';
import './LoadingSpinner.css';

const LoadingSpinner = ({ label = 'Loading...', size, className = '' }) => {
  const sizeStyle = size ? { width: `${size}rem`, height: `${size}rem` } : {};

  return (
    <div className={`spinner-container ${className}`} role="status">
      <div className="spinner-element" style={sizeStyle} />
      {label && <span className="spinner-text">{label}</span>}
    </div>
  );
};

export default LoadingSpinner;
