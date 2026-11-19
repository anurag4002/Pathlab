import apiClient from './apiClient';
import { downloadBlob } from './publicService';

// Referring doctor's own API  ->  /api/referrer/* (role 'Referrer' only).
export const getReferrerProfile = async () => (await apiClient.get('/referrer/me')).data;
export const getReferrerCases = async (params = {}) => (await apiClient.get('/referrer/cases', { params })).data;
export const getReferrerCatalog = async () => (await apiClient.get('/referrer/catalog')).data;
export const getReferrerRequests = async () => (await apiClient.get('/referrer/requests')).data;
export const sendReferrerRequest = async (payload) => (await apiClient.post('/referrer/requests', payload)).data;
export const shareReferrerReport = async (id) => (await apiClient.post(`/referrer/reports/${id}/share`)).data;
export const shareReferrerBill = async (id) => (await apiClient.post(`/referrer/bills/${id}/share`)).data;

const reportPath = (report) => (report.kind === 'lab'
  ? `/referrer/reports/${report._id}/pdf`
  : `/referrer/scans/${report.kind}/${report._id}/pdf`);
const reportFilename = (row, report) => (report.kind === 'lab'
  ? `Report_${row.billNumber || row.patient?.registrationNumber || report._id}.pdf`
  : `${report.label.replace(/\s+/g, '_')}_${row.billNumber || report._id}.pdf`);

export const downloadReferrerBill = (bill) => downloadBlob(`/referrer/bills/${bill._id}/pdf`, `Bill_${bill.billNumber}.pdf`);
// An outsourced report may hold several outside-lab files: download each.
export const downloadReferrerReport = async (row, report) => {
  const files = report.kind === 'lab' && Array.isArray(report.files) && report.files.length > 1 ? report.files : null;
  if (!files) return downloadBlob(reportPath(report), reportFilename(row, report));
  for (let i = 0; i < files.length; i += 1) {
    const id = files[i]?._id && files[i]._id !== 'legacy' ? `?file=${encodeURIComponent(files[i]._id)}` : '';
    const ext = (String(files[i]?.name || '').match(/\.(pdf|png|jpe?g)$/i) || ['.pdf'])[0];
    await downloadBlob(`${reportPath(report)}${id}`, reportFilename(row, report).replace(/\.pdf$/, `_${i + 1}${ext}`));
  }
  return undefined;
};

/** The signed report as a PDF Blob, to show on screen. */
export const fetchReferrerReport = async (report, fileId) => {
  const query = fileId && fileId !== 'legacy' ? `?file=${encodeURIComponent(fileId)}` : '';
  const response = await apiClient.get(`${reportPath(report)}${query}`, { responseType: 'blob' });
  const type = response.headers?.['content-type'] || response.data?.type || '';
  if (/application\/json|text\/html/i.test(type)) throw new Error('The report could not be opened.');
  return response.data instanceof Blob && /pdf/i.test(response.data.type)
    ? response.data
    : new Blob([response.data], { type: /pdf|image/i.test(type) ? type : 'application/pdf' });
};
