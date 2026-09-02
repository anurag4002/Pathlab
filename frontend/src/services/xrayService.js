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
