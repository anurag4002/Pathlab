import React from 'react';
import { StatusBadge } from '../common';

// Phase 7 — per-report delivery status. Statuses: unsent | sending | sent |
// failed | partial (sent once, latest attempt failed). Local-history backed
// until GET /api/reports/:id/delivery-status exists on the backend.
const LABELS = {
  unsent: 'Not sent',
  sending: 'Sending…',
  sent: 'Sent',
  failed: 'Failed',
  partial: 'Sent (last retry failed)',
};

const VARIANTS = {
  unsent: 'neutral',
  sending: 'warning',
  sent: 'success',
  failed: 'danger',
  partial: 'warning',
};

const DeliveryStatusBadge = ({ status = 'unsent' }) => (
  <StatusBadge status={LABELS[status] || status} variant={VARIANTS[status] || 'neutral'} />
);

export default DeliveryStatusBadge;
