import React, { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import formatCurrency from '../../../utils/formatCurrency';

// New look: pick the tests in a panel or package - search, tick, and see
// what is chosen (with what those tests cost on their own).
export default function TestChecklist({ tests = [], selected = [], onToggle, error, price }) {
  const [query, setQuery] = useState('');
  const byId = useMemo(() => new Map(tests.map((t) => [String(t._id), t])), [tests]);
  const chosen = selected.map((id) => byId.get(String(id))).filter(Boolean);
  const separate = chosen.reduce((sum, t) => sum + (Number(t.price) || 0), 0);
  const q = query.trim().toLowerCase();
  const list = q ? tests.filter((t) => `${t.name} ${t.code || ''}`.toLowerCase().includes(q)) : tests;
  const saving = Number(price) > 0 && separate > 0 ? separate - Number(price) : 0;
  return (
    <div className="form-group ls-pick">
      <div className="ls-pick-head">
        <label className="form-label" htmlFor="ls-pick-search">Tests included</label>
        <span className="ls-pick-sum">
          {chosen.length} chosen{separate > 0 ? ` · ${formatCurrency(separate)} if done separately` : ''}
          {saving > 0 ? <b> · patient saves {formatCurrency(saving)}</b> : null}
        </span>
      </div>
      {chosen.length > 0 && (
        <div className="ls-chips">
          {chosen.map((t) => (
            <span key={t._id} className="ls-chip">
              {t.name}
              <button type="button" aria-label={`Remove ${t.name}`} onClick={() => onToggle(t._id)}><X size={12} /></button>
            </span>
          ))}
        </div>
      )}
      <input id="ls-pick-search" type="search" className="form-control" placeholder="Type to find a test by name or code" value={query} onChange={(e) => setQuery(e.target.value)} />
      <div className="ls-pick-list" role="group" aria-label="Tests">
        {list.length === 0 && <p className="muted" style={{ margin: 0, padding: '0.5rem' }}>No test matches "{query}".</p>}
        {list.map((t) => {
          const on = selected.map(String).includes(String(t._id));
          return (
            <label key={t._id} className={`ls-pick-item${on ? ' is-on' : ''}`}>
              <input type="checkbox" checked={on} onChange={() => onToggle(t._id)} />
              <span className="ls-pick-name">{t.name}{t.code ? <small> {t.code}</small> : null}</span>
              <span className="ls-pick-price">{formatCurrency(t.price)}</span>
            </label>
          );
        })}
      </div>
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}
