import React from 'react';
import './PageHeader.css';

const PageHeader = ({ title, subtitle, action, className = '' }) => {
  return (
    <header className={`page-header ${className}`}>
      <div className="page-header-title-group">
        <h1 className="page-header-title">{title}</h1>
        {subtitle && <p className="page-header-subtitle">{subtitle}</p>}
      </div>
      {action && <div className="page-header-actions">{action}</div>}
    </header>
  );
};

export default PageHeader;
