import React from 'react';
import LoadingSpinner from '../common/LoadingSpinner/LoadingSpinner';
import './Search.css';

const SearchResults = ({
  loading,
  query,
  children,
  isEmpty,
  emptyMessage
}) => {
  return (
    <div className="search-results-list" role="listbox">
      {loading && <LoadingSpinner label="Searching..." size={1.25} />}

      {!loading && query.trim().length > 0 && isEmpty && (
        <div style={{ padding: '2rem var(--space-4)', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
          {emptyMessage || `No matching results for "${query}".`}
        </div>
      )}

      {!loading && query.trim().length === 0 && (
        <div style={{ padding: '1.5rem var(--space-4)', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)' }}>
          Type a patient name, phone number, or invoice reference...
        </div>
      )}

      {!loading && !isEmpty && children}
    </div>
  );
};

export default SearchResults;
