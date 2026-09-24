import React, { useState } from 'react';
import { Modal, Button } from '../common';
import { rejectReport } from '../../services/reportService';

// Phase 9 — RejectDialog. Backend LIVE: POST /api/reports/:id/reject.
const RejectDialog = ({ isOpen, onClose, report, onRejected }) => {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const valid = reason.trim().length >= 10;

  if (!isOpen) return null;

  const handleReject = async () => {
    if (!valid || loading) return;
    setLoading(true);
    setError('');
    try {
      const res = await rejectReport(report._id, reason.trim());
      setReason('');
      onRejected?.(res.data || res);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to reject report');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Reject Report — ${report?.registrationNumber || ''}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>Close</Button>
          <Button variant="danger" onClick={handleReject} disabled={!valid} loading={loading}>
            Reject report
          </Button>
        </>
      }
    >
      <div style={{ display: 'grid', gap: 8 }}>
        {error && <p style={{ fontSize: '0.85rem', background: '#fee2e2', border: '1px solid #ef4444', borderRadius: 6, padding: '8px 12px' }}>{error}</p>}
        <label htmlFor="reject-reason" style={{ fontSize: '0.8rem', fontWeight: 600 }}>
          Rejection reason (min 10 characters, required)
        </label>
        <textarea
          id="reject-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={4}
          placeholder="e.g. Haemolysed sample — recollect and resubmit…"
          style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #d1d5db' }}
        />
        {!valid && reason.length > 0 && (
          <span style={{ fontSize: '0.75rem', color: '#b91c1c' }}>Reason must be at least 10 characters.</span>
        )}
      </div>
    </Modal>
  );
};

export default RejectDialog;
