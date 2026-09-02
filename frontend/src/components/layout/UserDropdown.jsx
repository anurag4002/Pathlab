import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, LogOut } from 'lucide-react';
import useAuth from '../../hooks/useAuth';
import './Header.css';

const UserDropdown = () => {
  const { user, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
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
          <span className="user-role">{user.role}</span>
        </div>
        <ChevronDown size={14} style={{ color: 'var(--color-text-muted)' }} />
      </button>

      {isOpen && (
        <div className="user-dropdown-menu" role="menu">
          <div className="user-dropdown-header">
            Signed in as: <strong>{user.email}</strong>
          </div>
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
