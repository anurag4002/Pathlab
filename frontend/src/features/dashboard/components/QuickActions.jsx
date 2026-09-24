import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FilePlus,
  UserPlus,
  PlusCircle,
  Radio,
  FileEdit,
  TrendingUp,
  BarChart3,
  Upload,
  ChevronRight
} from 'lucide-react';
import { QUICK_ACTIONS } from '../../../constants/dashboardConstants';
import useAuth from '../../../hooks/useAuth';
import '../Dashboard.css';

const ICON_MAP = {
  FilePlus,
  UserPlus,
  PlusCircle,
  Radio,
  FileEdit,
  TrendingUp,
  BarChart3,
  Upload
};

const QuickActions = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const userActions = QUICK_ACTIONS.filter(
    (action) => !action.roles || action.roles.includes(user?.role)
  );

  return (
    <div className="dashboard-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
      <div>
        <h2 className="dashboard-card-title">Quick Actions</h2>
        <div className="quick-actions-list">
          {userActions.map((action) => {
            const Icon = ICON_MAP[action.icon] || FilePlus;
            return (
              <button
                type="button"
                key={action.label}
                className="quick-action-item"
                onClick={() => navigate(action.path)}
              >
                <div className="quick-action-item-left">
                  <div className="quick-action-icon-wrap" aria-hidden="true">
                    <Icon size={18} />
                  </div>
                  <div>
                    <div className="quick-action-label">{action.label}</div>
                    <div className="quick-action-desc">{action.description}</div>
                  </div>
                </div>
                <ChevronRight size={14} style={{ color: 'var(--color-text-muted)' }} />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default QuickActions;
