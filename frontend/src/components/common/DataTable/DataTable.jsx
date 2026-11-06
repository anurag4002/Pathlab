import React from 'react';

// Give every cell its column name (data-label) so the new look can show a
// row as a labelled card on phones without each screen doing it.
const headerText = (header) => (typeof header === 'string' ? header : typeof header?.props?.children === 'string' ? header.props.children : '');
function withCellLabels(row, headers) {
  if (!React.isValidElement(row) || row.type !== 'tr') return row;
  let column = 0;
  const cells = React.Children.map(row.props.children, (cell) => {
    if (!React.isValidElement(cell) || (cell.type !== 'td' && cell.type !== 'th')) return cell;
    const label = headerText(headers[column]);
    column += Number(cell.props.colSpan) || 1;
    return cell.props['data-label'] !== undefined || !label ? cell : React.cloneElement(cell, { 'data-label': label });
  });
  return React.cloneElement(row, {}, cells);
}
import { Search } from 'lucide-react';
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
  // Refreshing keeps the current rows (dimmed, thin progress bar) instead of
  // swapping them for a spinner, so the list never flashes after a payment,
  // filter or page change. Only the very first load shows placeholder rows.
  const refreshing = loading && data.length > 0;

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
              {!searchValue && <kbd className="data-table-search-kbd" title="Press / to jump here">/</kbd>}
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
        className={`data-table-wrapper${maxHeight ? ' scrollable' : ''}${refreshing ? ' is-refreshing' : ''}`}
        aria-busy={loading || undefined}
        style={maxHeight ? { maxHeight } : undefined}
      >
        <table className={`data-table${dense ? ' dense' : ''}${stickyActions ? ' sticky-actions' : ''} data-table--cards`}>
          <thead>
            <tr>
              {headers.map((h, i) => (
                <th key={i}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && !refreshing ? (
              Array.from({ length: 5 }, (_, row) => (
                <tr key={`skeleton-${row}`} className="data-table-skeleton" aria-hidden="true">
                  {headers.map((_, cell) => <td key={cell}><span style={{ width: `${45 + ((row * 7 + cell * 13) % 45)}%` }} /></td>)}
                </tr>
              ))
            ) : data.length === 0 ? (
              <tr className="data-table-empty-row">
                <td colSpan={headers.length}>
                  <EmptyState title={emptyTitle} message={emptyMessage} />
                </td>
              </tr>
            ) : (
              data.map((item, index) => withCellLabels(renderRow(item, index), headers))
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
