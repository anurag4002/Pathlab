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
  FlaskConical,
  Star,
  Plus,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import useAuth from '../../hooks/useAuth';
import { SIDEBAR_NAV_ITEMS } from '../../constants/navigationConstants';
import { Receipt, FileText, ClipboardCheck, ShieldCheck, Users, Wallet } from 'lucide-react';
import { useUiVersion } from '../../utils/uiVersion';

// New look: the screens used all day, one click away above the sections.
const DAILY_WORK = [
  { path: '/cases/bills', label: 'Bills', icon: Receipt },
  { path: '/lab/reports', label: "Today's reports", icon: FileText },
  { path: '/lab/result-entry', label: 'Result entry', icon: ClipboardCheck },
  { path: '/lab/verification', label: 'Verification', icon: ShieldCheck },
  { path: '/cases/patients', label: 'Patients', icon: Users },
  { path: '/business/dues', label: 'Dues', icon: Wallet },
];
import usePendingResultCount from '../../hooks/usePendingResultCount';
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
  Stethoscope,
  FlaskConical,
  Star
};

const Sidebar = ({ collapsed = false, variant = 'desktop' }) => {
  // Cases waiting for results, shown on Lab > Result Entry.
  const pendingResults = usePendingResultCount();
  const countFor = (path) => (path === '/lab/result-entry' ? pendingResults : 0);
  const childCount = (item) => (item.children || []).reduce((sum, child) => sum + countFor(child.path), 0);
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

  // Daily-work links the user may open (same roles as the menu entries).
  const isV2 = useUiVersion() === 'v2';
  const allChildren = SIDEBAR_NAV_ITEMS.flatMap((item) => (item.children ? item.children.map((child) => ({ ...child, parentRoles: item.roles })) : [item]));
  const dailyWork = isV2 ? DAILY_WORK.filter((entry) => {
    const source = allChildren.find((child) => child.path === entry.path);
    return source && hasAccess(source) && (!source.parentRoles || !source.parentRoles.length || (user && source.parentRoles.includes(user.role)));
  }) : [];

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
          title="New bill (Ctrl+B)"
        >
          <Plus size={18} />
          {!isIconRail && <span>New bill</span>}
          {!isIconRail && <kbd className="sidebar-new-bill-kbd">Ctrl B</kbd>}
        </NavLink>
      </div>

      {/* Nav List */}
      <nav className="sidebar-nav" ref={navRef}>
        {dailyWork.length > 0 && (
          <div className="sidebar-section" aria-label="Daily work">
            {!isIconRail && <div className="sidebar-section-label">Daily work</div>}
            {dailyWork.map(({ path, label, icon: Icon }) => (
              <NavLink key={path} to={path} title={isIconRail ? label : undefined}
                className={({ isActive }) => `sidebar-link sidebar-daily-link${isActive ? ' active' : ''}`}>
                <Icon size={18} aria-hidden="true" />
                {!isIconRail && <span>{label}</span>}
                {!isIconRail && countFor(path) > 0 && <span className="sidebar-count" aria-label={`${countFor(path)} waiting`}>{countFor(path)}</span>}
              </NavLink>
            ))}
            {!isIconRail && <div className="sidebar-section-label">All sections</div>}
          </div>
        )}
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
                    className={`sidebar-submenu-header ${isParentActive || showFlyout ? 'active' : ''} ${isExpanded ? 'open' : ''}`}
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
                      {!isExpanded && childCount(item) > 0 && <span className="sidebar-count" aria-label={`${childCount(item)} waiting`}>{childCount(item)}</span>}
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
                          {(isV2 && child.v2Title) || child.title}
                          {countFor(child.path) > 0 && <span className="sidebar-count" aria-label={`${countFor(child.path)} waiting`}>{countFor(child.path)}</span>}
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
                          {(isV2 && child.v2Title) || child.title}
                          {countFor(child.path) > 0 && <span className="sidebar-count" aria-label={`${countFor(child.path)} waiting`}>{countFor(child.path)}</span>}
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
