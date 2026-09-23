import React from 'react';
import { Search } from 'lucide-react';
import LoadingSpinner from '../LoadingSpinner/LoadingSpinner';
import EmptyState from '../EmptyState/EmptyState';
import Pagination from '../Pagination/Pagination';
import './DataTable.css';

const DataTable = ({
  headers = [],
  data = [],
  loading = false,
  emptyTitle,
  emptyMessage = 'No records found.',
  searchPlaceholder = 'Search...',
  searchValue = '',
  onSearchChange,
  pagination, // { total, page, limit, pages, onPageChange }
  renderRow,  // (item, index) => JSX
  toolbarActions,
  maxHeight, // e.g. 420 — bounded scroll body with sticky header
  dense = false, // compact cell padding for wide action tables
  stickyActions = false, // freeze the last (actions) column on horizontal scroll
  className = ''
}) => {
  const showToolbar = Boolean(onSearchChange || toolbarActions);

  return (
    <div className={`data-table-container ${className}`}>
      {showToolbar && (
        <div className="data-table-toolbar">
          {onSearchChange ? (
            <div className="data-table-search">
              <Search size={16} className="data-table-search-icon" aria-hidden="true" />
              <input
                type="text"
                placeholder={searchPlaceholder}
                value={searchValue}
                onChange={onSearchChange}
                className="data-table-search-input"
                aria-label="Filter table records"
              />
            </div>
          ) : (
            <div />
          )}
          {toolbarActions && (
            <div className="data-table-toolbar-actions">{toolbarActions}</div>
          )}
        </div>
      )}

      <div
        className={`data-table-wrapper${maxHeight ? ' scrollable' : ''}`}
        style={maxHeight ? { maxHeight } : undefined}
      >
        <table className={`data-table${dense ? ' dense' : ''}${stickyActions ? ' sticky-actions' : ''}`}>
          <thead>
            <tr>
              {headers.map((h, i) => (
                <th key={i}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={headers.length}>
                  <LoadingSpinner label="Fetching records..." />
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={headers.length}>
                  <EmptyState title={emptyTitle} message={emptyMessage} />
                </td>
              </tr>
            ) : (
              data.map((item, index) => renderRow(item, index))
            )}
          </tbody>
        </table>
      </div>

      {pagination && pagination.pages > 1 && (
        <Pagination
          page={pagination.page}
          pages={pagination.pages}
          total={pagination.total}
          limit={pagination.limit}
          onPageChange={pagination.onPageChange}
          onLimitChange={pagination.onLimitChange}
        />
      )}
    </div>
  );
};

export default DataTable;
