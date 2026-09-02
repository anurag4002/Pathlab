import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  FilePlus,
  LayoutDashboard,
  TrendingUp,
  FolderOpen,
  Activity,
  Radio,
  Layers,
  Settings,
  Plus,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import useAuth from '../../hooks/useAuth';
import { SIDEBAR_NAV_ITEMS } from '../../constants/navigationConstants';
import './Sidebar.css';

const ICON_MAP = {
  FilePlus,
  LayoutDashboard,
  TrendingUp,
  FolderOpen,
  Activity,
  Radio,
  Layers,
  Settings
};

const Sidebar = ({ collapsed = false }) => {
  const { user } = useAuth();
  const location = useLocation();
  const [expandedMenus, setExpandedMenus] = useState({});

  const toggleSubmenu = (title) => {
    setExpandedMenus((prev) => ({
      ...prev,
      [title]: !prev[title]
    }));
  };

  const hasAccess = (item) => {
    if (!item.roles || item.roles.length === 0) return true;
    return user && item.roles.includes(user.role);
  };

  const renderIcon = (iconName) => {
    const IconComponent = ICON_MAP[iconName] || Activity;
    return <IconComponent size={20} aria-hidden="true" />;
  };

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`} aria-label="Main Navigation">
      {/* Brand Logo Header */}
      <div className="sidebar-logo-wrapper">
        <img
          src="/logo.jpg"
          alt="Pure Path Lab Logo"
          className="sidebar-logo-img"
        />
        {!collapsed && <span className="sidebar-logo-text">PURE PATH LAB</span>}
      </div>

      {/* Standalone New Bill CTA */}
      <div className="sidebar-action-container">
        <NavLink
          to="/cases/bills/new"
          className="sidebar-new-bill-btn"
          title="Create New Bill"
        >
          <Plus size={18} />
          {!collapsed && <span>New bill</span>}
        </NavLink>
      </div>

      {/* Nav List */}
      <nav className="sidebar-nav">
        {SIDEBAR_NAV_ITEMS.filter(hasAccess)
          .filter((item) => item.title !== 'New Bill')
          .map((item) => {
            const isParentActive =
              item.children && item.children.some((child) => location.pathname === child.path);

            if (item.children) {
              const isExpanded = expandedMenus[item.title] || isParentActive;

              return (
                <div key={item.title}>
                  <div
                    className={`sidebar-submenu-header ${isParentActive ? 'active' : ''}`}
                    onClick={() => toggleSubmenu(item.title)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggleSubmenu(item.title);
                      }
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                      {renderIcon(item.icon)}
                      {!collapsed && <span>{item.title}</span>}
                    </div>
                    {!collapsed &&
                      (isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />)}
                  </div>

                  {isExpanded && !collapsed && (
                    <div className="sidebar-submenu-list">
                      {item.children.filter(hasAccess).map((child) => (
                        <NavLink
                          key={child.title}
                          to={child.path}
                          className={({ isActive }) =>
                            `sidebar-submenu-link ${isActive ? 'active' : ''}`
                          }
                        >
                          {child.title}
                        </NavLink>
                      ))}
                    </div>
                  )}
                </div>
              );
            }

            return (
              <NavLink
                key={item.title}
                to={item.path}
                className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
              >
                {renderIcon(item.icon)}
                {!collapsed && <span>{item.title}</span>}
              </NavLink>
            );
          })}
      </nav>
    </aside>
  );
};

export default Sidebar;
