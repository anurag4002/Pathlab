import apiClient from './apiClient';

export const getExpenses = async (params = {}) => {
  const response = await apiClient.get('/expenses', { params });
  return response.data;
};

export const getExpenseSummary = async () => {
  const response = await apiClient.get('/expenses/summary');
  return response.data;
};

export const createExpense = async (data) => {
  const response = await apiClient.post('/expenses', data);
  return response.data;
};

export const updateExpense = async (id, data) => {
  const response = await apiClient.put(`/expenses/${id}`, data);
  return response.data;
};

export const deleteExpense = async (id) => {
  const response = await apiClient.delete(`/expenses/${id}`);
  return response.data;
};
