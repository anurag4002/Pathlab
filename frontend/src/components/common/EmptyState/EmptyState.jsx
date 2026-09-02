import React from 'react';
import { Inbox } from 'lucide-react';
import './EmptyState.css';

const EmptyState = ({
  icon: Icon = Inbox,
  title = 'No records found',
  message = 'There is no data matching your query.',
  action,
  className = ''
}) => {
  return (
    <div className={`empty-state ${className}`}>
      <Icon size={44} className="empty-state-icon" />
      {title && <h3 className="empty-state-title">{title}</h3>}
      {message && <p className="empty-state-description">{message}</p>}
      {action && <div className="empty-state-action">{action}</div>}
    </div>
  );
};

export default EmptyState;
