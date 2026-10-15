import apiClient from './apiClient';
import { reportPdfCacheFor, rememberReportPdf } from '../utils/reportPdfCache';

export const isReportPdfPath = path => /^\/reports\/[^/?]+\/pdf(?:\?|$)/.test(path);
const blobOf = response => {
  const type = response.headers?.['content-type'] || response.data?.type || 'application/pdf';
  if (/application\/json|text\/html/i.test(type)) throw new Error('The PDF service returned an unexpected file type.');
  return response.data instanceof Blob ? response.data : new Blob([response.data], { type });
};

export function getReportPdfDocument(path) {
  if (!isReportPdfPath(path)) return apiClient.get(path, { responseType: 'blob' }).then(blobOf);
  const cache = reportPdfCacheFor(localStorage.getItem('ppl_token') || '');
  const [base, query = ''] = path.split('?');
  const params = new URLSearchParams(query); params.sort();
  const key = `${base}?${params}`;
  if (cache.pending.has(key)) return cache.pending.get(key);
  const saved = cache.entries.get(key), generation = cache.generation;
  const promise = apiClient.get(path, {
    responseType: 'blob',
    headers: saved?.etag ? { 'If-None-Match': saved.etag } : {},
    validateStatus: status => status === 200 || status === 304
  }).then(response => {
    const blob = response.status === 304 && saved ? saved.blob : blobOf(response);
    if (cache.generation === generation) rememberReportPdf(key, { blob, etag: response.headers?.etag || saved?.etag });
    return blob;
  }).finally(() => { if (cache.pending.get(key) === promise) cache.pending.delete(key); });
  cache.pending.set(key, promise);
  return promise;
}
