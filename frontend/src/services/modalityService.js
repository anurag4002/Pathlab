import apiClient from './apiClient';

// Generic modality cases (CT/MRI/ECG/...) + USG/X-Ray deletes  ->  /api/modality/*
export const MODALITIES = ['CT', 'MRI', 'ECG', 'OPG', 'EEG', 'MAMMOGRAPHY', 'CARDIOLOGY', 'EPS', 'OUTSOURCE', 'USG', 'XRAY', 'LAB'];
export const getModalityCases = async (params = {}) => (await apiClient.get('/modality', { params })).data;
export const createModalityCase = async (data) => (await apiClient.post('/modality', data)).data;
export const updateModalityCase = async (id, data) => (await apiClient.put(`/modality/${id}`, data)).data;
export const deleteModalityCase = async (id) => (await apiClient.delete(`/modality/${id}`)).data;
export const deleteUSGCase = async (id) => (await apiClient.delete(`/modality/usg/${id}`)).data;
export const deleteXrayCase = async (id) => (await apiClient.delete(`/modality/xray/${id}`)).data;
