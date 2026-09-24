import apiClient from './apiClient';

// Lab profile / onboarding / signatures / browser allow-list  ->  /api/setup/*
export const getLabProfile = async () => (await apiClient.get('/setup/lab-profile')).data;
export const updateLabProfile = async (data) => (await apiClient.put('/setup/lab-profile', data)).data;
export const uploadLogo = async (file) => {
  const fd = new FormData();
  fd.append('file', file);
  return (await apiClient.post('/setup/lab-profile/logo', fd, { headers: { 'Content-Type': 'multipart/form-data' } })).data;
};
export const uploadLetterhead = async (file) => {
  const fd = new FormData();
  fd.append('file', file);
  return (await apiClient.post('/setup/lab-profile/letterhead', fd, { headers: { 'Content-Type': 'multipart/form-data' } })).data;
};
export const getOnboarding = async () => (await apiClient.get('/setup/onboarding')).data;
export const setOnboardingStep = async (key, done = true) => (await apiClient.post('/setup/onboarding', { key, done })).data;
export const getSignatures = async () => (await apiClient.get('/setup/signatures')).data;
export const createSignature = async (formData) =>
  (await apiClient.post('/setup/signatures', formData, { headers: { 'Content-Type': 'multipart/form-data' } })).data;
// Phase 15 — update/deactivate endpoint does NOT exist on the backend yet
// (only GET/POST/DELETE /api/setup/signatures). Kept here so the UI can
// attempt it and degrade to a clear "backend pending" state (no faking).
export const updateSignature = async (id, data) =>
  (await apiClient.put(`/setup/signatures/${id}`, data)).data;
export const setSignatureStatus = async (id, status) => updateSignature(id, { status });
export const deleteSignature = async (id) => (await apiClient.delete(`/setup/signatures/${id}`)).data;
export const getBrowsers = async () => (await apiClient.get('/setup/browsers')).data;
export const createBrowser = async (data) => (await apiClient.post('/setup/browsers', data)).data;
export const setBrowserStatus = async (id, status) => (await apiClient.put(`/setup/browsers/${id}`, { status })).data;
export const deleteBrowser = async (id) => (await apiClient.delete(`/setup/browsers/${id}`)).data;
