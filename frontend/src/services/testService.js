import apiClient from './apiClient';

// Tests CRUD
export const getTests = async (params = {}) => {
  const response = await apiClient.get('/tests', { params });
  return response.data;
};

export const createTest = async (data) => {
  const response = await apiClient.post('/tests', data);
  return response.data;
};

export const updateTest = async (id, data) => {
  const response = await apiClient.put(`/tests/${id}`, data);
  return response.data;
};

export const deleteTest = async (id) => {
  const response = await apiClient.delete(`/tests/${id}`);
  return response.data;
};

// Phase 21 — single + bulk rate updates
export const updateTestRate = async (id, price) => {
  const response = await apiClient.put(`/tests/${id}/rate`, { price });
  return response.data;
};

export const bulkUpdateTestRates = async (updates) => {
  const response = await apiClient.put('/tests/bulk-rate-update', { updates });
  return response.data;
};

export const getCategories = async () => {
  const response = await apiClient.get('/tests/categories');
  return response.data;
};
export const getTestCategories = getCategories;

export const createCategory = async (data) => {
  const response = await apiClient.post('/tests/categories', data);
  return response.data;
};

export const updateCategory = async (id, data) => {
  const response = await apiClient.put(`/tests/categories/${id}`, data);
  return response.data;
};

export const deleteCategory = async (id) => {
  const response = await apiClient.delete(`/tests/categories/${id}`);
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
