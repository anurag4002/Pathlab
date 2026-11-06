import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import MobileSidebar from './MobileSidebar';
import { preloadBusyScreens } from '../../routes/preloadScreens';

const MOBILE_BREAKPOINT = 1024;

const AppLayout = () => {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const closeMobile = useCallback(() => setMobileOpen(false), []);

  // Fetch the busiest screens' code while the browser is idle after sign-in.
  useEffect(() => {
    const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 1500));
    const handle = idle(() => preloadBusyScreens());
    return () => (window.cancelIdleCallback ? window.cancelIdleCallback(handle) : clearTimeout(handle));
  }, []);

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
            {/* The sidebar and header stay while a screen's code loads. */}
            <Suspense fallback={<div className="route-loading" role="status" aria-label="Loading" />}>
              <Outlet />
            </Suspense>
          </div>
        </main>
      </div>
    </div>
  );
};

export default AppLayout;
