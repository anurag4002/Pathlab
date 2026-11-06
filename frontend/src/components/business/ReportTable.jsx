import React, { useState } from 'react';

// A plain report table (new look): clear headers, money right-aligned, a
// totals row, and "Show all" instead of page numbers for long lists.
// columns: [{ key, label, align?: 'right', render?: (row) => node, className? }]
export default function ReportTable({ columns = [], rows = [], totals = null, empty = 'Nothing here for this period.', loading = false, rowKey = (row, i) => row._id || i, limit = 50, onRowClick, caption }) {
  const [showAll, setShowAll] = useState(false);
  const shown = showAll ? rows : rows.slice(0, limit);
  return (
    <div className="biz-table-wrap">
      <table className="biz-table">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr>{columns.map((c) => <th key={c.key} className={c.align === 'right' ? 'r' : undefined} scope="col">{c.label}</th>)}</tr>
        </thead>
        <tbody>
          {loading && !rows.length ? (
            [0, 1, 2].map((i) => <tr key={`s${i}`} className="biz-skeleton">{columns.map((c) => <td key={c.key}><span /></td>)}</tr>)
          ) : rows.length === 0 ? (
            <tr><td colSpan={columns.length} className="biz-empty">{empty}</td></tr>
          ) : shown.map((row, i) => (
            <tr key={rowKey(row, i)} className={onRowClick ? 'is-clickable' : undefined} onClick={onRowClick ? () => onRowClick(row) : undefined}>
              {columns.map((c) => (
                <td key={c.key} data-label={c.label} className={[c.align === 'right' ? 'r' : '', c.className || ''].join(' ').trim() || undefined}>
                  {c.render ? c.render(row) : row[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {totals && rows.length > 0 && (
          <tfoot>
            <tr>{columns.map((c, i) => <td key={c.key} className={c.align === 'right' ? 'r' : undefined}>{totals[c.key] ?? (i === 0 ? 'Total' : '')}</td>)}</tr>
          </tfoot>
        )}
      </table>
      {rows.length > limit && (
        <button type="button" className="biz-show-all" onClick={() => setShowAll((v) => !v)}>
          {showAll ? 'Show fewer' : `Show all ${rows.length}`}
        </button>
      )}
    </div>
  );
}
