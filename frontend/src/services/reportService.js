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
