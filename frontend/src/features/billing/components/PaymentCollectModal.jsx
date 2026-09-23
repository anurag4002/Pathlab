import React from 'react';
import { Modal, Input, Select, Button } from '../../../components/common';
import { PAYMENT_METHODS } from '../../../constants/billConstants';
import formatCurrency from '../../../utils/formatCurrency';

const PaymentCollectModal = ({
  isOpen,
  onClose,
  bill,
  paymentAmount,
  setPaymentAmount,
  paymentMethod,
  setPaymentMethod,
  onSubmit,
  loading,
  error
}) => {
  if (!bill) return null;

  const footer = (
    <>
      <Button variant="secondary" onClick={onClose} disabled={loading}>
        Cancel
      </Button>
      <Button variant="primary" onClick={onSubmit} loading={loading}>
        Log Payment
      </Button>
    </>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Collect Outstanding Balance"
      footer={footer}
      size="md"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', margin: 0 }}>
          Invoice: <strong>{bill.billNumber}</strong> &nbsp;|&nbsp; Remaining Due:{' '}
          <strong style={{ color: 'var(--color-danger)' }}>{formatCurrency(bill.dueAmount)}</strong>
        </p>
        <Input
          label="Payment Amount Received"
          type="number"
          value={paymentAmount}
          onChange={(e) =>
            setPaymentAmount(Math.max(0, Math.min(Number(e.target.value), bill.dueAmount)))
          }
          required
        />
        <Select
          label="Payment Method"
          value={paymentMethod}
          onChange={(e) => setPaymentMethod(e.target.value)}
          options={PAYMENT_METHODS.map((m) => ({ value: m, label: m }))}
          required
        />
        {error && <p className="form-error" style={{ margin: 0 }}>{error}</p>}
      </div>
    </Modal>
  );
};

export default PaymentCollectModal;
