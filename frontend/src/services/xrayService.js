import apiClient from './apiClient';

export const getXrayCases = async (params = {}) => {
  const response = await apiClient.get('/xray', { params });
  return response.data;
};

export const getXrayCaseById = async (id) => {
  const response = await apiClient.get(`/xray/${id}`);
  return response.data;
};

export const createXrayCase = async (formData) => {
  const response = await apiClient.post('/xray', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });
  return response.data;
};

export const updateXrayCase = async (id, formData) => {
  const response = await apiClient.put(`/xray/${id}`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });
  return response.data;
};

// Phase 14 — radiologist / assistant workflow.
// NOTE: `my-cases` + sign + dedicated images endpoints are requested
// backend additions; the UI degrades gracefully (empty state / error
// toast) until they land.
export const getMyXrayCases = async (params = {}) => {
  const response = await apiClient.get('/xray/my-cases', { params });
  return response.data;
};

export const signXrayCase = async (id, payload = {}) => {
  try {
    const response = await apiClient.post(`/xray/cases/${id}/sign`, payload);
    return response.data;
  } catch (err) {
    // Backend pending: dedicated sign endpoint not deployed yet —
    // degrade to marking the case Completed so sign-off still works.
    if (err?.response?.status === 404) {
      const fd = new FormData();
      fd.append('status', 'Completed');
      return updateXrayCase(id, fd);
    }
    throw err;
  }
};

// Phase 5/14 — single image; `onProgress` receives 0-100.
export const uploadXrayImage = async (caseId, file, { onProgress } = {}) => {
  const fd = new FormData();
  fd.append('file', file);
  const response = await apiClient.post(`/xray/cases/${caseId}/images`, fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (e) => {
      if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100));
    }
  });
  const url =
    response.data?.data?.url || response.data?.url || response.data?.data?.fileUrl || '';
  return url || response.data;
};

// Phase 5/14 — multi-file with per-file isolation (one failure never
// aborts the rest). Resolves { results, succeeded, failed }.
export const uploadXrayImages = async (caseId, files, { onFileStatus } = {}) => {
  const list = Array.from(files || []);
  const settled = await Promise.allSettled(
    list.map(async (file, index) =>
      uploadXrayImage(caseId, file, {
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
