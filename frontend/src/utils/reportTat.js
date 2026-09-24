import { formatDuration } from './formatDate';

/* Report TAT helpers — presentation-only views over the backend Report's
   `tat` timestamps (registered / collected / received / reported) and status
   enum. Nothing here is business logic: values are never persisted and
   missing/invalid timestamps degrade safely to '—'. */

/* Statuses where turnaround time is still running (no reported timestamp). */
const OPEN_STATUSES = [
  'Pending',
  'Registered',
  'Draft',
  'Collected',
  'Received',
  'Reported'
];

export const toValidDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return isNaN(date.getTime()) ? null : date;
};

/* Registered → reported once reported; registered → now while the case is
   still open; '—' otherwise (e.g. a terminal status without a reported
   timestamp, or no usable timestamps at all). */
export const formatReportTat = (report) => {
  const registeredAt = toValidDate(report?.tat?.registered);
  const reportedAt = toValidDate(report?.tat?.reported);
  if (registeredAt && reportedAt) return formatDuration(registeredAt, reportedAt);
  if (registeredAt && OPEN_STATUSES.includes(report?.status)) {
    return formatDuration(registeredAt);
  }
  return '—';
};

/* True when a registered timestamp exists, nothing has been reported yet,
   and the backend status says the case is still in flight. */
export const isTatOpen = (report) =>
  Boolean(toValidDate(report?.tat?.registered)) &&
  !toValidDate(report?.tat?.reported) &&
  OPEN_STATUSES.includes(report?.status);
