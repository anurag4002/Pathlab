import apiClient from './apiClient';
import { getCached, invalidateCatalog } from './catalogCache';

export const getAgents = async (params = {}) => {
  const searchable = Boolean(params.search && String(params.search).trim());
  const fetch = async () => (await apiClient.get('/agents', { params })).data;
  if (searchable) return fetch();
  return getCached('agents', params, fetch);
};

export const getAgentById = async (id) => {
  const response = await apiClient.get(`/agents/${id}`);
  return response.data;
};

export const createAgent = async (data) => {
  const response = await apiClient.post('/agents', data);
  invalidateCatalog('agents');
  return response.data;
};

export const updateAgent = async (id, data) => {
  const response = await apiClient.put(`/agents/${id}`, data);
  invalidateCatalog('agents');
  return response.data;
};

export const deleteAgent = async (id) => {
  const response = await apiClient.delete(`/agents/${id}`);
  invalidateCatalog('agents');
  return response.data;
};
