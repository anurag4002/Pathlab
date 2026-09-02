import apiClient from './apiClient';

export const getPanels = async () => {
  const response = await apiClient.get('/tests/panels');
  return response.data;
};

export const createPanel = async (data) => {
  const response = await apiClient.post('/tests/panels', data);
  return response.data;
};

export const updatePanel = async (id, data) => {
  const response = await apiClient.put(`/tests/panels/${id}`, data);
  return response.data;
};

export const deletePanel = async (id) => {
  const response = await apiClient.delete(`/tests/panels/${id}`);
  return response.data;
};
