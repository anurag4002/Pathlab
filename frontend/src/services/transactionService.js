import apiClient from './apiClient';

export const getTransactions = async (params = {}) => {
  const response = await apiClient.get('/transactions', { params });
  return response.data;
};
