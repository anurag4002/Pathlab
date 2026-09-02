import React, { useRef } from 'react';
import './Search.css';

const SearchOverlay = ({ isOpen, onClose, children }) => {
  const panelRef = useRef(null);

  if (!isOpen) return null;

  return (
    <div
      className="search-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div ref={panelRef} className="search-panel">
        {children}
        <div className="search-footer-hints">
          <span>Use <strong>↑↓</strong> to navigate, <strong>Enter</strong> to select</span>
          <span>Press <strong>ESC</strong> to dismiss</span>
        </div>
      </div>
    </div>
  );
};

export default SearchOverlay;
