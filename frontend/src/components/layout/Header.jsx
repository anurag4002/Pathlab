import React from 'react';
import { Menu } from 'lucide-react';
import GlobalSearch from '../search/GlobalSearch';
import UserDropdown from './UserDropdown';
import './Header.css';

const Header = ({ collapsed, toggleCollapsed }) => {
  return (
    <header className={`header ${collapsed ? 'collapsed' : ''}`}>
      <div className="header-left">
        <button
          type="button"
          className="header-toggle-btn"
          onClick={toggleCollapsed}
          aria-label="Toggle navigation sidebar"
        >
          <Menu size={20} />
        </button>

        <div className="header-brand" aria-label="Pure Path Lab">
          <img src="/logo.jpg" alt="" className="header-logo-img" width={32} height={32} />
          <span className="header-logo-text">PURE PATH LAB</span>
        </div>

        <GlobalSearch />
      </div>

      <div className="header-right">
        <UserDropdown />
      </div>
    </header>
  );
};

export default Header;
