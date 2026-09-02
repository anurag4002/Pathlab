import apiClient from './apiClient';

export const getPackages = async () => {
  const response = await apiClient.get('/tests/packages');
  return response.data;
};

export const createPackage = async (data) => {
  const response = await apiClient.post('/tests/packages', data);
  return response.data;
};

export const updatePackage = async (id, data) => {
  const response = await apiClient.put(`/tests/packages/${id}`, data);
  return response.data;
};

export const deletePackage = async (id) => {
  const response = await apiClient.delete(`/tests/packages/${id}`);
  return response.data;
};
