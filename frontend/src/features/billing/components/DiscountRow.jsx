import React from 'react';
import formatCurrency from '../../../utils/formatCurrency';

// Bill-level discount row with % / amount toggle.
// Inputs stay blank by default (no zero); empty is treated as 0 in totals.
const DiscountRow = ({
  subtotal = 0,
  discountMode = 'percent',
  setDiscountMode,
  discountPercent = '',
  setDiscountPercent,
  discountValue = '',
  setDiscountValue,
  error
}) => {
  const sub = Number(subtotal) || 0;
  const isPercent = discountMode !== 'amount';
  const percentNum = discountPercent === '' || discountPercent === null ? 0 : Number(discountPercent);
  const amountNum = discountValue === '' || discountValue === null ? 0 : Number(discountValue);
  const discountAmount = isPercent
    ? Math.max(0, (sub * (percentNum || 0)) / 100)
    : Math.max(0, Math.min(sub, amountNum || 0));
  const over = discountAmount > sub;

  const toggleMode = () => {
    setDiscountMode?.(isPercent ? 'amount' : 'percent');
  };

  const onPercentChange = (e) => {
    const raw = e.target.value;
    if (raw === '') {
      setDiscountPercent?.('');
      return;
    }
    const n = Number(raw);
    if (Number.isNaN(n)) return;
    setDiscountPercent?.(Math.min(100, Math.max(0, n)));
  };

  const onAmountChange = (e) => {
    const raw = e.target.value;
    if (raw === '') {
      setDiscountValue?.('');
      return;
    }
    const n = Number(raw);
    if (Number.isNaN(n)) return;
    setDiscountValue?.(Math.max(0, n));
  };

  return (
    <div className="form-group" style={{ marginBottom: 0 }}>
      <label className="form-label" style={{ fontSize: 'var(--font-size-sm)' }}>
        Discount {isPercent ? '%' : 'amount'}
      </label>
      <div style={{ display: 'flex', alignItems: 'stretch' }}>
        {isPercent ? (
          <input
            type="number"
            className={`form-control ${error || over ? 'has-error' : ''}`}
            value={discountPercent}
            min={0}
            max={100}
            onChange={onPercentChange}
            placeholder=""
            style={{ borderRadius: 'var(--radius-sm) 0 0 var(--radius-sm)', flex: 1 }}
            aria-label="Discount percent"
          />
        ) : (
          <input
            type="number"
            className={`form-control ${error || over ? 'has-error' : ''}`}
            value={discountValue}
            min={0}
            max={sub || undefined}
            onChange={onAmountChange}
            placeholder=""
            style={{ borderRadius: 'var(--radius-sm) 0 0 var(--radius-sm)', flex: 1 }}
            aria-label="Discount amount"
          />
        )}
        <button
          type="button"
          onClick={toggleMode}
          title={isPercent ? 'Switch to flat amount (₹)' : 'Switch to percent (%)'}
          aria-label={isPercent ? 'Switch discount to amount mode' : 'Switch discount to percent mode'}
          style={{
            padding: '0 var(--space-3)', border: '1px solid var(--color-primary)', borderLeft: 'none',
            backgroundColor: 'var(--color-primary)', color: 'var(--color-text-inverse)',
            display: 'flex', alignItems: 'center', fontWeight: 'var(--font-weight-bold)',
            borderRadius: '0 var(--radius-sm) var(--radius-sm) 0', fontSize: 'var(--font-size-base)',
            cursor: 'pointer'
          }}
        >
          {isPercent ? '%' : '₹'}
        </button>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginTop: '4px' }}>
        <span style={{ color: 'var(--text-muted)' }}>Discount value: <strong>{formatCurrency(discountAmount)}</strong></span>
        <span style={{ color: 'var(--text-muted)' }}>Net: <strong>{formatCurrency(Math.max(0, sub - discountAmount))}</strong></span>
      </div>
      {(error || over) && (
        <p className="form-error">{error || 'Discount cannot exceed the subtotal.'}</p>
      )}
    </div>
  );
};

export default DiscountRow;
