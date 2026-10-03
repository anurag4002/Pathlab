import React, { useState, useEffect } from 'react';
import { Modal, Button, Input } from '../../../components/common';

/**
 * Popup for OUTSOURCE LAB: staff types the send-out test name + rate.
 * Line is added to the bill as a Custom item; report side uploads PDF/image.
 */
const OutsourceTestModal = ({ isOpen, onClose, onAdd }) => {
  const [name, setName] = useState('');
  const [rate, setRate] = useState('');
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (isOpen) {
      setName('');
      setRate('');
      setErrors({});
    }
  }, [isOpen]);

  const handleSubmit = (e) => {
    e?.preventDefault();
    const errs = {};
    const trimmed = name.trim();
    const price = Number(rate);
    if (!trimmed) errs.name = 'Test name is required';
    if (rate === '' || isNaN(price) || price < 0) errs.rate = 'Enter a valid rate (₹)';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    onAdd({ name: trimmed, price });
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Outsource Lab Test"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={handleSubmit}>Add to Bill</Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
          Enter the send-out test name and the rate you charge. It is added to this bill as-is.
          Later, upload the external PDF/image on Today&apos;s Reports — no result entry needed.
        </p>
        <Input
          label="Test name"
          name="outsourceName"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={errors.name}
          placeholder="e.g. Histopathology / Special Marker"
          required
          autoFocus
        />
        <Input
          label="Rate (₹)"
          name="outsourceRate"
          type="number"
          min="0"
          step="any"
          value={rate}
          onChange={(e) => setRate(e.target.value)}
          error={errors.rate}
          placeholder="0.00"
          required
        />
      </form>
    </Modal>
  );
};

export default OutsourceTestModal;
