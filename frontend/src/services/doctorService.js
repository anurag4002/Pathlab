import apiClient from './apiClient';

export const getDoctors = async (params = {}) => {
  const response = await apiClient.get('/doctors', { params });
  return response.data;
};

export const getDoctorById = async (id) => {
  const response = await apiClient.get(`/doctors/${id}`);
  return response.data;
};

export const createDoctor = async (data) => {
  const response = await apiClient.post('/doctors', data);
  return response.data;
};

export const updateDoctor = async (id, data) => {
  const response = await apiClient.put(`/doctors/${id}`, data);
  return response.data;
};

export const deleteDoctor = async (id) => {
  const response = await apiClient.delete(`/doctors/${id}`);
  return response.data;
};
