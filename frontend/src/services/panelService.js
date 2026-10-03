import apiClient from './apiClient';
import { getCached, invalidateCatalog } from './catalogCache';

export const getPanels = async () => {
  return getCached('panels', {}, async () => (await apiClient.get('/tests/panels')).data);
};

export const createPanel = async (data) => {
  const response = await apiClient.post('/tests/panels', data);
  invalidateCatalog('panels');
  return response.data;
};

export const updatePanel = async (id, data) => {
  const response = await apiClient.put(`/tests/panels/${id}`, data);
  invalidateCatalog('panels');
  return response.data;
};

export const deletePanel = async (id) => {
  const response = await apiClient.delete(`/tests/panels/${id}`);
  invalidateCatalog('panels');
  return response.data;
};
