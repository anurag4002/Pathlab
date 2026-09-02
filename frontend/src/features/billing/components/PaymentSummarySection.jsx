import React from 'react';
import { RefreshCw } from 'lucide-react';
import { Input, Select, Button } from '../../../components/common';
import { PAYMENT_METHODS } from '../../../constants/billConstants';
import formatCurrency from '../../../utils/formatCurrency';
import '../Billing.css';

const PaymentSummarySection = ({
  subtotal,
  discountPercent,
  setDiscountPercent,
  paidAmount,
  setPaidAmount,
  paymentMethod,
  setPaymentMethod,
  remarks,
  setRemarks,
  totalAmount,
  dueAmount,
  errors,
  onSubmit,
  submitting
}) => {
  return (
    <div className="bill-form-card">
      <div
        style={{
          fontWeight: 'var(--font-weight-bold)',
          fontSize: 'var(--font-size-base)',
          borderBottom: '1px solid var(--color-border)',
          paddingBottom: 'var(--space-3)'
        }}
      >
        Payment Details
      </div>

      {/* Subtotal Row */}
      <div className="payment-summary-row">
        <span>Total:</span>
        <strong>{formatCurrency(subtotal)}</strong>
      </div>

      {/* Discount Row */}
      <div className="form-group" style={{ marginBottom: 0 }}>
        <label className="form-label" style={{ fontSize: 'var(--font-size-sm)' }}>
          Discount %
        </label>
        <div style={{ display: 'flex', alignItems: 'stretch' }}>
          <input
            type="number"
            className={`form-control ${errors?.discount ? 'has-error' : ''}`}
            value={discountPercent}
            min={0}
            max={100}
            onChange={(e) =>
              setDiscountPercent(Math.min(100, Math.max(0, Number(e.target.value))))
            }
            placeholder="0"
            style={{ borderRadius: 'var(--radius-sm) 0 0 var(--radius-sm)', flex: 1 }}
          />
          <span
            style={{
              padding: '0 var(--space-3)',
              border: '1px solid var(--color-primary)',
              borderLeft: 'none',
              backgroundColor: 'var(--color-primary)',
              color: 'var(--color-text-inverse)',
              display: 'flex',
              alignItems: 'center',
              fontWeight: 'var(--font-weight-bold)',
              borderRadius: '0 var(--radius-sm) var(--radius-sm) 0',
              fontSize: 'var(--font-size-base)'
            }}
          >
            %
          </span>
        </div>
      </div>

      {/* Amount Received */}
      <Input
        label="Amount Received"
        type="number"
        value={paidAmount}
        onChange={(e) => setPaidAmount(Math.max(0, Number(e.target.value)))}
        placeholder="0"
        error={errors?.paidAmount}
      />

      {/* Balance Row */}
      <div className="payment-summary-row">
        <span>Balance Due:</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <strong
            style={{
              color: dueAmount > 0 ? 'var(--color-danger)' : 'var(--color-success)',
              fontSize: 'var(--font-size-lg)'
            }}
          >
            {formatCurrency(dueAmount)}
          </strong>
          <button
            type="button"
            onClick={() => setPaidAmount(totalAmount)}
            title="Collect full balance"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--color-text-muted)',
              cursor: 'pointer',
              display: 'inline-flex',
              padding: 0
            }}
            aria-label="Set paid amount to full total"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* Payment Mode */}
      <Select
        label="Payment Mode"
        value={paymentMethod}
        onChange={(e) => setPaymentMethod(e.target.value)}
        options={PAYMENT_METHODS.map((m) => ({ value: m, label: m }))}
      />

      {/* Remarks */}
      <Input
        label="Remarks (Optional)"
        value={remarks}
        onChange={(e) => setRemarks(e.target.value)}
        placeholder="Additional remarks..."
      />

      {/* Submit */}
      <Button
        variant="primary"
        block
        onClick={onSubmit}
        loading={submitting}
        disabled={submitting}
        style={{ height: '2.625rem', fontWeight: 'var(--font-weight-bold)' }}
      >
        Create Invoice
      </Button>
    </div>
  );
};

export default PaymentSummarySection;
