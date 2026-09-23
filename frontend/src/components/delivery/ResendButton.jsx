import React from 'react';
import { RotateCcw } from 'lucide-react';
import { Button } from '../common';

// Phase 7 — retry a failed send. On click the parent re-issues
// POST /api/notify/send with the original payload.
const ResendButton = ({ onResend, loading = false, disabled = false, size = 'sm' }) => (
  <Button variant="secondary" size={size} onClick={onResend} loading={loading} disabled={disabled}>
    <RotateCcw size={14} /> Resend
  </Button>
);

export default ResendButton;
