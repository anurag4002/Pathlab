import React, { useState, useEffect, useRef } from 'react';
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
  Stethoscope,
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
  Settings,
  Stethoscope
};

const Sidebar = ({ collapsed = false, variant = 'desktop' }) => {
  const { user } = useAuth();
  const location = useLocation();
  const [expandedMenu, setExpandedMenu] = useState(null);
  const [flyoutMenu, setFlyoutMenu] = useState(null);
  const navRef = useRef(null);
  const isDrawer = variant === 'drawer';
  const isIconRail = collapsed && !isDrawer;

  // Keep the active parent open (accordion — only one at a time)
  useEffect(() => {
    const activeParent = SIDEBAR_NAV_ITEMS.find((item) =>
      item.children?.some(
        (child) =>
          location.pathname === child.path ||
          location.pathname.startsWith(`${child.path}/`)
      )
    );
    if (activeParent && !isIconRail) {
      setExpandedMenu(activeParent.title);
    }
    setFlyoutMenu(null);
  }, [location.pathname, isIconRail]);

  // Close collapsed flyout on outside click
  useEffect(() => {
    if (!flyoutMenu) return undefined;
    const handleOutside = (e) => {
      if (navRef.current && !navRef.current.contains(e.target)) {
        setFlyoutMenu(null);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [flyoutMenu]);

  const toggleSubmenu = (title) => {
    if (isIconRail) {
      setFlyoutMenu((prev) => (prev === title ? null : title));
      return;
    }
    setFlyoutMenu(null);
    setExpandedMenu((prev) => (prev === title ? null : title));
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
    <aside
      className={`sidebar ${isIconRail ? 'collapsed' : ''} ${isDrawer ? 'sidebar--drawer' : ''}`}
      aria-label="Main Navigation"
    >
      {/* Brand Logo Header */}
      <div className="sidebar-logo-wrapper">
        <img
          src="/logo.jpg"
          alt="Pure Path Lab Logo"
          className="sidebar-logo-img"
          width={40}
          height={40}
        />
        {!isIconRail && <span className="sidebar-logo-text">PURE PATH LAB</span>}
      </div>

      {/* Standalone New Bill CTA */}
      <div className="sidebar-action-container">
        <NavLink
          to="/cases/bills/new"
          className="sidebar-new-bill-btn"
          title="Create New Bill"
        >
          <Plus size={18} />
          {!isIconRail && <span>New bill</span>}
        </NavLink>
      </div>

      {/* Nav List */}
      <nav className="sidebar-nav" ref={navRef}>
        {SIDEBAR_NAV_ITEMS.filter(hasAccess)
          .filter((item) => item.title !== 'New Bill')
          .map((item) => {
            const isParentActive =
              item.children &&
              item.children.some(
                (child) =>
                  location.pathname === child.path ||
                  location.pathname.startsWith(`${child.path}/`)
              );

            if (item.children) {
              const isExpanded = !isIconRail && expandedMenu === item.title;
              const showFlyout = isIconRail && flyoutMenu === item.title;

              return (
                <div key={item.title} className="sidebar-submenu">
                  <div
                    className={`sidebar-submenu-header ${isParentActive || showFlyout ? 'active' : ''}`}
                    onClick={() => toggleSubmenu(item.title)}
                    role="button"
                    tabIndex={0}
                    aria-expanded={isIconRail ? showFlyout : isExpanded}
                    title={isIconRail ? item.title : undefined}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggleSubmenu(item.title);
                      }
                    }}
                  >
                    <div className="sidebar-submenu-header-left">
                      {renderIcon(item.icon)}
                      {!isIconRail && <span>{item.title}</span>}
                    </div>
                    {!isIconRail &&
                      (isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />)}
                  </div>

                  {isExpanded && (
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

                  {showFlyout && (
                    <div className="sidebar-flyout" role="menu">
                      <div className="sidebar-flyout-title">{item.title}</div>
                      {item.children.filter(hasAccess).map((child) => (
                        <NavLink
                          key={child.title}
                          to={child.path}
                          className={({ isActive }) =>
                            `sidebar-flyout-link ${isActive ? 'active' : ''}`
                          }
                          role="menuitem"
                          onClick={() => setFlyoutMenu(null)}
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
                title={isIconRail ? item.title : undefined}
              >
                {renderIcon(item.icon)}
                {!isIconRail && <span>{item.title}</span>}
              </NavLink>
            );
          })}
      </nav>
    </aside>
  );
};

export default Sidebar;
