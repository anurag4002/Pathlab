import apiClient from './apiClient';
import { downloadBlob } from '../utils/downloadFile';

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

// Server-side CSV export (bills|patients|expenses|transactions) with the
// backend's date-window contract; the service is capped at 5,000 rows.
export const downloadServerCsv = async (dataset, { startDate, endDate } = {}) => {
  try {
    const response = await apiClient.get(`/export/${dataset}`, {
      params: { startDate, endDate },
      responseType: 'blob'
    });
    const contentType = getHeader(response.headers, 'content-type') || 'text/csv; charset=utf-8';

    if (/application\/json|text\/html/i.test(contentType)) {
      const error = new Error('The export service returned an unexpected file type.');
      error.isExportError = true;
      throw error;
    }

    const blob = response.data instanceof Blob
      ? response.data
      : new Blob([response.data || ''], { type: contentType });
    if (blob.size === 0) {
      const error = new Error('The export service returned an empty file.');
      error.isExportError = true;
      throw error;
    }

    const fallbackFilename = `${dataset}_${startDate || 'all'}_${endDate || 'all'}.csv`;
    const filename = getContentDispositionFilename(
      getHeader(response.headers, 'content-disposition'),
      fallbackFilename
    );
    const downloadedFilename = downloadBlob(blob, filename);
    return {
      filename: downloadedFilename,
      contentType,
      size: blob.size
    };
  } catch (error) {
    throw await toExportError(error);
  }
};
