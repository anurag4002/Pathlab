import React from 'react';
import './Search.css';

const SearchResultItem = ({
  icon: Icon,
  iconBg = 'var(--color-primary-light)',
  iconColor = 'var(--color-primary)',
  title,
  subtitle,
  badgeText,
  badgeBg = 'var(--color-border)',
  badgeColor = 'var(--color-text-secondary)',
  isFocused,
  onClick,
  onMouseEnter
}) => {
  return (
    <div
      className={`search-result-item ${isFocused ? 'focused' : ''}`}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      role="option"
      aria-selected={isFocused}
    >
      {Icon && (
        <div className="search-result-icon" style={{ backgroundColor: iconBg, color: iconColor }}>
          <Icon size={16} />
        </div>
      )}
      <div className="search-result-info">
        <div className="search-result-title">{title}</div>
        {subtitle && <div className="search-result-subtitle">{subtitle}</div>}
      </div>
      {badgeText && (
        <span
          style={{
            fontSize: '0.7rem',
            padding: '2px 6px',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: badgeBg,
            color: badgeColor,
            fontWeight: '600'
          }}
        >
          {badgeText}
        </span>
      )}
    </div>
  );
};

export default SearchResultItem;
