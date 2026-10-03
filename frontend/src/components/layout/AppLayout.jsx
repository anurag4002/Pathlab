import React, { useState, useEffect, useCallback } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import MobileSidebar from './MobileSidebar';

const MOBILE_BREAKPOINT = 1024;

const AppLayout = () => {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const closeMobile = useCallback(() => setMobileOpen(false), []);

  const toggleCollapsed = () => {
    if (window.innerWidth <= MOBILE_BREAKPOINT) {
      setMobileOpen((prev) => {
        const next = !prev;
        if (next) {
          window.dispatchEvent(new CustomEvent('app:overlay', { detail: 'mobile-nav' }));
        }
        return next;
      });
    } else {
      setCollapsed((prev) => !prev);
    }
  };

  // Only one overlay drawer at a time (search ↔ mobile nav)
  useEffect(() => {
    const onOverlay = (e) => {
      if (e.detail === 'search') {
        setMobileOpen(false);
      }
    };
    window.addEventListener('app:overlay', onOverlay);
    return () => window.removeEventListener('app:overlay', onOverlay);
  }, []);

  // Keep layout sane across breakpoint changes
  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth > MOBILE_BREAKPOINT) {
        setMobileOpen(false);
      }
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return (
    <div className="app-container">
      {/* Desktop Sidebar */}
      <div className="no-print desktop-sidebar-slot">
        <Sidebar collapsed={collapsed} />
      </div>

      {/* Mobile Drawer Sidebar */}
      <div className="no-print">
        <MobileSidebar isOpen={mobileOpen} onClose={closeMobile} />
      </div>

      {/* Main Content Area */}
      <div className={`main-content ${collapsed ? 'collapsed' : ''}`}>
        <div className="no-print">
          <Header collapsed={collapsed} toggleCollapsed={toggleCollapsed} />
        </div>
        <main className="page-container">
          <div key={location.pathname} className="page-transition">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default AppLayout;
