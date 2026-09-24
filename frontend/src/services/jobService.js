import apiClient from './apiClient';

// Server background-job queue  ->  /api/jobs/*  (Admin only).
// The backend persists failed notify sends as jobs (type 'notify') and
// exposes idempotent retry via POST /api/jobs/:id/retry.
export const getJobs = async (params = {}) => (await apiClient.get('/jobs', { params })).data;
export const retryJob = async (id) => (await apiClient.post(`/jobs/${id}/retry`)).data;
