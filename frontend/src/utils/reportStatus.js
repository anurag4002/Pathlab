// Client-side display-only status extension (Phase 3+9).
//
// Backend reality (verified): Report.status enum is
// ['Pending','Registered','Collected','Received','Reported','Signed','Completed'].
// 'Verified' / 'Rejected' / 'Draft' do NOT exist server-side — the backend
// verify/reject/comments/resend endpoints do NOT exist either. This module
// only maps labels/colours for display; it never invents a persisted status.

export const BACKEND_STATUSES = [
  'Pending',
  'Registered',
  'Collected',
  'Received',
  'Reported',
  'Signed',
  'Completed',
];

// Display-only extension. 'Verified' / 'Rejected' render only if a report
// ever carries them (e.g. future backend); the UI must NOT write them.
export const DISPLAY_STATUSES = [...BACKEND_STATUSES, 'Verified', 'Rejected'];

export const isBackendStatus = (status) => BACKEND_STATUSES.includes(status);

export const isSignedStatus = (status) => status === 'Signed' || status === 'Completed';

export const getReportStatusLabel = (status) => {
  if (!status) return '—';
  // Pass through; Verified/Rejected are display-only until backend lands.
  return status;
};

// Maps a status to a StatusBadge variant (display only, no backend effect).
export const getReportStatusVariant = (status) => {
  switch (String(status || '').toLowerCase()) {
    case 'completed':
    case 'signed':
    case 'verified':
      return 'success';
    case 'reported':
    case 'received':
      return 'info';
    case 'registered':
    case 'collected':
      return 'warning';
    case 'rejected':
    case 'pending':
      return 'danger';
    default:
      return 'neutral';
  }
};
