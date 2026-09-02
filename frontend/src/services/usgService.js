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
