import apiClient from './apiClient';

export const getPatients = async (params = {}) => {
  const response = await apiClient.get('/patients', { params });
  return response.data;
};

export const getPatientById = async (id) => {
  const response = await apiClient.get(`/patients/${id}`);
  return response.data;
};

export const createPatient = async (data) => {
  const response = await apiClient.post('/patients', data);
  return response.data;
};

export const updatePatient = async (id, data) => {
  const response = await apiClient.put(`/patients/${id}`, data);
  return response.data;
};

export const deletePatient = async (id) => {
  const response = await apiClient.delete(`/patients/${id}`);
  return response.data;
};
