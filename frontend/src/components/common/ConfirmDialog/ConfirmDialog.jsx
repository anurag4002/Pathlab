import React from 'react';
import Modal from '../Modal/Modal';
import Button from '../Button/Button';

const ConfirmDialog = ({
  isOpen,
  onClose,
  onConfirm,
  title = 'Are you sure?',
  message = 'This action cannot be undone.',
  confirmText = 'Yes, Delete',
  cancelText = 'Cancel',
  confirmVariant = 'danger',
  loading = false
}) => {
  const footer = (
    <>
      <Button variant="secondary" onClick={onClose} disabled={loading}>
        {cancelText}
      </Button>
      <Button variant={confirmVariant} onClick={onConfirm} loading={loading}>
        {confirmText}
      </Button>
    </>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} footer={footer} size="md">
      <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', margin: 0 }}>
        {message}
      </p>
    </Modal>
  );
};

export default ConfirmDialog;
