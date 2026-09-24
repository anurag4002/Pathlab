const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return 'N/A';

  return date.toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

/* Presentation-only elapsed-time formatter (TAT display), e.g. "2h 35m".
   `to` may be omitted for an ongoing case (measured to now at render time).
   Returns '—' for missing/invalid endpoints. Purely a display calculation —
   nothing derived here is ever persisted. */
export const formatDuration = (from, to) => {
  const hasFrom = from !== null && from !== undefined && from !== '';
  const hasTo = to !== null && to !== undefined && to !== '';
  const start = hasFrom ? new Date(from) : null;
  const end = hasTo ? new Date(to) : new Date();
  if (!start || isNaN(start.getTime()) || isNaN(end.getTime())) return '—';

  const totalMinutes = Math.max(
    0,
    Math.floor((end.getTime() - start.getTime()) / 60000)
  );
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return '<1m';
};

export default formatDate;
