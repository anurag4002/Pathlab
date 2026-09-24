import apiClient from './apiClient';

export const getReports = async (params = {}) => {
  const response = await apiClient.get('/reports', { params });
  return response.data;
};

// Phase 1 — today's worklist. Thin wrapper over GET /reports filtered to
// the current calendar day (no dedicated backend endpoint exists).
export const getTodaysReports = async (params = {}) => {
  const today = new Date().toISOString().split('T')[0];
  return getReports({ from: today, to: today, limit: 100, ...params });
};

export const uploadReport = async (formData) => {
  const response = await apiClient.post('/reports/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });
  return response.data;
};

export const deleteReport = async (id) => {
  const response = await apiClient.delete(`/reports/${id}`);
  return response.data;
};

// Result entry (Labsmart parity): register shell -> save values (auto
// formula + flags server-side) -> e-sign.
export const createResultReport = async ({ patient, bill }) => {
  const response = await apiClient.post('/reports/result', { patient, bill });
  return response.data;
};

export const saveReportResults = async (id, results) => {
  const response = await apiClient.put(`/reports/${id}/results`, { results });
  return response.data;
};

export const saveReportResultsDraft = async (id, results) => {
  const response = await apiClient.put(`/reports/${id}/results/draft`, { results });
  return response.data;
};

export const submitReportResults = async (id, results) => {
  const response = await apiClient.put(`/reports/${id}/results/submit`, { results });
  return response.data;
};

export const getPendingLabCases = async (params = {}) => {
  const response = await apiClient.get('/reports/pending-cases', { params });
  return response.data;
};

export const getReportForEntry = async (id) => {
  const response = await apiClient.get(`/reports/${id}/entry`);
  return response.data;
};

export const signReport = async (id, signatureId) => {
  const response = await apiClient.post(`/reports/${id}/sign`, { signatureId });
  return response.data;
};

export const updateReportTat = async (id, tat) => {
  const response = await apiClient.put(`/reports/${id}/tat`, tat);
  return response.data;
};

// Verification workflow (backend live): verify / reject / resend / comments / delivery-status.
export const verifyReport = async (id) => (await apiClient.post(`/reports/${id}/verify`)).data;
export const rejectReport = async (id, reason) => (await apiClient.post(`/reports/${id}/reject`, { reason })).data;
export const resendReport = async (id) => (await apiClient.post(`/reports/${id}/resend`)).data;
export const addReportComment = async (id, body) => (await apiClient.post(`/reports/${id}/comments`, { body })).data;
export const getDeliveryStatus = async (id) => (await apiClient.get(`/reports/${id}/delivery-status`)).data;

// Phase 5 — per-file image upload with isolated failures.
//
// Replaces the old sequential loop that aborted on the first error:
// every file is posted independently (Promise.allSettled) so one bad
// file never blocks the rest. Resolves — never rejects for per-file
// failures — with:
//   { results: [{ file, status: 'done'|'error', url?, error? }],
//     succeeded: [urls], failed: [{ file, error }] }
// `modality` is 'usg' | 'xray'; `onFileStatus(index, patch)` receives
// live progress / status callbacks for UI binding.
export const uploadImages = async (caseId, files, modality = 'usg', { onFileStatus } = {}) => {
  if (!caseId) throw new Error('caseId is required');
  const base = modality === 'xray' ? `/xray/cases/${caseId}/images` : `/usg/cases/${caseId}/images`;
  const list = Array.from(files || []);
  const settled = await Promise.allSettled(
    list.map(async (file, index) => {
      const fd = new FormData();
      fd.append('file', file);
      const res = await apiClient.post(base, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e) => {
          if (onFileStatus && e.total) onFileStatus(index, { progress: Math.round((e.loaded / e.total) * 100) });
        }
      });
      const url = res.data?.data?.url || res.data?.url || res.data?.data?.fileUrl || '';
      if (onFileStatus) onFileStatus(index, { status: 'done', progress: 100, url });
      return { file, status: 'done', url };
    })
  );
  const results = settled.map((s, index) => {
    if (s.status === 'fulfilled') return s.value;
    const error = s.reason?.response?.data?.message || s.reason?.message || 'Upload failed';
    if (onFileStatus) onFileStatus(index, { status: 'error', error });
    return { file: list[index], status: 'error', error };
  });
  return {
    results,
    succeeded: results.filter((r) => r.status === 'done').map((r) => r.url).filter(Boolean),
    failed: results.filter((r) => r.status === 'error')
  };
};
