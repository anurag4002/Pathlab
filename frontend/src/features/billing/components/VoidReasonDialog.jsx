import React, { useState, useEffect } from 'react';
import { Modal, Button, Input, Select } from '../../../components/common';

// Phase 17 — void dialog that captures a REAL reason and passes it to
// POST /api/bills/:id/void. Replaces the old hardcoded 'Voided from ledger'.
export const VOID_REASONS = [
  'Duplicate entry',
  'Wrong patient linked',
  'Wrong tests billed',
  'Cancelled by patient',
  'Data entry error',
  'Other',
];

const VoidReasonDialog = ({ isOpen, onClose, bill, onConfirm, loading, error: serverError = '' }) => {
  const [reason, setReason] = useState('');
  const [custom, setCustom] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setReason('');
      setCustom('');
      setError('');
    }
  }, [isOpen]);

  const finalReason = reason === 'Other' ? custom.trim() : reason;

  const handleConfirm = () => {
    if (!finalReason) {
      setError('A void reason is required.');
      return;
    }
    onConfirm(finalReason);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Void this bill?"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleConfirm} loading={loading}>
            Yes, Void
          </Button>
        </>
      }
    >
      <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
        Void invoice <strong>{bill?.billNumber}</strong>? It stays in history as voided with this reason.
      </p>
      <Select
        label="Void reason (required)"
        value={reason}
        onChange={(e) => { setReason(e.target.value); setError(''); }}
        options={VOID_REASONS.map((r) => ({ value: r, label: r }))}
        placeholder="Select a reason"
        required
      />
      {reason === 'Other' && (
        <Input
          label="Describe the reason"
          value={custom}
          onChange={(e) => { setCustom(e.target.value); setError(''); }}
          placeholder="e.g. Billed twice for the same visit"
          required
        />
      )}
      {(error || serverError) && <p className="form-error">{error || serverError}</p>}
    </Modal>
  );
};

export default VoidReasonDialog;
