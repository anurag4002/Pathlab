import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { X } from 'lucide-react';
import Sidebar from './Sidebar';
import './MobileSidebar.css';

const MobileSidebar = ({ isOpen, onClose }) => {
  const location = useLocation();

  useEffect(() => {
    if (isOpen) onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- close only on route change
  }, [location.pathname]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose();
    };

    const root = document.documentElement;
    root.classList.add('mobile-nav-open');
    window.addEventListener('keydown', handleEscape);

    return () => {
      root.classList.remove('mobile-nav-open');
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="mobile-sidebar-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Navigation menu"
    >
      <div className="mobile-sidebar-drawer" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="mobile-sidebar-close"
          onClick={onClose}
          aria-label="Close mobile navigation"
        >
          <X size={20} />
        </button>
        <Sidebar collapsed={false} variant="drawer" />
      </div>
    </div>,
    document.body
  );
};

export default MobileSidebar;
