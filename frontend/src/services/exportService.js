import apiClient from './apiClient';
import { downloadBlob } from '../utils/downloadFile';

export const EXPORT_DATASETS = ['bills', 'patients', 'expenses', 'transactions'];

const getHeader = (headers, name) => {
  if (typeof headers?.get === 'function') {
    const headerValue = headers.get(name);
    if (headerValue != null) return headerValue;
  }
  const value = headers?.[name] ?? headers?.[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
};

const getContentDispositionFilename = (header, fallback) => {
  if (typeof header !== 'string' || !header.trim()) return fallback;

  const encodedMatch = header.match(/filename\*\s*=\s*UTF-8''([^;]+)/i);
  if (encodedMatch) {
    try {
      return decodeURIComponent(encodedMatch[1].replace(/^['"]|['"]$/g, '')) || fallback;
    } catch {
      return fallback;
    }
  }

  const quotedMatch = header.match(/filename\s*=\s*"([^"]+)"/i);
  if (quotedMatch) return quotedMatch[1] || fallback;

  const plainMatch = header.match(/filename\s*=\s*([^;]+)/i);
  return plainMatch?.[1]?.trim() || fallback;
};

const parseErrorText = async (data) => {
  if (typeof data === 'string') {
    const withoutBom = data.charCodeAt(0) === 0xFEFF ? data.slice(1) : data;
    const text = withoutBom.trim();
    if (!text || text.startsWith('<')) return '';
    try {
      const parsed = JSON.parse(text);
      return typeof parsed?.message === 'string' ? parsed.message.trim() : '';
    } catch {
      return '';
    }
  }

  if (typeof Blob !== 'undefined' && data instanceof Blob) {
    try {
      return await parseErrorText(await data.text());
    } catch {
      return '';
    }
  }

  if (data && typeof data.message === 'string') return data.message.trim();
  return '';
};

const getStatusMessage = (status) => {
  if (status === 400) return 'The export request is invalid.';
  if (status === 401) return 'Your session has expired. Please log in again.';
  if (status === 403) return 'You do not have permission to export this data.';
  if (status === 404) return 'The requested export resource was not found.';
  if (status === 409) return 'The export data changed elsewhere. Please try again.';
  if (status === 413) return 'The export file is too large.';
  if (status === 422) return 'The selected export range is invalid.';
  if (status === 429) return 'The export request limit was reached. Please try again later.';
  if (status >= 500) return 'The server could not complete the export.';
  return 'The export request failed.';
};

const toExportError = async (error) => {
  if (error?.isExportError) return error;

  const status = error?.response?.status;
  const responseMessage = await parseErrorText(error?.response?.data);
  const statusMessage = status ? getStatusMessage(status) : '';
  const message = responseMessage || statusMessage || error?.message || 'The export request failed.';
  const exportError = new Error(message);
  exportError.status = status;
  exportError.isExportError = true;
  return exportError;
};

const esc = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

export const toCsv = (headers, rows) =>
  ['\uFEFF' + headers.map(esc).join(','), ...rows.map((row) => row.map(esc).join(','))].join('\n');

export const downloadCsvText = (csvText, filename) => {
  const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8' });
  return downloadBlob(blob, filename);
};

const toText = async (data) => {
  if (typeof data === 'string') return data;
  if (typeof Blob !== 'undefined' && data instanceof Blob) return data.text();
  if (data == null) return '';
  return String(data);
};

// Fetch the export as text so both normal CSV responses and JSON fallback
// payloads can be handled by the same client. HTTP errors are normalized here
// for the export center and the daily ledger alike.
export const fetchExportPayload = async (dataset, { startDate, endDate } = {}) => {
  try {
    const response = await apiClient.get(`/export/${dataset}`, {
      params: { startDate, endDate },
      responseType: 'blob'
    });
    return {
      data: await toText(response.data),
      contentType: getHeader(response.headers, 'content-type') || 'text/csv; charset=utf-8',
      headers: response.headers
    };
  } catch (error) {
    throw await toExportError(error);
  }
};

export const jsonToCsv = (payload, headers = null) => {
  const list = Array.isArray(payload) ? payload : payload?.rows || payload?.data || [];
  if (!list.length) return toCsv(headers || ['(empty)'], []);

  const cols = headers || Object.keys(list[0] && typeof list[0] === 'object' ? list[0] : { value: '' });
  const rows = list.map((item) =>
    Array.isArray(item) ? item : cols.map((column) => (typeof item === 'object' && item !== null ? item[column] : item))
  );
  return toCsv(cols, rows);
};

const buildFilename = (dataset, startDate, endDate) =>
  `${dataset}_${startDate || 'all'}_${endDate || 'all'}.csv`;

const isJsonBody = (data, contentType) =>
  /application\/json/i.test(contentType || '') ||
  (typeof data === 'string' && (data.trim().startsWith('{') || data.trim().startsWith('[')));

// Download the server-generated CSV. If a proxy/cache returns JSON instead,
// serialize that payload client-side rather than saving an unusable file.
export const downloadServerCsv = async (dataset, { startDate, endDate } = {}) => {
  const { data, contentType, headers } = await fetchExportPayload(dataset, { startDate, endDate });
  const fallbackFilename = buildFilename(dataset, startDate, endDate);
  const filename = getContentDispositionFilename(
    getHeader(headers, 'content-disposition'),
    fallbackFilename
  );

  if (!isJsonBody(data, contentType)) {
    if (!data) {
      const error = new Error('The export service returned an empty file.');
      error.isExportError = true;
      throw error;
    }
    const csv = data.startsWith('\uFEFF') ? data : `\uFEFF${data}`;
    const downloadedFilename = downloadCsvText(csv, filename);
    return {
      source: 'server',
      filename: downloadedFilename,
      contentType,
      bytes: csv.length
    };
  }

  let parsed = data;
  try {
    parsed = JSON.parse(data);
  } catch {
    // Preserve an unexpected non-CSV body as evidence instead of silently
    // producing a misleading empty CSV.
    const downloadedFilename = downloadCsvText(data, filename);
    return { source: 'raw', filename: downloadedFilename, bytes: data.length };
  }

  const csv = jsonToCsv(parsed?.data ?? parsed);
  const downloadedFilename = downloadCsvText(csv, filename);
  const count = Array.isArray(parsed?.data) ? parsed.data.length : Array.isArray(parsed) ? parsed.length : 0;
  return {
    source: 'client-fallback',
    filename: downloadedFilename,
    bytes: csv.length,
    rows: count
  };
};

// Preview count: number of data rows the current window would export.
export const fetchExportPreviewCount = async (dataset, { startDate, endDate } = {}) => {
  const { data, contentType } = await fetchExportPayload(dataset, { startDate, endDate });
  if (!isJsonBody(data, contentType) && typeof data === 'string' && data.includes('\n')) {
    const lines = data.replace(/^\uFEFF/, '').split('\n').filter((line) => line.trim() !== '');
    return Math.max(0, lines.length - 1);
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
