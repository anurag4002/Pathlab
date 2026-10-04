import React from 'react';
import { RefreshCw } from 'lucide-react';
import { Input, Select, Button } from '../../../components/common';
import { PAYMENT_METHODS } from '../../../constants/billConstants';
import formatCurrency from '../../../utils/formatCurrency';
import DiscountRow from './DiscountRow';
import '../Billing.css';

const PaymentSummarySection = ({
  subtotal,
  discountMode,
  setDiscountMode,
  discountPercent,
  setDiscountPercent,
  discountValue,
  setDiscountValue,
  paidAmount,
  setPaidAmount,
  paymentMethod,
  setPaymentMethod,
  totalAmount,
  dueAmount,
  errors,
  onSubmit,
  submitting,
  // Edit mode: paid stays locked (Pay/Refund flows own it), submit relabelled,
  // plus collection-centre + admin-override controls for bill edits.
  isEditMode = false,
  submitLabel = 'Create Invoice',
  collectionCentreOptions = [],
  collectionCentre,
  setCollectionCentre,
  adminOverride,
  setAdminOverride
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

      {/* Discount Row (Phase 22 — DiscountRow with %/amount toggle + subtotal validation) */}
      <DiscountRow
        subtotal={subtotal}
        discountMode={discountMode}
        setDiscountMode={setDiscountMode}
        discountPercent={discountPercent}
        setDiscountPercent={setDiscountPercent}
        discountValue={discountValue}
        setDiscountValue={setDiscountValue}
        error={errors?.discount}
      />

      {/* Amount Received */}
      <Input
        label={isEditMode ? 'Amount Received (locked — use Pay / Refund)' : 'Amount Received'}
        type="number"
        value={paidAmount}
        onChange={(e) => !isEditMode && setPaidAmount(Math.max(0, Number(e.target.value)))}
        placeholder="0"
        error={errors?.paidAmount}
        disabled={isEditMode}
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

      {/* Collection centre + admin override (bill edits only) */}
      {isEditMode && setCollectionCentre && (
        <Select
          label="Collection centre"
          value={collectionCentre}
          onChange={(e) => setCollectionCentre(e.target.value)}
          options={collectionCentreOptions}
          required
        />
      )}
      {isEditMode && setAdminOverride && (
        <label style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '0.875rem' }}>
          <input
            type="checkbox"
            checked={!!adminOverride}
            onChange={(e) => setAdminOverride(e.target.checked)}
          />
          Admin override (allow editing Paid / locked bill)
        </label>
      )}

      {/* Submit */}
      <Button
        variant="primary"
        block
        onClick={onSubmit}
        loading={submitting}
        disabled={submitting}
        style={{ height: '2.625rem', fontWeight: 'var(--font-weight-bold)' }}
      >
        {submitLabel}
      </Button>
    </div>
  );
};

export default PaymentSummarySection;
