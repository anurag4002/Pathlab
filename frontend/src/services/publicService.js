import apiClient from './apiClient';

// Public QR self-service (no login). apiClient base is /api.
export const verifyReportToken = async (token) => (await apiClient.get(`/public/r/${token}`)).data;
export const verifyBillToken = async (token) => (await apiClient.get(`/public/r/bill/${token}`)).data;

export const downloadBlob = async (path, filename) => {
  const response = await apiClient.get(path, { responseType: 'blob' });
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
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
export const downloadReportPdf = (id, letterhead = true) =>
  downloadBlob(`/reports/${id}/pdf?letterhead=${letterhead ? '1' : '0'}`, `Report_${id}.pdf`);
export const fetchBarcodeSvgUrl = async (billId) => {
  const response = await apiClient.get(`/bills/${billId}/barcode.svg`, { responseType: 'blob' });
  return window.URL.createObjectURL(new Blob([response.data], { type: 'image/svg+xml' }));
};
// Phase 8/11 — bill barcode first: direct URL for
// GET /api/public/bill/:billNumber/barcode (pure URL builder, no fetch).
// Case/sample barcode endpoints do NOT exist — never build URLs for them.
export const getBillBarcodeUrl = (billNumber) => `/api/public/bill/${billNumber}/barcode`;
export const fetchBillQr = async (billId) => (await apiClient.get(`/bills/${billId}/qr`)).data;
export const fetchReportQr = async (reportId) => (await apiClient.get(`/reports/${reportId}/qr`)).data;
