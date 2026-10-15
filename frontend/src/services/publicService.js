import apiClient from './apiClient';
import { downloadBlob as saveBlob } from '../utils/downloadFile';
import { beginPdfPrint } from '../utils/pdfPrintSession';
import { getReportPdfDocument, isReportPdfPath } from './reportPdfDocumentService';

// Public QR self-service (no login). apiClient base is /api.
export const verifyReportToken = async (token) => (await apiClient.get(`/public/r/${token}`)).data;
export const verifyBillToken = async (token) => (await apiClient.get(`/public/r/bill/${token}`)).data;

export const downloadBlob = async (path, filename) => {
  if (isReportPdfPath(path)) return saveBlob(await getReportPdfDocument(path), filename);
  const response = await apiClient.get(path, { responseType: 'blob' });
  const contentType = response.headers?.['content-type'] || response.data?.type || 'application/octet-stream';
  if (/application\/json|text\/html/i.test(contentType)) {
    const error = new Error('The download service returned an unexpected file type.');
    error.status = response.status;
    throw error;
  }
  const blob = response.data instanceof Blob
    ? response.data
    : new Blob([response.data || ''], { type: contentType });
  return saveBlob(blob, filename);
};

// Server-rendered PDFs + barcode (auth via apiClient; keep client light —
// no jsPDF/html2canvas anywhere).
//
// Every helper accepts either the legacy boolean
// (`downloadReportPdf(id, true)`) or an options object
// (`downloadReportPdf(id, { barcode: false })`). Options map 1:1 to the
// LabProfile print toggles (?letterhead=&footer=&barcode=&qr=&tat=
// &referred=&dept=&flags=&interpretation=&endline=&signatures=
// &watermark=&pageno=, 1/0). Omitted flags fall back to the stored profile.
const PDF_OPTION_KEYS = [
  'letterhead', 'footer', 'barcode', 'qr', 'tat', 'referred', 'dept',
  'flags', 'interpretation', 'endline', 'signatures', 'watermark', 'pageno'
];

export const buildPdfQuery = (letterhead, opts = {}) => {
  if (letterhead && typeof letterhead === 'object') {
    opts = letterhead;
    letterhead = undefined;
  }
  const params = new URLSearchParams();
  if (letterhead !== undefined) params.set('letterhead', letterhead ? '1' : '0');
  PDF_OPTION_KEYS.forEach((key) => {
    if (opts[key] === undefined || (key === 'letterhead' && letterhead !== undefined)) return;
    params.set(key, opts[key] ? '1' : '0');
  });
  const query = params.toString();
  return query ? `?${query}` : '';
};

export const downloadBillPdf = (id, letterhead, opts = {}) =>
  downloadBlob(`/bills/${id}/pdf${buildPdfQuery(letterhead, opts)}`, `Bill_${id}.pdf`);
// Direct silent print of a server PDF (no new tab): fetch with auth, load
// into an off-screen (but real-sized — a 0px frame renders blank) iframe,
// wait for the viewer, then print the PDF itself.
export const printPdfPath = async (path) => {
  const endPrint = beginPdfPrint();
  try {
    const blob = await getReportPdfDocument(path);
    return await new Promise((resolve, reject) => {
      const url = window.URL.createObjectURL(blob);
      const iframe = document.createElement('iframe');
      iframe.title = 'Report PDF print document';
      iframe.setAttribute('aria-hidden', 'true');
      iframe.style.cssText = 'position:fixed;left:-10000px;top:0;width:816px;height:1056px;border:0';
      let settled = false, renderTimer, cleanupTimer;
      const cleanup = error => {
        if (settled) return;
        settled = true;
        clearTimeout(renderTimer); clearTimeout(cleanupTimer);
        window.removeEventListener('afterprint', afterPrint);
        try { iframe.contentWindow?.removeEventListener('afterprint', afterPrint); } catch { /* PDF viewer boundary */ }
        window.URL.revokeObjectURL(url);
        iframe.remove();
        endPrint();
        if (error) reject(error); else resolve();
      };
      const afterPrint = () => cleanup();
      iframe.onload = () => {
        renderTimer = setTimeout(() => {
          try {
            // Register BEFORE print(): afterprint may fire before it returns,
            // including when the user cancels the native dialog with Escape.
            window.addEventListener('afterprint', afterPrint);
            iframe.contentWindow.addEventListener('afterprint', afterPrint);
            clearTimeout(cleanupTimer);
            cleanupTimer = setTimeout(afterPrint, 60000);
            iframe.contentWindow.focus();
            iframe.contentWindow.print();
          } catch {
            cleanup(new Error('Could not open the print dialog. Download the PDF to print it.'));
          }
        }, 900);
      };
      iframe.onerror = () => cleanup(new Error('Failed to load PDF for printing'));
      cleanupTimer = setTimeout(() => cleanup(new Error('The print document took too long to load. Please try again.')), 60000);
      iframe.src = url;
      document.body.appendChild(iframe);
    });
  } catch (error) {
    endPrint();
    throw error;
  }
};
export const printBillPdf = (id, letterhead, opts = {}) =>
  printPdfPath(`/bills/${id}/pdf${buildPdfQuery(letterhead, opts)}`);
export const printReportPdf = (id, letterhead, opts = {}) =>
  printPdfPath(`/reports/${id}/pdf${buildPdfQuery(letterhead, opts)}`);
// Optional `filename` lets callers use the report's own registration number
// (API-provided) instead of the Mongo id; default keeps other callers intact.
export const downloadReportPdf = (id, letterhead, filename, opts = {}) => {
  if (filename && typeof filename === 'object') {
    opts = filename;
    filename = undefined;
  }
  return downloadBlob(
    `/reports/${id}/pdf${buildPdfQuery(letterhead, opts)}`,
    filename || `Report_${id}.pdf`
  );
};
export const fetchBarcodeSvgUrl = async (billId) => {
  const response = await apiClient.get(`/bills/${billId}/barcode.svg`, { responseType: 'blob' });
  return window.URL.createObjectURL(new Blob([response.data], { type: 'image/svg+xml' }));
};
// Bill barcode by number: direct URL for
// GET /api/public/bill/:billNumber/barcode (public SVG, no auth).
// Case/sample barcodes: /api/public/case/:caseId/barcode and
// /api/public/sample/:sampleId/barcode (same pattern).
export const getBillBarcodeUrl = (billNumber) => `/api/public/bill/${billNumber}/barcode`;
export const fetchBillQr = async (billId) => (await apiClient.get(`/bills/${billId}/qr`)).data;
export const fetchReportQr = async (reportId) => (await apiClient.get(`/reports/${reportId}/qr`)).data;
