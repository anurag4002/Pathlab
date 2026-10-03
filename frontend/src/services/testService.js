import apiClient from './apiClient';
import { getCached, invalidateCatalog } from './catalogCache';

// Tests CRUD — cached for catalog-style reads (no search / short TTL)
export const getTests = async (params = {}) => {
  const searchable = Boolean(params.search && String(params.search).trim());
  const fetch = async () => (await apiClient.get('/tests', { params })).data;
  if (searchable) return fetch();
  return getCached('tests', params, fetch);
};

export const createTest = async (data) => {
  const response = await apiClient.post('/tests', data);
  invalidateCatalog('tests');
  invalidateCatalog('categories');
  return response.data;
};

export const updateTest = async (id, data) => {
  const response = await apiClient.put(`/tests/${id}`, data);
  invalidateCatalog('tests');
  return response.data;
};

export const deleteTest = async (id) => {
  const response = await apiClient.delete(`/tests/${id}`);
  invalidateCatalog('tests');
  return response.data;
};

// Phase 21 — single + bulk rate updates
export const updateTestRate = async (id, price) => {
  const response = await apiClient.put(`/tests/${id}/rate`, { price });
  invalidateCatalog('tests');
  return response.data;
};

export const bulkUpdateTestRates = async (updates) => {
  const response = await apiClient.put('/tests/bulk-rate-update', { updates });
  invalidateCatalog('tests');
  return response.data;
};

export const getCategories = async () => {
  return getCached('categories', {}, async () => (await apiClient.get('/tests/categories')).data);
};
export const getTestCategories = getCategories;

export const createCategory = async (data) => {
  const response = await apiClient.post('/tests/categories', data);
  invalidateCatalog('categories');
  return response.data;
};

export const updateCategory = async (id, data) => {
  const response = await apiClient.put(`/tests/categories/${id}`, data);
  invalidateCatalog('categories');
  return response.data;
};

export const deleteCategory = async (id) => {
  const response = await apiClient.delete(`/tests/categories/${id}`);
  invalidateCatalog('categories');
  return response.data;
};

// Interpretations CRUD
export const getInterpretations = async (params = {}) => {
  const response = await apiClient.get('/tests/interpretations', { params });
  return response.data;
};

export const createInterpretation = async (data) => {
  const response = await apiClient.post('/tests/interpretations', data);
  return response.data;
};

export const updateInterpretation = async (id, data) => {
  const response = await apiClient.put(`/tests/interpretations/${id}`, data);
  return response.data;
};

export const deleteInterpretation = async (id) => {
  const response = await apiClient.delete(`/tests/interpretations/${id}`);
  return response.data;
};
