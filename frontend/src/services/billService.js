import apiClient from './apiClient';

export const getBills = async (params = {}) => {
  const response = await apiClient.get('/bills', { params });
  return response.data;
};

export const getBillById = async (id) => {
  const response = await apiClient.get(`/bills/${id}`);
  return response.data;
};

export const createBill = async (data) => {
  const response = await apiClient.post('/bills', data);
  return response.data;
};

export const collectPayment = async (id, paymentData) => {
  const response = await apiClient.post(`/bills/${id}/payment`, paymentData);
  return response.data;
};

export const voidBill = async (id, reason) => {
  const response = await apiClient.post(`/bills/${id}/void`, { reason });
  return response.data;
};
