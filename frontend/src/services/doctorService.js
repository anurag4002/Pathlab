import apiClient from './apiClient';
import { getCached, invalidateCatalog } from './catalogCache';

export const getDoctors = async (params = {}) => {
  const searchable = Boolean(params.search && String(params.search).trim());
  const fetch = async () => (await apiClient.get('/doctors', { params })).data;
  if (searchable) return fetch();
  return getCached('doctors', params, fetch);
};

export const getDoctorById = async (id) => {
  const response = await apiClient.get(`/doctors/${id}`);
  return response.data;
};

export const createDoctor = async (data) => {
  const response = await apiClient.post('/doctors', data);
  invalidateCatalog('doctors');
  return response.data;
};

export const updateDoctor = async (id, data) => {
  const response = await apiClient.put(`/doctors/${id}`, data);
  invalidateCatalog('doctors');
  return response.data;
};

export const deleteDoctor = async (id) => {
  const response = await apiClient.delete(`/doctors/${id}`);
  invalidateCatalog('doctors');
  return response.data;
};
