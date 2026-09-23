import apiClient from './apiClient';

// Phase 26 — Data Export Center.
// Backend: GET /api/export/:dataset returns `text/csv` (see exportController.js).
// Client-side CSV fallback from JSON is kept for resilience (e.g. cached
// JSON responses, proxies that re-encode the body).

export const EXPORT_DATASETS = ['bills', 'patients', 'expenses', 'transactions'];

const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;

// Shared CSV serializer — also reused by Phase 28 (TestUsage export).
export const toCsv = (headers, rows) =>
  ['\uFEFF' + headers.map(esc).join(','), ...rows.map((r) => r.map(esc).join(','))].join('\n');

export const downloadCsvText = (csvText, filename) => {
  const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
};

// Raw fetch that tolerates either text/csv or application/json bodies.
export const fetchExportPayload = async (dataset, { startDate, endDate } = {}) => {
  const response = await apiClient.get(`/export/${dataset}`, {
    params: { startDate, endDate },
    responseType: 'text',
  });
  return { data: response.data, contentType: response.headers?.['content-type'] || '' };
};

// Convert a JSON payload (array or { rows }) into CSV using given headers.
// Rows may be arrays or objects; objects are projected in header order via keys.
export const jsonToCsv = (payload, headers = null) => {
  const list = Array.isArray(payload) ? payload : payload?.rows || payload?.data || [];
  if (!list.length) {
    return toCsv(headers || ['(empty)'], []);
  }
  const cols = headers || Object.keys(list[0] && typeof list[0] === 'object' ? list[0] : { value: '' });
  const rows = list.map((item) =>
    Array.isArray(item) ? item : cols.map((c) => (typeof item === 'object' && item !== null ? item[c] : item))
  );
  return toCsv(cols, rows);
};

const buildFilename = (dataset, startDate, endDate) =>
  `${dataset}_${startDate || 'all'}_${endDate || 'all'}.csv`;

// Real download: prefers the server text/csv body; falls back to client-side
// CSV generation when the body parses as JSON (or when parsing is requested).
export const downloadServerCsv = async (dataset, { startDate, endDate } = {}) => {
  const { data, contentType } = await fetchExportPayload(dataset, { startDate, endDate });
  const filename = buildFilename(dataset, startDate, endDate);
  const looksJson = (contentType || '').includes('json') || (typeof data === 'string' && data.trim().startsWith('{')) || (typeof data === 'string' && data.trim().startsWith('['));
  if (!looksJson && typeof data === 'string' && data.length > 0) {
    downloadCsvText(data.startsWith('\uFEFF') ? data : `\uFEFF${data}`, filename);
    return { source: 'server', filename, bytes: data.length };
  }
  // JSON fallback: parse then serialize client-side with stable column order.
  let parsed = data;
  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      // Unparseable non-CSV body — still save it so the user keeps evidence.
      downloadCsvText(typeof data === 'string' ? data : String(data), filename);
      return { source: 'raw', filename, bytes: String(data).length };
    }
  }
  const csv = jsonToCsv(parsed?.data ?? parsed);
  downloadCsvText(csv, filename);
  const count = Array.isArray(parsed?.data) ? parsed.data.length : Array.isArray(parsed) ? parsed.length : 0;
  return { source: 'client-fallback', filename, bytes: csv.length, rows: count };
};

// Preview count: number of data rows the current window would export.
export const fetchExportPreviewCount = async (dataset, { startDate, endDate } = {}) => {
  const { data, contentType } = await fetchExportPayload(dataset, { startDate, endDate });
  if ((contentType || '').includes('csv') || (typeof data === 'string' && data.includes('\n') && !data.trim().startsWith('{') && !data.trim().startsWith('['))) {
    const lines = data.replace(/^\uFEFF/, '').split('\n').filter((l) => l.trim() !== '');
    return Math.max(0, lines.length - 1); // minus header
  }
  let parsed = data;
  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return 0;
    }
  }
  const list = Array.isArray(parsed) ? parsed : parsed?.data || parsed?.rows || [];
  return Array.isArray(list) ? list.length : 0;
};
