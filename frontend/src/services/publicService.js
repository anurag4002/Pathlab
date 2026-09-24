import apiClient from './apiClient';
import { downloadBlob as saveBlob } from '../utils/downloadFile';

// Public QR self-service (no login). apiClient base is /api.
export const verifyReportToken = async (token) => (await apiClient.get(`/public/r/${token}`)).data;
export const verifyBillToken = async (token) => (await apiClient.get(`/public/r/bill/${token}`)).data;

export const downloadBlob = async (path, filename) => {
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
export const downloadBillPdf = (id, letterhead = true) =>
  downloadBlob(`/bills/${id}/pdf?letterhead=${letterhead ? '1' : '0'}`, `Bill_${id}.pdf`);
// Direct silent print of a server PDF (no new tab): fetch with auth, load
// into an off-screen (but real-sized — a 0px frame renders blank) iframe,
// wait for the viewer, then print the PDF itself.
export const printPdfPath = (path) =>
  new Promise(async (resolve, reject) => {
    try {
      const response = await apiClient.get(path, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const iframe = document.createElement('iframe');
      // Off-screen but full letter size: the PDF viewer needs layout size
      // to rasterize, otherwise the printout comes out blank.
      iframe.style.position = 'fixed';
      iframe.style.left = '-10000px';
      iframe.style.top = '0';
      iframe.style.width = '816px';
      iframe.style.height = '1056px';
      iframe.style.border = '0';
      let settled = false;
      const cleanup = () => {
        if (settled) return;
        settled = true;
        window.URL.revokeObjectURL(url);
        if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
        resolve();
      };
      // Clean up when the print dialog closes; long fallback so the blob
      // is never revoked mid-print (revoking early blanks the job).
      const armCleanup = () => {
        try {
          iframe.contentWindow.addEventListener('afterprint', cleanup);
        } catch (e) { /* cross-viewer safety */ }
        setTimeout(cleanup, 60000);
      };
      iframe.onload = () => {
        // The frame load fires before the PDF viewer finishes rendering —
        // a short beat prevents a blank first page.
        setTimeout(() => {
          try {
            iframe.contentWindow.focus();
            iframe.contentWindow.print();
          } catch (e) {
            window.open(url, '_blank', 'noopener');
          }
          armCleanup();
        }, 900);
      };
      iframe.onerror = () => {
        window.URL.revokeObjectURL(url);
        if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
        reject(new Error('Failed to load PDF for printing'));
      };
      document.body.appendChild(iframe);
      iframe.src = url;
    } catch (err) {
      reject(err);
    }
  });

export const printBillPdf = (id, letterhead = true) =>
  printPdfPath(`/bills/${id}/pdf?letterhead=${letterhead ? '1' : '0'}`);
export const printReportPdf = (id, letterhead = true) =>
  printPdfPath(`/reports/${id}/pdf?letterhead=${letterhead ? '1' : '0'}`);
// Optional `filename` lets callers use the report's own registration number
// (API-provided) instead of the Mongo id; default keeps other callers intact.
export const downloadReportPdf = (id, letterhead = true, filename) =>
  downloadBlob(
    `/reports/${id}/pdf?letterhead=${letterhead ? '1' : '0'}`,
    filename || `Report_${id}.pdf`
  );
export const fetchBarcodeSvgUrl = async (billId) => {
  const response = await apiClient.get(`/bills/${billId}/barcode.svg`, { responseType: 'blob' });
  return window.URL.createObjectURL(new Blob([response.data], { type: 'image/svg+xml' }));
};
export const fetchBillQr = async (billId) => (await apiClient.get(`/bills/${billId}/qr`)).data;
export const fetchReportQr = async (reportId) => (await apiClient.get(`/reports/${reportId}/qr`)).data;
