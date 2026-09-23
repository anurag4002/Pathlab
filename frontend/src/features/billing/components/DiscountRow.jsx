import React from 'react';
import formatCurrency from '../../../utils/formatCurrency';

// Phase 22 — bill-level discount row with validation display.
// Rule: totalDiscount <= subtotal. Rendered inside the payment summary.
const DiscountRow = ({ subtotal = 0, discountPercent = 0, setDiscountPercent, error }) => {
  const discountAmount = Math.max(0, (Number(subtotal) * Number(discountPercent || 0)) / 100);
  const over = discountAmount > Number(subtotal);
  return (
    <div className="form-group" style={{ marginBottom: 0 }}>
      <label className="form-label" style={{ fontSize: 'var(--font-size-sm)' }}>
        Discount %
      </label>
      <div style={{ display: 'flex', alignItems: 'stretch' }}>
        <input
          type="number"
          className={`form-control ${error || over ? 'has-error' : ''}`}
          value={discountPercent}
          min={0}
          max={100}
          onChange={(e) => setDiscountPercent(Math.min(100, Math.max(0, Number(e.target.value))))}
          placeholder="0"
          style={{ borderRadius: 'var(--radius-sm) 0 0 var(--radius-sm)', flex: 1 }}
          aria-label="Discount percent"
        />
        <span
          style={{
            padding: '0 var(--space-3)', border: '1px solid var(--color-primary)', borderLeft: 'none',
            backgroundColor: 'var(--color-primary)', color: 'var(--color-text-inverse)',
            display: 'flex', alignItems: 'center', fontWeight: 'var(--font-weight-bold)',
            borderRadius: '0 var(--radius-sm) var(--radius-sm) 0', fontSize: 'var(--font-size-base)',
          }}
        >
          %
        </span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginTop: '4px' }}>
        <span style={{ color: 'var(--text-muted)' }}>Discount value: <strong>{formatCurrency(discountAmount)}</strong></span>
        <span style={{ color: 'var(--text-muted)' }}>Net: <strong>{formatCurrency(Math.max(0, subtotal - discountAmount))}</strong></span>
      </div>
      {(error || over) && (
        <p className="form-error">{error || 'Discount cannot exceed the subtotal.'}</p>
      )}
    </div>
  );
};

export default DiscountRow;
