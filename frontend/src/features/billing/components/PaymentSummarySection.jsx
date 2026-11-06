import React from 'react';
import { useUiVersion } from '../../../utils/uiVersion';
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
  submitHint = '',
  collectionCentreOptions = [],
  collectionCentre,
  setCollectionCentre,
  adminOverride,
  setAdminOverride
}) => {
  // Enter in any payment field (discount, amount received, payment mode)
  // creates the invoice - works everywhere, even where an editor's built-in
  // browser or a keyboard tool takes the Ctrl / Alt shortcuts.
  const onFieldEnter = (event) => {
    if (event.key !== 'Enter' || event.shiftKey || event.ctrlKey || event.altKey || event.metaKey || event.nativeEvent?.isComposing) return;
    if (!event.target.matches?.('input, select')) return;
    if (submitting) return;
    event.preventDefault();
    onSubmit();
  };

  // New look: discount is rare - hidden behind "+ Add discount" unless used.
  const isV2 = useUiVersion() === 'v2';
  const [showDiscount, setShowDiscount] = React.useState(false);
  const discountInUse = Number(discountPercent) > 0 || Number(discountValue) > 0;

  // New look, new bill: one tidy payment bar. Every cell is a label on top
  // and a 40px value or field below, so everything lines up in one row.
  if (isV2 && !isEditMode) {
    const sub = Number(subtotal) || 0;
    const isPercent = discountMode !== 'amount';
    const discountShown = showDiscount || discountInUse || !!errors?.discount;
    const setDiscount = (raw) => {
      if (raw === '') { (isPercent ? setDiscountPercent : setDiscountValue)?.(''); return; }
      const n = Number(raw);
      if (Number.isNaN(n)) return;
      if (isPercent) setDiscountPercent?.(Math.min(100, Math.max(0, n)));
      else setDiscountValue?.(Math.max(0, n));
    };
    const discountAmount = isPercent ? (sub * (Number(discountPercent) || 0)) / 100 : Number(discountValue) || 0;
    const discountError = errors?.discount || (discountAmount > sub && sub > 0 ? 'More than the total' : '');
    return (
      <div className="bill-form-card bill-pay" onKeyDown={onFieldEnter}>
        <div className="pay-cell">
          <span className="pay-label">{discountShown && discountAmount > 0 ? 'Total after discount' : 'Total'}</span>
          <span className="pay-value pay-value--total">{formatCurrency(totalAmount)}</span>
        </div>

        <div className="pay-cell">
          <span className="pay-label">Discount</span>
          {discountShown ? (
            <div className="pay-control pay-discount">
              <input type="number" min={0} className={`form-control${discountError ? ' has-error' : ''}`} autoFocus={showDiscount && !discountInUse}
                value={isPercent ? discountPercent : discountValue} onChange={(e) => setDiscount(e.target.value)}
                aria-label={isPercent ? 'Discount percent' : 'Discount amount'} placeholder="0" />
              <div className="pay-discount-mode" role="group" aria-label="Discount in">
                <button type="button" className={isPercent ? 'is-on' : ''} aria-pressed={isPercent} onClick={() => setDiscountMode?.('percent')}>%</button>
                <button type="button" className={!isPercent ? 'is-on' : ''} aria-pressed={!isPercent} onClick={() => setDiscountMode?.('amount')}>₹</button>
              </div>
            </div>
          ) : (
            <button type="button" className="pay-control pay-add-discount" onClick={() => setShowDiscount(true)}>+ Add</button>
          )}
          {discountError && <span className="pay-error" role="alert">{discountError}</span>}
        </div>

        <div className="pay-cell">
          <label className="pay-label" htmlFor="bill-amount-received">Amount received now</label>
          <div className="pay-control pay-amount">
            <span aria-hidden="true">₹</span>
            <input id="bill-amount-received" type="number" min={0} className={`form-control${errors?.paidAmount ? ' has-error' : ''}`}
              value={paidAmount} placeholder="0" onChange={(e) => setPaidAmount(Math.max(0, Number(e.target.value)))} />
          </div>
          {errors?.paidAmount && <span className="pay-error" role="alert">{errors.paidAmount}</span>}
        </div>

        <div className="pay-cell">
          <label className="pay-label" htmlFor="bill-paid-by">Paid by</label>
          <select id="bill-paid-by" className="form-control pay-control" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
            {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>

        <div className="pay-cell">
          <span className="pay-label">Still to pay</span>
          <span className="pay-value-row">
            <span className={`pay-value ${dueAmount > 0 ? 'is-due' : totalAmount > 0 ? 'is-clear' : ''}`}>{formatCurrency(dueAmount)}</span>
            {dueAmount > 0 && (
              <button type="button" className="pay-full" onClick={() => setPaidAmount(totalAmount)} title="Patient pays the full amount">Paid in full</button>
            )}
          </span>
        </div>

        <div className="pay-cell pay-cell--action">
          <Button variant="primary" onClick={onSubmit} loading={submitting} disabled={submitting}
            title={submitHint ? `${submitLabel} (Enter in Amount received, or ${submitHint})` : undefined}>
            {submitLabel}{submitHint && <kbd className="pay-kbd">{submitHint.replace('+', ' ')}</kbd>}
          </Button>
        </div>
      </div>
    );
  }
  return (
    <div className={`bill-form-card${isV2 ? ' bill-pay' : ''}`} onKeyDown={onFieldEnter}>
      <div
        className="bill-pay-title"
        style={{
          fontWeight: 'var(--font-weight-bold)',
          fontSize: 'var(--font-size-base)',
          borderBottom: '1px solid var(--color-border)',
          paddingBottom: 'var(--space-3)'
        }}
      >
        {isV2 ? 'Payment' : 'Payment Details'}
      </div>

      {/* Subtotal Row */}
      <div className="payment-summary-row">
        <span>{isV2 ? 'Total' : 'Total:'}</span>
        <strong>{formatCurrency(subtotal)}</strong>
      </div>

      {/* Discount Row (Phase 22 — DiscountRow with %/amount toggle + subtotal validation) */}
      {isV2 && !showDiscount && !discountInUse && !errors?.discount ? (
        <button type="button" className="bill-add-discount" onClick={() => setShowDiscount(true)}>+ Add discount</button>
      ) : (
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
      )}

      {/* Amount Received */}
      <Input
        label={isEditMode ? 'Amount Received (locked — use Pay / Refund)' : isV2 ? 'Amount received now' : 'Amount Received'}
        type="number"
        value={paidAmount}
        onChange={(e) => !isEditMode && setPaidAmount(Math.max(0, Number(e.target.value)))}
        placeholder="0"
        error={errors?.paidAmount}
        disabled={isEditMode}
      />

      {/* Balance Row */}
      <div className="payment-summary-row">
        <span>{isV2 ? 'Still to pay' : 'Balance Due:'}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <strong
            className={`balance-due${totalAmount > 0 ? '' : ' is-empty'}`}
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
        label={isV2 ? 'Paid by' : 'Payment Mode'}
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
        title={submitHint ? `${submitLabel} (${submitHint})` : undefined}
        style={{ height: '2.625rem', fontWeight: 'var(--font-weight-bold)' }}
      >
        {submitLabel}
      </Button>
      {submitHint && <p className="bill-submit-hint">or press <kbd>Enter</kbd> in {isV2 ? 'Amount received' : 'Amount Received'} · {submitHint.split('+').map((key, i) => <React.Fragment key={key}>{i > 0 && '+'}<kbd>{key}</kbd></React.Fragment>)} anywhere</p>}
    </div>
  );
};

export default PaymentSummarySection;
