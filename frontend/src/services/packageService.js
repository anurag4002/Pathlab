import apiClient from './apiClient';
import { getCached, invalidateCatalog } from './catalogCache';

export const getPackages = async () => {
  return getCached('packages', {}, async () => (await apiClient.get('/tests/packages')).data);
};

export const createPackage = async (data) => {
  const response = await apiClient.post('/tests/packages', data);
  invalidateCatalog('packages');
  return response.data;
};

export const updatePackage = async (id, data) => {
  const response = await apiClient.put(`/tests/packages/${id}`, data);
  invalidateCatalog('packages');
  return response.data;
};

export const deletePackage = async (id) => {
  const response = await apiClient.delete(`/tests/packages/${id}`);
  invalidateCatalog('packages');
  return response.data;
};
