import apiClient from './apiClient';

// Staff booking-inquiry queue  ->  /api/inquiries (Admin + Employee).
export const getInquiries = async (params = {}) =>
  (await apiClient.get('/inquiries', { params })).data;

export const setInquiryStatus = async (id, status) =>
  (await apiClient.patch(`/inquiries/${id}`, { status })).data;
