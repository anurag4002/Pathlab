import React, { forwardRef } from 'react';
import { Search, X } from 'lucide-react';
import './Search.css';

const SearchInput = forwardRef(({ value, onChange, onKeyDown, onClose, placeholder = 'Search patients, bills, reports...' }, ref) => {
  return (
    <div className="search-input-header">
      <Search size={18} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} aria-hidden="true" />
      <input
        ref={ref}
        type="text"
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        className="search-input-field"
        autoFocus
      />
      <button
        type="button"
        onClick={onClose}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', display: 'flex', padding: '2px' }}
        aria-label="Close search"
      >
        <X size={18} />
      </button>
    </div>
  );
});

SearchInput.displayName = 'SearchInput';

export default SearchInput;
