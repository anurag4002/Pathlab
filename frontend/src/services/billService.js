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

export const refundBill = async (id, data) => (await apiClient.post(`/bills/${id}/refund`, data)).data;
// Google Reviews page: mark (asked: true) or clear (asked: false) a review request.
export const updateReviewRequest = async (id, data) => (await apiClient.put(`/bills/${id}/review-request`, data)).data;
export const updateBill = async (id, data) => (await apiClient.put(`/bills/${id}`, data)).data;
export const getCashbook = async (params = {}) => (await apiClient.get('/bills/cashbook', { params })).data;
export const createManualCashEntry = async (data) => (await apiClient.post('/bills/cashbook', data)).data;
