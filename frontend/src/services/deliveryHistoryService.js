const KEY = 'ppl_delivery_history_v1';
const MAX_ENTRIES = 500;

const readAll = () => {
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
};

const writeAll = (list) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX_ENTRIES)));
  } catch {
    /* storage full / unavailable — history is best-effort */
  }
};

// Local stand-in until GET /api/reports/:id/delivery-status exists.
// Entry: { id, reportId, regNo, channel, to, status: 'sent'|'failed', error, at }
export const recordDeliveryAttempt = (entry) => {
  const list = readAll();
  list.unshift({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    at: new Date().toISOString(),
    status: 'sent',
    ...entry,
  });
  writeAll(list);
  return list;
};

export const getDeliveryHistory = (reportId) => {
  if (!reportId) return readAll();
  return readAll().filter((e) => e.reportId === reportId);
};

export const getFailedDeliveries = () => readAll().filter((e) => e.status === 'failed');

export const clearDeliveryHistory = () => {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
};

// Derive a per-report badge status from local history.
export const getReportDeliveryStatus = (reportId) => {
  const history = getDeliveryHistory(reportId);
  if (!history.length) return 'unsent';
  if (history.some((h) => h.status === 'sent')) return history[0].status === 'failed' ? 'partial' : 'sent';
  return 'failed';
};
