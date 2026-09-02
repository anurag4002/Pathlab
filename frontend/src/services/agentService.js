import apiClient from './apiClient';

export const getAgents = async (params = {}) => {
  const response = await apiClient.get('/agents', { params });
  return response.data;
};

export const getAgentById = async (id) => {
  const response = await apiClient.get(`/agents/${id}`);
  return response.data;
};

export const createAgent = async (data) => {
  const response = await apiClient.post('/agents', data);
  return response.data;
};

export const updateAgent = async (id, data) => {
  const response = await apiClient.put(`/agents/${id}`, data);
  return response.data;
};

export const deleteAgent = async (id) => {
  const response = await apiClient.delete(`/agents/${id}`);
  return response.data;
};
