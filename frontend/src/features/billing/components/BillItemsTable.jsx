import React from 'react';
import { Trash2 } from 'lucide-react';
import formatCurrency from '../../../utils/formatCurrency';
import '../Billing.css';

const itemLabels = { Test: 'Test', TestPanel: 'Panel', TestPackage: 'Package', Custom: 'Custom item' };
const displayName = item => String(item.name || 'Item').replace(/\s*\(bundle\)\s*$/i, '').trim();

const BillItemsTable = ({ items = [], onRemove, error }) => {
  return (
    <div>
      <div
        style={{
          fontWeight: 'var(--font-weight-bold)',
          fontSize: 'var(--font-size-base)',
          borderBottom: '1px solid var(--color-border)',
          paddingBottom: 'var(--space-3)',
          marginBottom: 'var(--space-3)'
        }}
      >
        Selected Test Lines
      </div>

      {error && (
        <p className="form-error" style={{ marginBottom: 'var(--space-2)' }}>
          {error}
        </p>
      )}

      <div className="bill-items-list">
        {items.length === 0 ? (
          <p
            style={{
              fontSize: 'var(--font-size-sm)',
              color: 'var(--color-text-muted)',
              textAlign: 'center',
              marginTop: 'var(--space-6)'
            }}
          >
            No tests or packages selected yet.
          </p>
        ) : (
          <table className="bill-items-table">
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>Item Name</th>
                <th style={{ textAlign: 'right' }}>Price</th>
                <th style={{ textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={idx}>
                  <td>
                    <span className="bill-item-name">{displayName(item)}</span>
                    <span className="bill-item-type">
                      {itemLabels[item.itemType] || 'Item'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 'var(--font-weight-semibold)' }}>
                    {formatCurrency(item.price)}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <button
                      type="button"
                      onClick={() => onRemove(idx)}
                      className="bill-item-remove"
                      aria-label={`Remove ${displayName(item)}`}
                      title={`Remove ${displayName(item)} from this bill`}
                    >
                      <Trash2 size={16} aria-hidden="true" /> Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default BillItemsTable;
