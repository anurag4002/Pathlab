import apiClient from './apiClient';

export const getReports = async (params = {}) => {
  const response = await apiClient.get('/reports', { params });
  return response.data;
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

export const signReport = async (id, signatureId) => {
  const response = await apiClient.post(`/reports/${id}/sign`, { signatureId });
  return response.data;
};

export const updateReportTat = async (id, tat) => {
  const response = await apiClient.put(`/reports/${id}/tat`, tat);
  return response.data;
};
