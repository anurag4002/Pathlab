import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronDown, Keyboard, LogOut, Sparkles } from 'lucide-react';
import { setUiVersion, useUiVersion } from '../../utils/uiVersion';
import useAuth from '../../hooks/useAuth';
import './Header.css';

const UserDropdown = () => {
  const { user, logout } = useAuth();
  const uiVersion = useUiVersion();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    const handleOverlay = () => setIsOpen(false);
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      window.addEventListener('app:overlay', handleOverlay);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      window.removeEventListener('app:overlay', handleOverlay);
    };
  }, [isOpen]);

  if (!user) return null;

  const initials = user.name
    ? user.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : 'U';

  const handleLogout = async () => {
    if (window.confirm('Are you sure you want to sign out?')) {
      await logout();
    }
  };

  return (
    <div className="user-menu-wrapper" ref={dropdownRef}>
      <button
        type="button"
        className="user-menu-trigger"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <div className="user-avatar" aria-hidden="true">
          {initials}
        </div>
        <div className="user-meta">
          <span className="user-name">{user.name}</span>
          <span className="user-role">{user.role}{user?.branch?.name ? ` · ${user.branch.name}` : ''}</span>
        </div>
        <ChevronDown size={14} style={{ color: 'var(--color-text-muted)' }} />
      </button>

      {isOpen && (
        <div className="user-dropdown-menu" role="menu">
          <div className="user-dropdown-header">
            Signed in as: <strong>{user.email}</strong>
          </div>
          {/* Classic / New look switch (per user on this browser) */}
          <button type="button" className="user-dropdown-item" role="menuitemcheckbox" aria-checked={uiVersion === 'v2'}
            onClick={() => setUiVersion(uiVersion === 'v2' ? 'classic' : 'v2')}>
            <Sparkles size={16} />
            <span>New look</span>
            <span className={`ui-switch${uiVersion === 'v2' ? ' is-on' : ''}`} aria-hidden="true"><span /></span>
          </button>
          <Link to="/shortcuts" className="user-dropdown-item" role="menuitem" onClick={() => setIsOpen(false)}>
            <Keyboard size={16} />
            <span>Keyboard shortcuts</span>
            <kbd className="user-dropdown-kbd">?</kbd>
          </Link>
          <button
            type="button"
            className="user-dropdown-item danger"
            onClick={handleLogout}
            role="menuitem"
          >
            <LogOut size={16} />
            <span>Sign Out</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default UserDropdown;
