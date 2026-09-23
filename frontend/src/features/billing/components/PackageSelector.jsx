import React, { useState, useEffect } from 'react';
import { getPanels } from '../../../services/panelService';
import { getPackages } from '../../../services/packageService';
import formatCurrency from '../../../utils/formatCurrency';

// Phase 22 — package/panel selector wired to real server data.
// Previously the billing page received `packages` but never fetched them
// (getPanels dead code). This component fetches BOTH panels
// (GET /tests/panels) and packages (GET /tests/packages) and lets the
// caller add the selection as bill items at package pricing.
const normalizeList = (res) => {
  if (!res) return [];
  if (Array.isArray(res)) return res;
  const d = res.data ?? res;
  if (Array.isArray(d)) return d;
  if (Array.isArray(d?.packages)) return d.packages;
  if (Array.isArray(d?.panels)) return d.panels;
  return [];
};

const PackageSelector = ({ onSelect, selectedIds = [] }) => {
  const [tab, setTab] = useState('packages');
  const [packages, setPackages] = useState([]);
  const [panels, setPanels] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const [pkgRes, panelRes] = await Promise.all([
          getPackages().catch(() => null),
          getPanels().catch(() => null),
        ]);
        if (!cancelled) {
          setPackages(normalizeList(pkgRes));
          setPanels(normalizeList(panelRes));
        }
      } catch (e) {
        if (!cancelled) setError('Failed to load packages/panels');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const list = tab === 'packages' ? packages : panels;
  const active = list.filter((p) => (p.status || 'Active') === 'Active');

  return (
    <div>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
        {['packages', 'panels'].map((t) => (
          <button
            key={t}
            type="button"
            className={`btn ${tab === t ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '4px 12px', fontSize: '0.78rem', textTransform: 'capitalize' }}
            onClick={() => setTab(t)}
          >
            {t} ({t === 'packages' ? packages.length : panels.length})
          </button>
        ))}
      </div>
      {loading && <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Loading {tab}…</p>}
      {error && <p className="form-error">{error}</p>}
      {!loading && !error && active.length === 0 && (
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No active {tab} found.</p>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '220px', overflowY: 'auto' }}>
        {active.map((p) => {
          const id = p._id;
          const already = selectedIds.includes(id);
          const testCount = Array.isArray(p.includedTests) ? p.includedTests.length
            : Array.isArray(p.tests) ? p.tests.length : 0;
          return (
            <div
              key={id}
              role="button"
              tabIndex={0}
              onClick={() => !already && onSelect?.(p, tab)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !already) onSelect?.(p, tab); }}
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '8px 10px', border: '1px solid var(--border-color)',
                borderRadius: '6px', cursor: already ? 'default' : 'pointer',
                opacity: already ? 0.55 : 1, background: 'var(--bg-card)',
              }}
            >
              <span style={{ fontSize: '0.83rem' }}>
                <strong>{p.name}</strong>
                <span style={{ color: 'var(--text-muted)' }}> · {testCount} tests · {p.gender || 'All'}</span>
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <strong style={{ color: 'var(--color-primary)' }}>{formatCurrency(p.price || 0)}</strong>
                {already && <span style={{ fontSize: '0.72rem', color: 'var(--color-success)' }}>Added</span>}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PackageSelector;
