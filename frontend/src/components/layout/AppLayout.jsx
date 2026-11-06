import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import MobileSidebar from './MobileSidebar';
import { preloadBusyScreens } from '../../routes/preloadScreens';
import { applyUiVersion } from '../../utils/uiVersion';

const MOBILE_BREAKPOINT = 1024;

const AppLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const closeMobile = useCallback(() => setMobileOpen(false), []);

  // The UI choice is per user: re-apply after sign-in / user switch.
  useEffect(() => { applyUiVersion(); }, []);

  // "/" jumps to the search box of the current screen (as in Gmail/GitHub),
  // unless the user is already typing somewhere.
  useEffect(() => {
    const onKey = (event) => {
      if (!['/', '?'].includes(event.key) || event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target;
      if (target.closest?.('input, textarea, select, [contenteditable="true"], [role="dialog"]')) return;
      // "?" opens the list of keyboard shortcuts.
      if (event.key === '?') { event.preventDefault(); navigate('/shortcuts'); return; }
      event.preventDefault();
      // The screen's own search box, most specific first. Screens without one
      // (Dashboard, Result Entry, Verification ...) open the global search.
      const usable = (input) => input && !input.disabled && !input.readOnly && input.offsetParent !== null;
      const box = ['main [data-page-search]', 'main input[type="search"]', 'main .data-table-search-input', 'main input[data-filter-text]']
        .map((selector) => [...document.querySelectorAll(selector)].find(usable))
        .find(Boolean);
      if (!box) { document.querySelector('.search-trigger')?.click(); return; }
      const rect = box.getBoundingClientRect();
      if (rect.top < 64 || rect.bottom > window.innerHeight) box.scrollIntoView({ block: 'center', behavior: 'smooth' });
      box.focus({ preventScroll: true });
      box.select?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate]);

  // Ctrl+B anywhere opens a New bill. On the New bill form itself the form
  // handles Ctrl+B first (creates the invoice) and stops it reaching here.
  useEffect(() => {
    const onKey = (event) => {
      const ctrl = event.ctrlKey || event.metaKey;
      if (!ctrl || event.shiftKey || event.altKey || !(event.code === 'KeyB' || String(event.key).toLowerCase() === 'b')) return;
      if (event.defaultPrevented || event.repeat || document.querySelector('[role="dialog"]')) return;
      if (/^\/cases\/bills\/(new|edit\/)/.test(window.location.pathname)) return;
      event.preventDefault();
      navigate('/cases/bills/new');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate]);

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
