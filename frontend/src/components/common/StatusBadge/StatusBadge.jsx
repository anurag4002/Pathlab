import React from 'react';
import './StatusBadge.css';

const getVariant = (status) => {
  const s = String(status || '').toLowerCase();
  switch (s) {
    case 'paid':
    case 'active':
    case 'completed':
    case 'cleared':
    case 'cash':
    case 'upi':
      return 'success';
    case 'partial':
    case 'card':
    case 'inprogress':
    case 'doctor':
      return 'warning';
    case 'pending':
    case 'inactive':
    case 'due':
    case 'refund':
    case 'cancelled':
      return 'danger';
    case 'admin':
    case 'employee':
    case 'insurance':
      return 'info';
    default:
      return 'neutral';
  }
};

const StatusBadge = ({ status, variant, className = '' }) => {
  if (!status) return null;
  const badgeVariant = variant || getVariant(status);

  return (
    <span className={`status-badge status-badge-${badgeVariant} ${className}`}>
      {status}
    </span>
  );
};

export default StatusBadge;
