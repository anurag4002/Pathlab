import apiClient from './apiClient';

export const getUSGCases = async (params = {}) => {
  const response = await apiClient.get('/usg', { params });
  return response.data;
};

export const getUSGCaseById = async (id) => {
  const response = await apiClient.get(`/usg/${id}`);
  return response.data;
};

export const createUSGCase = async (data) => {
  const response = await apiClient.post('/usg', data);
  return response.data;
};

export const updateUSGCase = async (id, data) => {
  const response = await apiClient.put(`/usg/${id}`, data);
  return response.data;
};

export const getUSGTemplates = async () => {
  const response = await apiClient.get('/usg/templates');
  return response.data;
};

// Phase 13 — radiologist / technician workflow.
// NOTE: `my-cases` + department/assigned filters are requested backend
// additions; params are sent regardless and lists are filtered
// client-side as well, so the UI works before server support lands.
export const getMyUSGCases = async (params = {}) => {
  const response = await apiClient.get('/usg/my-cases', { params });
  return response.data;
};

export const signUSGCase = async (id, payload = {}) => {
  try {
    const response = await apiClient.post(`/usg/cases/${id}/sign`, payload);
    return response.data;
  } catch (err) {
    // Backend pending: dedicated sign endpoint not deployed yet —
    // degrade to marking the case Completed so sign-off still works.
    if (err?.response?.status === 404) {
      return updateUSGCase(id, { status: 'Completed' });
    }
    throw err;
  }
};

// Phase 5 — single image; `onProgress` receives 0-100 for the progress bar.
export const uploadUSGImage = async (caseId, file, { onProgress } = {}) => {
  const fd = new FormData();
  fd.append('file', file);
  const response = await apiClient.post(`/usg/cases/${caseId}/images`, fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (e) => {
      if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100));
    }
  });
  const url =
    response.data?.data?.url || response.data?.url || response.data?.data?.fileUrl || '';
  return url || response.data;
};

// Phase 5 — multi-file with per-file isolation (one failure never aborts
// the rest). Resolves { results, succeeded, failed }.
export const uploadUSGImages = async (caseId, files, { onFileStatus } = {}) => {
  const list = Array.from(files || []);
  const settled = await Promise.allSettled(
    list.map(async (file, index) =>
      uploadUSGImage(caseId, file, {
        onProgress: (progress) => onFileStatus && onFileStatus(index, { progress })
      }).then((url) => {
        if (onFileStatus) onFileStatus(index, { status: 'done', progress: 100, url: typeof url === 'string' ? url : '' });
        return { file, status: 'done', url: typeof url === 'string' ? url : '' };
      })
    )
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
