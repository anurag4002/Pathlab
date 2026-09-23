import React from 'react';
import './Pagination.css';

const Pagination = ({ page, pages, total, limit, onPageChange, onLimitChange, pageSizeOptions = [10, 20, 50], className = '' }) => {
  const startIdx = (page - 1) * limit + 1;
  const endIdx = Math.min(page * limit, total);

  const getPageNumbers = () => {
    const numbers = [];
    const maxVisible = 5;
    let start = Math.max(1, page - 2);
    let end = Math.min(pages, start + maxVisible - 1);

    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }

    for (let i = start; i <= end; i++) {
      numbers.push(i);
    }
    return numbers;
  };

  return (
    <nav className={`pagination-container ${className}`} aria-label="Table navigation">
      <div className="pagination-info">
        Showing <strong>{total === 0 ? 0 : startIdx}</strong> to <strong>{endIdx}</strong> of{' '}
        <strong>{total}</strong> entries
        {onLimitChange && (
          <label className="pagination-size">
            Rows
            <select
              value={limit}
              onChange={(e) => onLimitChange(Number(e.target.value))}
              aria-label="Rows per page"
            >
              {pageSizeOptions.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </label>
        )}
      </div>
      <div className="pagination-buttons">
        <button
          type="button"
          className="pagination-btn"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
        >
          Prev
        </button>
        {getPageNumbers().map((num) => (
          <button
            key={num}
            type="button"
            className={`pagination-btn ${page === num ? 'active' : ''}`}
            onClick={() => onPageChange(num)}
            aria-current={page === num ? 'page' : undefined}
          >
            {num}
          </button>
        ))}
        <button
          type="button"
          className="pagination-btn"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= pages}
          aria-label="Next page"
        >
          Next
        </button>
      </div>
    </nav>
  );
};

export default Pagination;
