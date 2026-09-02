import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import MobileSidebar from './MobileSidebar';

const AppLayout = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const toggleCollapsed = () => {
    if (window.innerWidth <= 1024) {
      setMobileOpen((prev) => !prev);
    } else {
      setCollapsed((prev) => !prev);
    }
  };

  return (
    <div className="app-container">
      {/* Desktop Sidebar */}
      <div className="no-print">
        <Sidebar collapsed={collapsed} />
      </div>

      {/* Mobile Drawer Sidebar */}
      <div className="no-print">
        <MobileSidebar isOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
      </div>

      {/* Main Content Area */}
      <div className={`main-content ${collapsed ? 'collapsed' : ''}`}>
        <div className="no-print">
          <Header collapsed={collapsed} toggleCollapsed={toggleCollapsed} />
        </div>
        <main className="page-container">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AppLayout;
