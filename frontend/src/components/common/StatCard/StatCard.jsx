import React from 'react';
import './StatCard.css';

const StatCard = ({
  title,
  value,
  icon: Icon,
  color = 'var(--color-primary)',
  bgColor = 'var(--color-primary-light)',
  trend,
  trendPositive = true,
  className = ''
}) => {
  return (
    <div className={`stat-card ${className}`}>
      <div className="stat-card-info">
        <span className="stat-card-title">{title}</span>
        <span className="stat-card-value">{value}</span>
        {trend && (
          <span className={`stat-card-trend ${trendPositive ? 'positive' : 'negative'}`}>
            {trend}
          </span>
        )}
      </div>
      {Icon && (
        <div
          className="stat-card-icon-box"
          style={{ color, backgroundColor: bgColor }}
          aria-hidden="true"
        >
          <Icon size={22} />
        </div>
      )}
    </div>
  );
};

export default StatCard;
