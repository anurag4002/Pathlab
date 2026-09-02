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
        <GlobalSearch />
      </div>

      <div className="header-right">
        <UserDropdown />
      </div>
    </header>
  );
};

export default Header;
