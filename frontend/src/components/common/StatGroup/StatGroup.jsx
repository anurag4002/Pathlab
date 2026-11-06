import React from 'react';
import { Link } from 'react-router-dom';
import './StatGroup.css';

/**
 * Key figures in one bordered card with dividers (new look): sentence-case
 * label over the value, optional muted hint. A tile with `to` is a link.
 * items: [{ label, value, hint?, to?, tone?: 'warning' | 'danger' | 'good' }]
 */
export default function StatGroup({ items = [], loading = false, label = 'Key figures' }) {
  const shown = items.filter(Boolean);
  return (
    <section className="stat-group" aria-label={label} aria-busy={loading || undefined} style={{ '--stat-cols': Math.min(shown.length, 6) || 1 }}>
      {shown.map((item) => {
        const body = (
          <>
            <span className="stat-group-label">{item.label}</span>
            <span className={`stat-group-value${item.tone ? ` is-${item.tone}` : ''}`}>{loading ? <span className="stat-group-skeleton" /> : item.value}</span>
            {item.hint && <span className="stat-group-hint">{item.hint}</span>}
          </>
        );
        return item.to
          ? <Link key={item.label} to={item.to} className="stat-group-item is-link">{body}</Link>
          : <div key={item.label} className="stat-group-item">{body}</div>;
      })}
    </section>
  );
}
