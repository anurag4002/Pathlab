import React from 'react';
import { Trash2 } from 'lucide-react';
import formatCurrency from '../../../utils/formatCurrency';
import '../Billing.css';

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

      <div style={{ minHeight: '7.5rem', maxHeight: '12.5rem', overflowY: 'auto' }}>
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
                <th style={{ textAlign: 'center' }}></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={idx}>
                  <td>
                    {item.name}{' '}
                    <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)' }}>
                      ({item.itemType})
                    </span>
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 'var(--font-weight-semibold)' }}>
                    {formatCurrency(item.price)}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <button
                      type="button"
                      onClick={() => onRemove(idx)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--color-danger)',
                        cursor: 'pointer',
                        padding: 'var(--space-1)',
                        display: 'inline-flex'
                      }}
                      aria-label={`Remove ${item.name}`}
                    >
                      <Trash2 size={14} />
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
