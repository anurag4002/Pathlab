import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { X } from 'lucide-react';
import Sidebar from './Sidebar';

const MobileSidebar = ({ isOpen, onClose }) => {
  const location = useLocation();

  useEffect(() => {
    // Close mobile sidebar on route transition
    if (isOpen) {
      onClose();
    }
  }, [location.pathname]);

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleEscape);
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="mobile-sidebar-backdrop"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.6)',
        backdropFilter: 'blur(2px)',
        zIndex: 1050,
        display: 'flex'
      }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="mobile-sidebar-drawer"
        style={{
          width: 'var(--sidebar-width, 16.5rem)',
          height: '100%',
          position: 'relative',
          boxShadow: 'var(--shadow-xl)',
          backgroundColor: 'var(--color-surface, #ffffff)',
          display: 'flex',
          flexDirection: 'column'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '0.875rem',
            right: '0.875rem',
            background: 'none',
            border: 'none',
            color: 'var(--color-text-muted, #64748b)',
            cursor: 'pointer',
            zIndex: 1060,
            padding: '0.25rem',
            display: 'flex'
          }}
          aria-label="Close mobile navigation"
        >
          <X size={20} />
        </button>

        <Sidebar collapsed={false} />
      </div>
    </div>
  );
};

export default MobileSidebar;
